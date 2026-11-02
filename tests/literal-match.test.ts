import { describe, expect, test } from "bun:test";

import {
	filterExactMatchRanges,
	findLiteralMatches,
	queryTerms,
} from "../src/search/literal-match";

describe("literal term matching", () => {
	function exactRanges(text: string, query: string) {
		const matches = findLiteralMatches(text, [query], "sensitive", query);
		return filterExactMatchRanges(text, matches.ranges);
	}

	test("splits whitespace and removes equivalent duplicate terms", () => {
		expect(queryTerms(" alpha\tALPHA  beta ", "insensitive")).toEqual(["alpha", "beta"]);
		expect(queryTerms(" Alpha alpha ", "smart")).toEqual(["Alpha", "alpha"]);
	});

	test("finds every term in any order and merges overlapping ranges", () => {
		const matches = findLiteralMatches("beta alphabet alpha", ["alpha", "beta"], "smart", "alpha beta");
		expect([...matches.matchedTerms]).toEqual([0, 1]);
		expect(matches.ranges).toEqual([
			{ from: 0, to: 4 },
			{ from: 5, to: 10 },
			{ from: 14, to: 19 },
		]);
	});

	test("uses smart-case matching for the complete query", () => {
		const matches = findLiteralMatches("alpha beta", ["Alpha", "beta"], "smart", "Alpha beta");
		expect(matches.matchedTerms.size).toBe(1);
	});

	test("uses Unicode case folding without changing highlight offsets", () => {
		const matches = findLiteralMatches("ς x", ["σ", "x"], "smart", "σ x");
		expect([...matches.matchedTerms]).toEqual([0, 1]);
		expect(matches.ranges).toEqual([
			{ from: 0, to: 1 },
			{ from: 2, to: 3 },
		]);
	});

	test("does not treat Unicode titlecase letters as smart-case uppercase", () => {
		const terms = queryTerms("ǅ x", "smart");
		const matches = findLiteralMatches("ǆ x", terms, "smart", "ǅ x");
		expect(matches.matchedTerms.size).toBe(2);
	});

	test("recognizes non-letter Unicode uppercase characters", () => {
		expect(queryTerms("Ⅰ ⅰ", "smart")).toEqual(["Ⅰ", "ⅰ"]);
	});

	test("keeps exact matches next to non-alphanumeric boundaries", () => {
		for (const text of ["ink", "(ink)", "ink-blot", "ink_blob", "🙂ink🙂"]) {
			expect(exactRanges(text, "ink"), text).toHaveLength(1);
		}
		expect(exactRanges("(C++)", "C++")).toHaveLength(1);
		expect(exactRanges("(alpha beta)", "alpha beta")).toHaveLength(1);
	});

	test("rejects exact matches next to Unicode letters or numbers", () => {
		for (const text of ["thinking", "inker", "2ink", "ink2", "éink", "ink中", "ink²"]) {
			expect(exactRanges(text, "ink"), text).toHaveLength(0);
		}
		expect(exactRanges("xalpha beta", "alpha beta")).toHaveLength(0);
		expect(exactRanges("alpha betax", "alpha beta")).toHaveLength(0);
	});

	test("filters individual ranges without changing UTF-16 offsets", () => {
		expect(exactRanges("thinking ink inker 🙂ink🙂", "ink")).toEqual([
			{ from: 9, to: 12 },
			{ from: 21, to: 24 },
		]);
	});
});
