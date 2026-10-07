export type CaseMode = "smart" | "sensitive" | "insensitive";

export interface RevealSettings {
	ripgrepPath: string;
	useRegex: boolean;
	fuzzyFallback: boolean;
	caseMode: CaseMode;
	maxResults: number;
	debounceMs: number;
	includeHidden: boolean;
	respectIgnoreFiles: boolean;
}

export const DEFAULT_SETTINGS: RevealSettings = {
	ripgrepPath: "rg",
	useRegex: false,
	fuzzyFallback: true,
	caseMode: "smart",
	maxResults: 200,
	debounceMs: 150,
	includeHidden: false,
	respectIgnoreFiles: true,
};

export type SearchScope =
	| { type: "vault" }
	| { type: "file"; path: string };

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

export type OpenTarget = "current" | "tab" | "split";
