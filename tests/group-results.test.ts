import { describe, expect, test } from "bun:test";

import type { SearchResult } from "../src/model";
import { groupSearchResults } from "../src/search/group-results";

function result(path: string, line: number): SearchResult {
	return {
		path,
		line,
		lineText: `line ${String(line)}`,
		ranges: [{ from: 0, to: 4 }],
	};
}

describe("groupSearchResults", () => {
	test("groups matching lines by file in first-seen order", () => {
		const first = result("Folder/First.md", 2);
		const grouped = groupSearchResults([
			first,
			result("Second.md", 4),
			result("Folder/First.md", 8),
		]);

		expect(grouped).toEqual([
			{ result: first, matchCount: 2 },
			{ result: result("Second.md", 4), matchCount: 1 },
		]);
	});

	test("counts matching lines rather than ranges on a line", () => {
		const line = result("Note.md", 3);
		line.ranges = [
			{ from: 0, to: 1 },
			{ from: 2, to: 3 },
		];

		expect(groupSearchResults([line])).toEqual([{ result: line, matchCount: 1 }]);
	});
});
