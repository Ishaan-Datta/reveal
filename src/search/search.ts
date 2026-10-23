import type {
	FileSearchResult,
	RevealSettings,
	SearchMode,
	SearchResult,
	SearchScope,
} from "../model";
import { runFuzzySearch } from "./fuzzy";
import { addFileSearchResult } from "./group-results";
import { findLiteralMatches, queryTerms } from "./literal-match";
import { runRipgrepSearch } from "./ripgrep";

export type SearchResults =
	| { type: "lines"; results: SearchResult[]; truncated: boolean }
	| { type: "files"; results: FileSearchResult[] };

export interface SearchRequest {
	query: string;
	mode: SearchMode;
	compactMode: boolean;
	scope: SearchScope;
	vaultPath: string;
	settings: RevealSettings;
	signal: AbortSignal;
}

async function runLineSearch(
	request: SearchRequest,
	options: {
		query?: string | readonly string[];
		useRegex?: boolean;
		transformResult?: (result: SearchResult) => SearchResult | null;
	} = {},
): Promise<SearchResults> {
	const results: SearchResult[] = [];
	const fileResults = new Map<string, FileSearchResult>();
	const summary = await runRipgrepSearch({
		query: options.query ?? request.query,
		scope: request.scope,
		vaultPath: request.vaultPath,
		settings: request.settings,
		signal: request.signal,
		useRegex: options.useRegex ?? false,
		onResult: (result) => {
			if (request.compactMode) addFileSearchResult(fileResults, result);
			else results.push(result);
		},
		...(options.transformResult == null ? {} : { transformResult: options.transformResult }),
		...(request.compactMode ? { maxResults: null } : {}),
	});

	return request.compactMode
		? { type: "files", results: [...fileResults.values()] }
		: { type: "lines", results, truncated: summary.truncated };
}

function allTermsOnLineTransform(
	query: string,
	terms: readonly string[],
	settings: RevealSettings,
): (result: SearchResult) => SearchResult | null {
	return (result) => {
		const matches = findLiteralMatches(result.lineText, terms, settings.caseMode, query);
		if (matches.matchedTerms.size !== terms.length) return null;
		return { ...result, ranges: matches.ranges };
	};
}

async function runAllFileSearch(request: SearchRequest): Promise<SearchResults> {
	const terms = queryTerms(request.query, request.settings.caseMode);
	if (terms.length === 0) {
		return request.compactMode
			? { type: "files", results: [] }
			: { type: "lines", results: [], truncated: false };
	}

	interface FileMatch {
		result: SearchResult;
		matchCount: number;
		matchedTerms: Set<number>;
	}
	const files = new Map<string, FileMatch>();
	await runRipgrepSearch({
		query: terms,
		scope: request.scope,
		vaultPath: request.vaultPath,
		settings: request.settings,
		signal: request.signal,
		maxResults: null,
		onResult: (result) => {
			const matches = findLiteralMatches(
				result.lineText,
				terms,
				request.settings.caseMode,
				request.query,
			);
			const existing = files.get(result.path);
			if (existing == null) {
				files.set(result.path, {
					result: { ...result, ranges: matches.ranges },
					matchCount: 1,
					matchedTerms: matches.matchedTerms,
				});
				return;
			}
			existing.matchCount += 1;
			for (const term of matches.matchedTerms) existing.matchedTerms.add(term);
		},
	});

	const qualifying = [...files.entries()].filter(([, match]) => match.matchedTerms.size === terms.length);
	if (request.compactMode) {
		return {
			type: "files",
			results: qualifying.map(([, match]) => ({
				result: match.result,
				matchCount: match.matchCount,
			})),
		};
	}

	const qualifyingPaths = new Set(qualifying.map(([path]) => path));
	if (qualifyingPaths.size === 0) return { type: "lines", results: [], truncated: false };
	return runLineSearch(request, {
		query: terms,
		transformResult: (result) => {
			if (!qualifyingPaths.has(result.path)) return null;
			const matches = findLiteralMatches(
				result.lineText,
				terms,
				request.settings.caseMode,
				request.query,
			);
			return { ...result, ranges: matches.ranges };
		},
	});
}

export async function runSearch(request: SearchRequest): Promise<SearchResults> {
	switch (request.mode) {
		case "exact":
			return runLineSearch(request);
		case "regex":
			return runLineSearch(request, { useRegex: true });
		case "all-line": {
			const terms = queryTerms(request.query, request.settings.caseMode);
			if (terms.length === 0) {
				return request.compactMode
					? { type: "files", results: [] }
					: { type: "lines", results: [], truncated: false };
			}
			return runLineSearch(request, {
				query: terms,
				transformResult: allTermsOnLineTransform(request.query, terms, request.settings),
			});
		}
		case "all-file":
			return runAllFileSearch(request);
		case "fuzzy": {
			const fuzzy = await runFuzzySearch({
				query: request.query,
				scope: request.scope,
				vaultPath: request.vaultPath,
				settings: request.settings,
				signal: request.signal,
				includeFileResults: request.compactMode,
			});
			return request.compactMode
				? { type: "files", results: fuzzy.fileResults }
				: { type: "lines", results: fuzzy.results, truncated: fuzzy.truncated };
		}
	}
}
