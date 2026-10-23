export type CaseMode = "smart" | "sensitive" | "insensitive";

export interface RevealSettings {
	ripgrepPath: string;
	caseMode: CaseMode;
	maxResults: number;
	debounceMs: number;
	includeHidden: boolean;
	respectIgnoreFiles: boolean;
	compactVaultSearch: boolean;
}

export const DEFAULT_SETTINGS: RevealSettings = {
	ripgrepPath: "rg",
	caseMode: "smart",
	maxResults: 200,
	debounceMs: 150,
	includeHidden: false,
	respectIgnoreFiles: true,
	compactVaultSearch: false,
};

export type SearchScope =
	| { type: "vault" }
	| { type: "file"; path: string };

export type SearchMode = "exact" | "regex" | "all-line" | "all-file" | "fuzzy";

export interface MatchRange {
	from: number;
	to: number;
}

export interface SearchResult {
	path: string;
	line: number;
	lineText: string;
	ranges: MatchRange[];
}

export interface FileSearchResult {
	result: SearchResult;
	matchCount: number;
}

export type OpenTarget = "current" | "tab" | "split";
