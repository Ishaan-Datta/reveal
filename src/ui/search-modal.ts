import { App, Modal, Notice } from "obsidian";

import type {
	OpenTarget,
	RevealSettings,
	SearchResult,
	SearchScope,
} from "../model";
import { runFuzzySearch } from "../search/fuzzy";
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
	private countEl!: HTMLElement;
	private results: SearchResult[] = [];
	private selectedIndex = -1;
	private debounceTimer: number | null = null;
	private searchController: AbortController | null = null;
	private generation = 0;

	constructor(app: App, private readonly options: SearchModalOptions) {
		super(app);
	}

	override onOpen(): void {
		this.modalEl.replaceChildren();
		this.modalEl.addClass("reveal-search-modal", "prompt");
		this.modalEl.removeClass("modal");
		this.modalEl.tabIndex = -1;

		const inputContainerEl = this.modalEl.createDiv({ cls: "reveal-search-input-container" });
		const inputFieldEl = inputContainerEl.createDiv({ cls: "reveal-search-input-field" });
		this.inputEl = inputFieldEl.createEl("input", {
			cls: "prompt-input reveal-search-input",
			type: "text",
			placeholder: "Search...",
			value: this.options.initialQuery,
		});
		this.inputEl.setAttr("aria-label", "Search notes");
		this.inputEl.setAttr("spellcheck", "false");

		this.countEl = inputContainerEl.createSpan({ cls: "reveal-search-count" });
		this.countEl.hidden = true;
		this.resultsEl = this.modalEl.createDiv({ cls: "prompt-results reveal-search-results" });
		this.resultsEl.setAttr("role", "listbox");
		this.resultsEl.addEventListener("mousedown", (event: MouseEvent) => event.preventDefault());

		this.inputEl.addEventListener("input", () => this.queueSearch());
		this.inputEl.addEventListener("keydown", (event: KeyboardEvent) => this.handleKeydown(event));

		this.inputEl.focus();
		this.inputEl.setSelectionRange(this.inputEl.value.length, this.inputEl.value.length);
		this.queueSearch();
	}

	override onClose(): void {
		this.cancelSearch();
		this.modalEl.empty();
		this.options.onClose();
	}

	private queueSearch(): void {
		this.cancelSearch();
		this.generation += 1;
		const generation = this.generation;
		const query = this.inputEl.value;

		if (query.length === 0) {
			this.updateResults([], false, false);
			return;
		}

		this.debounceTimer = window.setTimeout(() => {
			this.debounceTimer = null;
			void this.startSearch(generation, query);
		}, this.options.settings.debounceMs);
	}

	private async startSearch(generation: number, query: string): Promise<void> {
		const controller = new AbortController();
		this.searchController = controller;
		const results: SearchResult[] = [];

		try {
			const summary = await runRipgrepSearch({
				query,
				scope: this.options.scope,
				vaultPath: this.options.vaultPath,
				settings: this.options.settings,
				signal: controller.signal,
				onResult: (result) => {
					if (generation === this.generation && !controller.signal.aborted) results.push(result);
				},
			});

			if (generation !== this.generation || controller.signal.aborted) return;
			if (
				summary.count === 0 &&
				this.options.settings.fuzzyFallback &&
				!this.options.settings.useRegex
			) {
				const fuzzy = await runFuzzySearch({
					query,
					scope: this.options.scope,
					vaultPath: this.options.vaultPath,
					settings: this.options.settings,
					signal: controller.signal,
				});
				if (generation !== this.generation || controller.signal.aborted) return;
				this.searchController = null;
				this.updateResults(fuzzy.results, fuzzy.truncated, true);
				return;
			}

			this.searchController = null;
			this.updateResults(results, summary.truncated, true);
		} catch (error) {
			if (generation !== this.generation || controller.signal.aborted) return;
			this.searchController = null;
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Reveal search failed: ${message}`);
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

	private updateResults(results: SearchResult[], truncated: boolean, showCount: boolean): void {
		this.results = results;
		this.countEl.hidden = !showCount;
		this.countEl.setText(
			truncated ? `${String(this.options.settings.maxResults)}+` : String(results.length),
		);

		for (let index = 0; index < results.length; index += 1) {
			let resultEl = this.resultsEl.children[index] as HTMLElement | undefined;
			if (resultEl == null) resultEl = this.createResultElement();
			this.renderResult(resultEl, results[index] as SearchResult, index);
		}

		while (this.resultsEl.children.length > results.length) {
			this.resultsEl.lastElementChild?.remove();
		}

		this.selectedIndex = results.length > 0 ? 0 : -1;
		this.updateSelection();
	}

	private createResultElement(): HTMLElement {
		const resultEl = this.resultsEl.createDiv({ cls: "suggestion-item reveal-search-result" });
		resultEl.setAttr("role", "option");
		resultEl.addEventListener("mouseenter", () => {
			const index = Number(resultEl.dataset.index);
			if (Number.isInteger(index)) this.selectResult(index);
		});
		resultEl.addEventListener("click", (event: MouseEvent) => {
			const index = Number(resultEl.dataset.index);
			if (Number.isInteger(index)) void this.chooseResult(index, this.targetFromEvent(event));
		});
		return resultEl;
	}

	private renderResult(resultEl: HTMLElement, result: SearchResult, index: number): void {
		resultEl.empty();
		resultEl.dataset.index = String(index);
		resultEl.setAttr("aria-selected", "false");

		const pathSeparator = result.path.lastIndexOf("/");
		const folder = pathSeparator >= 0 ? result.path.slice(0, pathSeparator) : "";
		const filename = result.path.slice(pathSeparator + 1);
		const extensionSeparator = filename.lastIndexOf(".");
		const title = extensionSeparator > 0 ? filename.slice(0, extensionSeparator) : filename;
		const extension = extensionSeparator > 0 ? filename.slice(extensionSeparator) : "";

		const mainEl = resultEl.createDiv({ cls: "reveal-search-result-main" });
		const titleContainerEl = mainEl.createDiv({ cls: "reveal-search-result-title-container" });
		const titleEl = titleContainerEl.createSpan({ cls: "reveal-search-result-title" });
		titleEl.createSpan({ text: title });
		if (extension.length > 0) {
			titleEl.createSpan({ cls: "reveal-search-result-extension", text: extension });
		}
		if (folder.length > 0) {
			mainEl.createDiv({ cls: "reveal-search-result-folder", text: folder });
		}

		const snippetEl = mainEl.createDiv({ cls: "reveal-search-result-body" });
		let offset = 0;
		for (const range of result.ranges) {
			const from = Math.min(Math.max(range.from, offset), result.lineText.length);
			const to = Math.min(Math.max(range.to, from), result.lineText.length);
			if (from > offset) snippetEl.createSpan({ text: result.lineText.slice(offset, from) });
			if (to > from) {
				snippetEl.createSpan({
					cls: "reveal-search-highlight",
					text: result.lineText.slice(from, to),
				});
			}
			offset = to;
		}
		if (offset < result.lineText.length) {
			snippetEl.createSpan({ text: result.lineText.slice(offset) });
		}
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
		if (index < 0 || index >= this.results.length) return;
		this.selectedIndex = index;
		this.updateSelection();
	}

	private updateSelection(): void {
		for (let index = 0; index < this.resultsEl.children.length; index += 1) {
			const resultEl = this.resultsEl.children[index] as HTMLElement;
			const selected = index === this.selectedIndex;
			resultEl.toggleClass("is-selected", selected);
			resultEl.setAttr("aria-selected", String(selected));
		}

		const selected = this.resultsEl.children[this.selectedIndex] as HTMLElement | undefined;
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
}
