import { describe, expect, test } from "bun:test";

import {
	byteOffsetToStringIndex,
	normalizeVaultPath,
	parseRipgrepLine,
	RipgrepJsonParser,
} from "../src/search/ripgrep-json";

function matchMessage(text: string, start: number, end: number): string {
	return JSON.stringify({
		type: "match",
		data: {
			path: { text: "Notes/Unicode.md" },
			lines: { text },
			line_number: 4,
			submatches: [{ match: { text: "match" }, start, end }],
		},
	});
}

describe("byteOffsetToStringIndex", () => {
	test("converts UTF-8 byte offsets to UTF-16 string indexes", () => {
		const text = "a🙂éz";
		expect(byteOffsetToStringIndex(text, 1)).toBe(1);
		expect(byteOffsetToStringIndex(text, 5)).toBe(3);
		expect(byteOffsetToStringIndex(text, 7)).toBe(4);
	});
});

describe("normalizeVaultPath", () => {
	test("normalizes relative ripgrep paths", () => {
		expect(normalizeVaultPath("./Folder\\Note.md")).toBe("Folder/Note.md");
	});

	test("rejects paths outside the vault", () => {
		expect(normalizeVaultPath("../Note.md")).toBeNull();
		expect(normalizeVaultPath("/tmp/Note.md")).toBeNull();
		expect(normalizeVaultPath("C:\\Notes\\Note.md")).toBeNull();
	});
});

describe("parseRipgrepLine", () => {
	test("returns one matching line with converted ranges", () => {
		const result = parseRipgrepLine(matchMessage("a🙂needle\n", 5, 11));
		expect(result).toEqual({
			path: "Notes/Unicode.md",
			line: 3,
			lineText: "a🙂needle",
			ranges: [{ from: 3, to: 9 }],
		});
	});

	test("ignores non-match messages", () => {
		expect(parseRipgrepLine('{"type":"summary","data":{}}')).toBeNull();
	});
});

describe("RipgrepJsonParser", () => {
	test("handles JSON lines and UTF-8 characters split across chunks", () => {
		const output = `${matchMessage("🙂 match\n", 5, 10)}\n${JSON.stringify({ type: "summary" })}\n`;
		const bytes = Buffer.from(output);
		const splitAt = Buffer.from(output.slice(0, output.indexOf("🙂"))).length + 2;
		const results: unknown[] = [];
		const parser = new RipgrepJsonParser((result) => results.push(result));

		parser.push(bytes.subarray(0, splitAt));
		parser.push(bytes.subarray(splitAt));
		parser.finish();

		expect(results).toHaveLength(1);
	});

	test("parses a final line without a newline", () => {
		const results: unknown[] = [];
		const parser = new RipgrepJsonParser((result) => results.push(result));
		parser.push(Buffer.from(matchMessage("match", 0, 5)));
		parser.finish();
		expect(results).toHaveLength(1);
	});
});
