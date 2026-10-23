import { describe, expect, test } from "bun:test";

import { availableSearchModes, nextSearchMode } from "../src/search/modes";

describe("search modes", () => {
	test("includes same-file search only for vault scope", () => {
		expect(availableSearchModes({ type: "vault" })).toEqual([
			"exact",
			"regex",
			"all-line",
			"all-file",
			"fuzzy",
		]);
		expect(availableSearchModes({ type: "file", path: "Note.md" })).toEqual([
			"exact",
			"regex",
			"all-line",
			"fuzzy",
		]);
	});

	test("cycles in both directions and wraps", () => {
		const scope = { type: "vault" } as const;
		expect(nextSearchMode("exact", scope)).toBe("regex");
		expect(nextSearchMode("exact", scope, -1)).toBe("fuzzy");
		expect(nextSearchMode("fuzzy", scope)).toBe("exact");
	});
});
