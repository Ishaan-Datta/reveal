import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { DEFAULT_SETTINGS, type SearchMode } from "../src/model";
import { runSearch, type SearchResults } from "../src/search/search";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map(async (directory) => {
			await rm(directory, { recursive: true, force: true });
		}),
	);
});

async function createVault(): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), "reveal-search-test-"));
	temporaryDirectories.push(directory);
	await writeFile(
		join(directory, "Combined.md"),
		["alpha only", "beta before alpha", "gamma only", "alphabet soup"].join("\n"),
	);
	await writeFile(join(directory, "Alpha.md"), "alpha only\n");
	await writeFile(join(directory, "Gamma.md"), "gamma only\n");
	return directory;
}

async function search(
	vaultPath: string,
	mode: SearchMode,
	query: string,
	compactMode = false,
	maxResults = 200,
): Promise<SearchResults> {
	return runSearch({
		query,
		mode,
		compactMode,
		scope: { type: "vault" },
		vaultPath,
		settings: { ...DEFAULT_SETTINGS, maxResults },
		signal: new AbortController().signal,
	});
}

describe("mode-aware search", () => {
	test("keeps exact phrase and regex searches distinct", async () => {
		const vaultPath = await createVault();
		const exact = await search(vaultPath, "exact", "alpha.*gamma");
		const regex = await search(vaultPath, "regex", "alpha.*only");

		expect(exact).toEqual({ type: "lines", results: [], truncated: false });
		expect(regex.type).toBe("lines");
		if (regex.type === "lines") expect(regex.results).toHaveLength(2);
	});

	test("requires all terms on one line in any order", async () => {
		const vaultPath = await createVault();
		const result = await search(vaultPath, "all-line", "alpha beta");

		expect(result.type).toBe("lines");
		if (result.type !== "lines") return;
		expect(result.results.map(({ path, line }) => ({ path, line }))).toEqual([
			{ path: "Combined.md", line: 1 },
		]);
		expect(result.results[0]?.ranges).toEqual([
			{ from: 0, to: 4 },
			{ from: 12, to: 17 },
		]);
	});

	test("applies the line result limit after term qualification", async () => {
		const vaultPath = await createVault();
		const result = await search(vaultPath, "all-line", "alpha beta", false, 1);

		expect(result.type).toBe("lines");
		if (result.type === "lines") {
			expect(result.results).toHaveLength(1);
			expect(result.truncated).toBe(false);
		}
	});

	test("qualifies words across a file but not across separate files", async () => {
		const vaultPath = await createVault();
		const detailed = await search(vaultPath, "all-file", "alpha gamma");
		const compact = await search(vaultPath, "all-file", "alpha gamma", true);

		expect(detailed.type).toBe("lines");
		if (detailed.type === "lines") {
			expect(detailed.results.map((result) => result.path)).toEqual([
				"Combined.md",
				"Combined.md",
				"Combined.md",
				"Combined.md",
			]);
		}
		expect(compact).toMatchObject({
			type: "files",
			results: [{ result: { path: "Combined.md" }, matchCount: 4 }],
		});
	});

	test("runs fuzzy only when that mode is selected", async () => {
		const vaultPath = await createVault();
		const exact = await search(vaultPath, "exact", "aps");
		const fuzzy = await search(vaultPath, "fuzzy", "aps");

		expect(exact).toEqual({ type: "lines", results: [], truncated: false });
		expect(fuzzy.type).toBe("lines");
		if (fuzzy.type === "lines") expect(fuzzy.results.length).toBeGreaterThan(0);
	});
});
