import type {
	CaseMode,
	MatchRange,
	RevealSettings,
	SearchResult,
	SearchScope,
} from "../model";
import { runRipgrepSearch } from "./ripgrep";

interface IndexedCharacter {
	value: string;
	from: number;
	to: number;
}

interface ScoredMatch {
	result: SearchResult;
	score: number;
}

export interface FuzzySearchRequest {
	query: string;
	scope: SearchScope;
	vaultPath: string;
	settings: RevealSettings;
	signal: AbortSignal;
}

function indexedCharacters(text: string): IndexedCharacter[] {
	const characters: IndexedCharacter[] = [];
	for (let index = 0; index < text.length; ) {
		const codePoint = text.codePointAt(index);
		if (codePoint == null) break;
		const value = String.fromCodePoint(codePoint);
		characters.push({ value, from: index, to: index + value.length });
		index += value.length;
	}
	return characters;
}

function isCaseSensitive(query: string, mode: CaseMode): boolean {
	if (mode === "sensitive") return true;
	if (mode === "insensitive") return false;
	return query !== query.toLocaleLowerCase();
}

function combineRanges(characters: IndexedCharacter[]): MatchRange[] {
	const ranges: MatchRange[] = [];
	for (const character of characters) {
		const previous = ranges[ranges.length - 1];
		if (previous != null && previous.to === character.from) previous.to = character.to;
		else ranges.push({ from: character.from, to: character.to });
	}
	return ranges;
}

function isWordBoundary(text: string, index: number): boolean {
	return index === 0 || /[\s\-_/.[\](){}'"`]/.test(text[index - 1] ?? "");
}

export function scoreFuzzyMatch(
	query: string,
	candidate: string,
	caseMode: CaseMode,
): { score: number; ranges: MatchRange[] } | null {
	const queryCharacters = indexedCharacters(query);
	const candidateCharacters = indexedCharacters(candidate);
	if (queryCharacters.length === 0 || candidateCharacters.length === 0) return null;

	const caseSensitive = isCaseSensitive(query, caseMode);
	const normalize = (value: string): string =>
		caseSensitive ? value : value.toLocaleLowerCase();
	const matched: IndexedCharacter[] = [];
	let candidateIndex = 0;
	let previousIndex = -2;
	let score = 0;

	for (const queryCharacter of queryCharacters) {
		const expected = normalize(queryCharacter.value);
		while (
			candidateIndex < candidateCharacters.length &&
			normalize(candidateCharacters[candidateIndex]?.value ?? "") !== expected
		) {
			candidateIndex += 1;
		}

		const character = candidateCharacters[candidateIndex];
		if (character == null) return null;

		matched.push(character);
		score += 10;
		if (candidateIndex === previousIndex + 1) score += 14;
		else if (previousIndex >= 0) score -= candidateIndex - previousIndex - 1;
		if (isWordBoundary(candidate, character.from)) score += 8;

		previousIndex = candidateIndex;
		candidateIndex += 1;
	}

	const firstIndex = candidateCharacters.indexOf(matched[0] as IndexedCharacter);
	score -= firstIndex * 0.25;
	score += (queryCharacters.length / candidateCharacters.length) * 10;

	return { score, ranges: combineRanges(matched) };
}

function compareMatches(left: ScoredMatch, right: ScoredMatch): number {
	if (left.score !== right.score) return right.score - left.score;
	const pathComparison = left.result.path.localeCompare(right.result.path);
	return pathComparison !== 0 ? pathComparison : left.result.line - right.result.line;
}

export async function runFuzzySearch(request: FuzzySearchRequest): Promise<SearchResult[]> {
	const limit = Math.max(1, request.settings.maxResults);
	const matches: ScoredMatch[] = [];

	await runRipgrepSearch({
		query: "^.*\\S.*$",
		scope: request.scope,
		vaultPath: request.vaultPath,
		settings: {
			...request.settings,
			useRegex: true,
			caseMode: "sensitive",
			maxResults: Number.MAX_SAFE_INTEGER,
		},
		signal: request.signal,
		onResult: (result) => {
			const fuzzyMatch = scoreFuzzyMatch(
				request.query,
				result.lineText,
				request.settings.caseMode,
			);
			if (fuzzyMatch == null) return;

			matches.push({
				score: fuzzyMatch.score,
				result: { ...result, ranges: fuzzyMatch.ranges },
			});

			if (matches.length >= limit * 4) {
				matches.sort(compareMatches);
				matches.length = limit * 2;
			}
		},
	});

	matches.sort(compareMatches);
	return matches.slice(0, limit).map(({ result }) => result);
}
