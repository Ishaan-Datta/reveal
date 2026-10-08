import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_SETTINGS } from "../src/model";
import { runFuzzySearch, scoreFuzzyMatch } from "../src/search/fuzzy";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map(async (directory) => {
			await rm(directory, { recursive: true, force: true });
		}),
	);
});

describe("scoreFuzzyMatch", () => {
	test("matches query characters in order and returns highlight ranges", () => {
		const match = scoreFuzzyMatch("apb", "alpha beta", "insensitive");
		expect(match).not.toBeNull();
		expect(match?.ranges).toEqual([
			{ from: 0, to: 1 },
			{ from: 2, to: 3 },
			{ from: 6, to: 7 },
		]);
	});

	test("ranks consecutive matches above matches with gaps", () => {
		const consecutive = scoreFuzzyMatch("abc", "abc", "insensitive");
		const gapped = scoreFuzzyMatch("abc", "a---b---c", "insensitive");
		expect(consecutive).not.toBeNull();
		expect(gapped).not.toBeNull();
		expect(consecutive?.score ?? 0).toBeGreaterThan(gapped?.score ?? 0);
	});

	test("uses uppercase letters to make smart-case queries sensitive", () => {
		expect(scoreFuzzyMatch("ABC", "abc", "smart")).toBeNull();
		expect(scoreFuzzyMatch("abc", "ABC", "smart")).not.toBeNull();
	});

	test("returns UTF-16 ranges for non-BMP characters", () => {
		expect(scoreFuzzyMatch("🙂n", "x🙂 needle", "insensitive")?.ranges).toEqual([
			{ from: 1, to: 3 },
			{ from: 4, to: 5 },
		]);
	});
});

describe("runFuzzySearch", () => {
	test("uses ripgrep to enumerate and rank matching vault lines", async () => {
		const directory = await mkdtemp(join(tmpdir(), "reveal-fuzzy-test-"));
		temporaryDirectories.push(directory);
		await writeFile(join(directory, "First.md"), "A needle in this line\n");
		await writeFile(join(directory, "Second.md"), "n very distant d and l then e\n");

		const search = await runFuzzySearch({
			query: "ndle",
			scope: { type: "vault" },
			vaultPath: directory,
			settings: DEFAULT_SETTINGS,
			signal: new AbortController().signal,
		});

		expect(search.truncated).toBe(false);
		expect(search.results).toHaveLength(2);
		expect(search.results[0]?.path).toBe("First.md");
		expect(search.results[0]?.ranges).toEqual([
			{ from: 2, to: 3 },
			{ from: 5, to: 8 },
		]);
	});

	test("reports when matching lines exceed the result limit", async () => {
		const directory = await mkdtemp(join(tmpdir(), "reveal-fuzzy-test-"));
		temporaryDirectories.push(directory);
		await writeFile(join(directory, "Note.md"), "alpha beta\nalpine beta\nample beta\n");

		const search = await runFuzzySearch({
			query: "ab",
			scope: { type: "vault" },
			vaultPath: directory,
			settings: { ...DEFAULT_SETTINGS, maxResults: 2 },
			signal: new AbortController().signal,
		});

		expect(search.results).toHaveLength(2);
		expect(search.truncated).toBe(true);
	});
});
