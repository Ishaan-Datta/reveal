import { Notice, MarkdownView, TFile, type App, type EditorPosition } from "obsidian";

import type { OpenTarget, SearchResult } from "./model";

export async function openSearchResult(
	app: App,
	result: SearchResult,
	target: OpenTarget,
): Promise<void> {
	const abstractFile = app.vault.getAbstractFileByPath(result.path);
	if (!(abstractFile instanceof TFile)) {
		new Notice(`Reveal could not find ${result.path}.`);
		return;
	}

	const leaf = app.workspace.getLeaf(target === "current" ? false : target);
	await leaf.openFile(abstractFile, { active: true });

	if (!(leaf.view instanceof MarkdownView)) {
		new Notice("Reveal opened the result, but could not select the matching text.");
		return;
	}

	const editor = leaf.view.editor;
	const lastLine = Math.max(0, editor.lineCount() - 1);
	const line = Math.min(Math.max(result.line, 0), lastLine);
	const lineLength = editor.getLine(line).length;
	const firstRange = result.ranges[0];
	const fromCharacter = Math.min(Math.max(firstRange?.from ?? 0, 0), lineLength);
	const toCharacter = Math.min(
		Math.max(firstRange?.to ?? fromCharacter, fromCharacter),
		lineLength,
	);
	const from: EditorPosition = { line, ch: fromCharacter };
	const to: EditorPosition = { line, ch: toCharacter };

	editor.setSelection(from, to);
	editor.scrollIntoView({ from, to }, true);
	editor.focus();
}
