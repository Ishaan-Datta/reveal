import {
	FileSystemAdapter,
	MarkdownView,
	Notice,
	Plugin,
} from "obsidian";

import { DEFAULT_SETTINGS, type RevealSettings, type SearchScope } from "./model";
import { openSearchResult } from "./navigation";
import { RevealSettingTab } from "./settings";
import { RevealSearchModal } from "./ui/search-modal";

export default class RevealPlugin extends Plugin {
	override settings: RevealSettings = { ...DEFAULT_SETTINGS };
	private activeModal: RevealSearchModal | null = null;

	override async onload(): Promise<void> {
		await this.loadSettings();

		this.addCommand({
			id: "search-vault",
			name: "Search vault",
			callback: () => this.openVaultSearch(),
		});

		this.addCommand({
			id: "search-current-file",
			name: "Search current file",
			checkCallback: (checking) => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (view?.file == null) return false;
				if (!checking) void this.openCurrentFileSearch(view);
				return true;
			},
		});

		this.addRibbonIcon("search", "Search vault with Reveal", () => this.openVaultSearch());
		this.addSettingTab(new RevealSettingTab(this.app, this));
	}

	override onunload(): void {
		this.activeModal?.close();
		this.activeModal = null;
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	private async loadSettings(): Promise<void> {
		const loaded = (await this.loadData()) as Partial<RevealSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...loaded };
	}

	private openVaultSearch(): void {
		this.openSearch({ type: "vault" }, this.getSelectedText());
	}

	private async openCurrentFileSearch(view: MarkdownView): Promise<void> {
		const file = view.file;
		if (file == null) return;

		const initialQuery = this.getSelectedText(view);
		try {
			await view.save();
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error.";
			new Notice(`Reveal could not save the current file: ${message}`);
			return;
		}
		this.openSearch({ type: "file", path: file.path }, initialQuery);
	}

	private openSearch(scope: SearchScope, initialQuery: string): void {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			new Notice("Reveal is only available for filesystem-backed desktop vaults.");
			return;
		}

		this.activeModal?.close();
		const modal = new RevealSearchModal(this.app, {
			vaultPath: adapter.getBasePath(),
			scope,
			settings: { ...this.settings },
			initialQuery,
			onChoose: async (result, target) => {
				try {
					await openSearchResult(this.app, result, target);
				} catch (error) {
					const message = error instanceof Error ? error.message : "Unknown error.";
					new Notice(`Reveal could not open the result: ${message}`);
				}
			},
			onClose: () => {
				if (this.activeModal === modal) this.activeModal = null;
			},
		});
		this.activeModal = modal;
		modal.open();
	}

	private getSelectedText(view?: MarkdownView): string {
		const markdownView = view ?? this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView == null) return "";
		return markdownView.editor.getSelection().replace(/\s*\r?\n\s*/g, " ").slice(0, 500);
	}
}
