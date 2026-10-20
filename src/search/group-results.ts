import type { FileSearchResult, SearchResult } from "../model";

export function addFileSearchResult(
	files: Map<string, FileSearchResult>,
	result: SearchResult,
): void {
	const existing = files.get(result.path);
	if (existing == null) {
		files.set(result.path, { result, matchCount: 1 });
		return;
	}

	existing.matchCount += 1;
}

export function groupSearchResults(results: SearchResult[]): FileSearchResult[] {
	const files = new Map<string, FileSearchResult>();
	for (const result of results) addFileSearchResult(files, result);
	return [...files.values()];
}
