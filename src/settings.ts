import { App, Notice, PluginSettingTab, Setting } from "obsidian";

import type RevealPlugin from "./main";
import type { CaseMode } from "./model";
import { getRipgrepVersion } from "./search/ripgrep";

export class RevealSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly revealPlugin: RevealPlugin) {
		super(app, revealPlugin);
	}

	override display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Ripgrep").setHeading();

		new Setting(containerEl)
			.setName("Executable")
			.setDesc("Command name or absolute path to the ripgrep executable.")
			.addText((text) =>
				text
					.setPlaceholder("rg")
					.setValue(this.revealPlugin.settings.ripgrepPath)
					.onChange(async (value) => {
						this.revealPlugin.settings.ripgrepPath = value.trim() || "rg";
						await this.revealPlugin.saveSettings();
					}),
			)
			.addButton((button) =>
				button.setButtonText("Test").onClick(async () => {
					button.setDisabled(true).setButtonText("Testing...");
					try {
						const version = await getRipgrepVersion(this.revealPlugin.settings.ripgrepPath);
						new Notice(`Reveal found ${version}.`);
					} catch (error) {
						const message = error instanceof Error ? error.message : String(error);
						new Notice(`Reveal could not run ripgrep: ${message}`);
					} finally {
						button.setDisabled(false).setButtonText("Test");
					}
				}),
			);

		new Setting(containerEl)
			.setName("Regular expressions")
			.setDesc("Interpret search queries as ripgrep regular expressions instead of literal text.")
			.addToggle((toggle) =>
				toggle.setValue(this.revealPlugin.settings.useRegex).onChange(async (value) => {
					this.revealPlugin.settings.useRegex = value;
					await this.revealPlugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Fuzzy fallback")
			.setDesc(
				"When a literal search has no exact matches, rank vault lines using fuzzy subsequence matching.",
			)
			.addToggle((toggle) =>
				toggle.setValue(this.revealPlugin.settings.fuzzyFallback).onChange(async (value) => {
					this.revealPlugin.settings.fuzzyFallback = value;
					await this.revealPlugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Case sensitivity")
			.setDesc("Smart case is insensitive unless the query contains an uppercase letter.")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("smart", "Smart case")
					.addOption("insensitive", "Case insensitive")
					.addOption("sensitive", "Case sensitive")
					.setValue(this.revealPlugin.settings.caseMode)
					.onChange(async (value) => {
						this.revealPlugin.settings.caseMode = value as CaseMode;
						await this.revealPlugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Include hidden files")
			.setDesc("Pass --hidden to ripgrep. Hidden directories may contain large amounts of data.")
			.addToggle((toggle) =>
				toggle.setValue(this.revealPlugin.settings.includeHidden).onChange(async (value) => {
					this.revealPlugin.settings.includeHidden = value;
					await this.revealPlugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName("Respect ignore files")
			.setDesc("Honor .gitignore, .ignore, and ripgrep's standard ignore rules.")
			.addToggle((toggle) =>
				toggle.setValue(this.revealPlugin.settings.respectIgnoreFiles).onChange(async (value) => {
					this.revealPlugin.settings.respectIgnoreFiles = value;
					await this.revealPlugin.saveSettings();
				}),
			);

		new Setting(containerEl).setName("Performance").setHeading();
		this.addNumberSetting(
			"Maximum results",
			"Stop each search after this many matching lines.",
			this.revealPlugin.settings.maxResults,
			1,
			5_000,
			(value) => {
				this.revealPlugin.settings.maxResults = value;
			},
		);
		this.addNumberSetting(
			"Debounce delay",
			"Milliseconds to wait after typing before starting ripgrep.",
			this.revealPlugin.settings.debounceMs,
			0,
			2_000,
			(value) => {
				this.revealPlugin.settings.debounceMs = value;
			},
		);
	}

	private addNumberSetting(
		name: string,
		description: string,
		value: number,
		minimum: number,
		maximum: number,
		apply: (value: number) => void,
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(description)
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = String(minimum);
				text.inputEl.max = String(maximum);
				text.setValue(String(value)).onChange(async (input) => {
					const parsed = Number.parseInt(input, 10);
					if (!Number.isFinite(parsed)) return;
					apply(Math.min(Math.max(parsed, minimum), maximum));
					await this.revealPlugin.saveSettings();
				});
			});
	}
}
