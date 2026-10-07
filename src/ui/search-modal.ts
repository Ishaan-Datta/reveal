import { App, Modal, setIcon } from "obsidian";

import type {
	OpenTarget,
	RevealSettings,
	SearchResult,
	SearchScope,
} from "../model";
import { runRipgrepSearch } from "../search/ripgrep";

interface SearchModalOptions {
	vaultPath: string;
	scope: SearchScope;
	settings: RevealSettings;
	initialQuery: string;
	onChoose: (result: SearchResult, target: OpenTarget) => Promise<void>;
	onClose: () => void;
}

export class RevealSearchModal extends Modal {
	private inputEl!: HTMLInputElement;
	private resultsEl!: HTMLElement;
	private statusEl!: HTMLElement;
	private readonly results: SearchResult[] = [];
	private selectedIndex = -1;
	private debounceTimer: number | null = null;
	private searchController: AbortController | null = null;
	private generation = 0;

	constructor(app: App, private readonly options: SearchModalOptions) {
		super(app);
	}

	override onOpen(): void {
		this.modalEl.addClass("reveal-search-modal");
		this.contentEl.empty();

		const headerEl = this.contentEl.createDiv({ cls: "reveal-search-header" });
		const iconEl = headerEl.createSpan({ cls: "reveal-search-icon" });
		setIcon(iconEl, "search");
		this.inputEl = headerEl.createEl("input", {
			cls: "reveal-search-input",
			type: "search",
			placeholder:
				this.options.scope.type === "vault"
					? "Search every note..."
					: `Search ${this.options.scope.path.split("/").pop() ?? "current note"}...`,
			value: this.options.initialQuery,
		});
		this.inputEl.setAttr("aria-label", "Reveal search query");

		const scopeEl = this.contentEl.createDiv({ cls: "reveal-search-scope" });
		scopeEl.createSpan({
			cls: "reveal-search-scope-badge",
			text: this.options.scope.type === "vault" ? "Vault" : "Current file",
		});
		if (this.options.scope.type === "file") {
			scopeEl.createSpan({ cls: "reveal-search-scope-path", text: this.options.scope.path });
		}

		this.resultsEl = this.contentEl.createDiv({ cls: "reveal-search-results" });
		this.resultsEl.setAttr("role", "listbox");
		this.statusEl = this.contentEl.createDiv({ cls: "reveal-search-status" });

		this.inputEl.addEventListener("input", () => this.queueSearch());
		this.inputEl.addEventListener("keydown", (event: KeyboardEvent) => this.handleKeydown(event));

		this.inputEl.focus();
		this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length);
		this.queueSearch();
	}

	override onClose(): void {
		this.cancelSearch();
		this.contentEl.empty();
		this.options.onClose();
	}

	private queueSearch(): void {
		this.cancelSearch();
		this.generation += 1;
		const generation = this.generation;
		this.results.length = 0;
		this.selectedIndex = -1;
		this.resultsEl.empty();

		if (this.inputEl.value.length === 0) {
			this.setStatus("Type to search. Enter opens a result; Ctrl/Cmd+Enter opens a new tab.");
			return;
		}

		this.setStatus("Waiting to search...");
		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			void this.startSearch(generation, this.inputEl.value);
		}, this.options.settings.debounceMs);
	}

	private async startSearch(generation: number, query: string): Promise<void> {
		const controller = new AbortController();
		this.searchController = controller;
		this.setStatus("Searching...");

		try {
			const count = await runRipgrepSearch({
				query,
				scope: this.options.scope,
				vaultPath: this.options.vaultPath,
				settings: this.options.settings,
				signal: controller.signal,
				onResult: (result) => {
					if (generation !== this.generation || controller.signal.aborted) return;
					this.results.push(result);
					this.renderResult(result, this.results.length - 1);
					if (this.selectedIndex === -1) this.selectResult(0);
				},
			});

			if (generation !== this.generation) return;
			this.searchController = null;
			if (count === 0) this.setStatus("No matches found.");
			else if (count >= this.options.settings.maxResults) {
				this.setStatus(`Showing the first ${String(count)} matching lines.`);
			} else {
				this.setStatus(`${String(count)} matching ${count === 1 ? "line" : "lines"}.`);
			}
		} catch (error) {
			if (generation !== this.generation || controller.signal.aborted) return;
			this.searchController = null;
			const message = error instanceof Error ? error.message : String(error);
			this.setStatus(`Search failed: ${message}`, true);
		}
	}

	private cancelSearch(): void {
		if (this.debounceTimer != null) {
			window.clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		this.searchController?.abort();
		this.searchController = null;
	}

	private renderResult(result: SearchResult, index: number): void {
		const resultEl = this.resultsEl.createDiv({ cls: "reveal-search-result" });
		resultEl.setAttr("role", "option");
		resultEl.dataset.index = String(index);

		const locationEl = resultEl.createDiv({ cls: "reveal-search-location" });
		locationEl.createSpan({ cls: "reveal-search-path", text: result.path });
		locationEl.createSpan({
			cls: "reveal-search-line-number",
			text: `Line ${String(result.line + 1)}`,
		});

		const snippetEl = resultEl.createDiv({ cls: "reveal-search-snippet" });
		let offset = 0;
		for (const range of result.ranges) {
			const from = Math.min(Math.max(range.from, offset), result.lineText.length);
			const to = Math.min(Math.max(range.to, from), result.lineText.length);
			if (from > offset) snippetEl.createSpan({ text: result.lineText.slice(offset, from) });
			if (to > from) {
				snippetEl.createEl("mark", {
					cls: "reveal-search-highlight",
					text: result.lineText.slice(from, to),
				});
			}
			offset = to;
		}
		if (offset < result.lineText.length) {
			snippetEl.createSpan({ text: result.lineText.slice(offset) });
		}

		resultEl.addEventListener("mouseenter", () => this.selectResult(index));
		resultEl.addEventListener("mousedown", (event: MouseEvent) => {
			event.preventDefault();
		});
		resultEl.addEventListener("click", (event: MouseEvent) => {
			void this.chooseResult(index, this.targetFromEvent(event));
		});
	}

	private handleKeydown(event: KeyboardEvent): void {
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				this.moveSelection(1);
				break;
			case "ArrowUp":
				event.preventDefault();
				this.moveSelection(-1);
				break;
			case "Enter":
				if (this.selectedIndex >= 0) {
					event.preventDefault();
					void this.chooseResult(this.selectedIndex, this.targetFromEvent(event));
				}
				break;
		}
	}

	private moveSelection(direction: number): void {
		if (this.results.length === 0) return;
		const next =
			this.selectedIndex < 0
				? 0
				: (this.selectedIndex + direction + this.results.length) % this.results.length;
		this.selectResult(next);
	}

	private selectResult(index: number): void {
		const previous = this.resultsEl.querySelector(".is-selected");
		previous?.removeClass("is-selected");
		previous?.setAttr("aria-selected", "false");

		this.selectedIndex = index;
		const selected = this.resultsEl.querySelector<HTMLElement>(`[data-index="${String(index)}"]`);
		selected?.addClass("is-selected");
		selected?.setAttr("aria-selected", "true");
		selected?.scrollIntoView({ block: "nearest" });
	}

	private async chooseResult(index: number, target: OpenTarget): Promise<void> {
		const result = this.results[index];
		if (result == null) return;
		this.close();
		await this.options.onChoose(result, target);
	}

	private targetFromEvent(event: MouseEvent | KeyboardEvent): OpenTarget {
		if (event.altKey) return "split";
		if (event.metaKey || event.ctrlKey) return "tab";
		return "current";
	}

	private setStatus(message: string, isError = false): void {
		this.statusEl.setText(message);
		this.statusEl.toggleClass("is-error", isError);
	}
}
