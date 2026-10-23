import { describe, expect, test } from "bun:test";

import { findLiteralMatches, queryTerms } from "../src/search/literal-match";

describe("literal term matching", () => {
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
});
