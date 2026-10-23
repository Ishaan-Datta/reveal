import type { SearchMode, SearchScope } from "../model";

const FILE_MODES: readonly SearchMode[] = ["exact", "regex", "all-line", "fuzzy"];
const VAULT_MODES: readonly SearchMode[] = [
	"exact",
	"regex",
	"all-line",
	"all-file",
	"fuzzy",
];

export const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
	exact: "Exact",
	regex: "Regex",
	"all-line": "All words: line",
	"all-file": "All words: file",
	fuzzy: "Fuzzy",
};

export function availableSearchModes(scope: SearchScope): readonly SearchMode[] {
	return scope.type === "vault" ? VAULT_MODES : FILE_MODES;
}

export function nextSearchMode(
	mode: SearchMode,
	scope: SearchScope,
	direction: 1 | -1 = 1,
): SearchMode {
	const modes = availableSearchModes(scope);
	const currentIndex = modes.indexOf(mode);
	const index = currentIndex < 0 ? 0 : (currentIndex + direction + modes.length) % modes.length;
	return modes[index] as SearchMode;
}
