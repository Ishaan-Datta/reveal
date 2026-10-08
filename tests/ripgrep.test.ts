import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_SETTINGS } from "../src/model";
import { buildRipgrepArgs, runRipgrepSearch } from "../src/search/ripgrep";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map(async (directory) => {
			await rm(directory, { recursive: true, force: true });
		}),
	);
});

describe("buildRipgrepArgs", () => {
	test("builds a literal vault search with a safe query argument", () => {
		const args = buildRipgrepArgs("-draft", { type: "vault" }, DEFAULT_SETTINGS);
		expect(args).toContain("--fixed-strings");
		expect(args).toContain("--smart-case");
		expect(args.slice(-3)).toEqual(["-draft", "--", "."]);
		expect(args).toContain("*.md");
	});

	test("targets only the selected file in regex mode", () => {
		const args = buildRipgrepArgs(
			"one|two",
			{ type: "file", path: "Folder/Note.md" },
			{ ...DEFAULT_SETTINGS, useRegex: true, caseMode: "sensitive" },
		);
		expect(args).not.toContain("--fixed-strings");
		expect(args).toContain("--case-sensitive");
		expect(args.slice(-3)).toEqual(["one|two", "--", "Folder/Note.md"]);
	});
});

describe("runRipgrepSearch", () => {
	test("searches Markdown files and reports Unicode positions", async () => {
		const directory = await mkdtemp(join(tmpdir(), "reveal-test-"));
		temporaryDirectories.push(directory);
		await writeFile(join(directory, "Note.md"), "first\n🙂 Needle here\n");
		await writeFile(join(directory, "ignored.txt"), "Needle\n");
		const results: Array<{ path: string; line: number; from: number }> = [];

		const summary = await runRipgrepSearch({
			query: "Needle",
			scope: { type: "vault" },
			vaultPath: directory,
			settings: DEFAULT_SETTINGS,
			signal: new AbortController().signal,
			onResult: (result) => {
				results.push({
					path: result.path,
					line: result.line,
					from: result.ranges[0]?.from ?? -1,
				});
			},
		});

		expect(summary).toEqual({ count: 1, truncated: false });
		expect(results).toEqual([{ path: "Note.md", line: 1, from: 3 }]);
	});

	test("treats ripgrep's no-match status as an empty result", async () => {
		const directory = await mkdtemp(join(tmpdir(), "reveal-test-"));
		temporaryDirectories.push(directory);
		await writeFile(join(directory, "Note.md"), "nothing here\n");

		const summary = await runRipgrepSearch({
			query: "missing",
			scope: { type: "vault" },
			vaultPath: directory,
			settings: DEFAULT_SETTINGS,
			signal: new AbortController().signal,
			onResult: () => undefined,
		});

		expect(summary).toEqual({ count: 0, truncated: false });
	});

	test("reports truncation only after observing a result beyond the limit", async () => {
		const directory = await mkdtemp(join(tmpdir(), "reveal-test-"));
		temporaryDirectories.push(directory);
		await writeFile(join(directory, "Note.md"), "match one\nmatch two\nmatch three\n");
		const results: string[] = [];

		const summary = await runRipgrepSearch({
			query: "match",
			scope: { type: "vault" },
			vaultPath: directory,
			settings: { ...DEFAULT_SETTINGS, maxResults: 2 },
			signal: new AbortController().signal,
			onResult: (result) => results.push(result.lineText),
		});

		expect(summary).toEqual({ count: 2, truncated: true });
		expect(results).toEqual(["match one", "match two"]);
	});

	test("does not report truncation when the result count equals the limit", async () => {
		const directory = await mkdtemp(join(tmpdir(), "reveal-test-"));
		temporaryDirectories.push(directory);
		await writeFile(join(directory, "Note.md"), "match one\nmatch two\n");

		const summary = await runRipgrepSearch({
			query: "match",
			scope: { type: "vault" },
			vaultPath: directory,
			settings: { ...DEFAULT_SETTINGS, maxResults: 2 },
			signal: new AbortController().signal,
			onResult: () => undefined,
		});

		expect(summary).toEqual({ count: 2, truncated: false });
	});
});
