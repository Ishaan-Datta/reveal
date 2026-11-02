import type { CaseMode, MatchRange } from "../model";

export interface LiteralMatches {
	matchedTerms: Set<number>;
	ranges: MatchRange[];
}

const ALPHANUMERIC = /[\p{Letter}\p{Number}]/u;

function codePointBefore(text: string, index: number): string | null {
	if (index <= 0) return null;
	const previous = text.charCodeAt(index - 1);
	const start =
		previous >= 0xdc00 &&
		previous <= 0xdfff &&
		index >= 2 &&
		text.charCodeAt(index - 2) >= 0xd800 &&
		text.charCodeAt(index - 2) <= 0xdbff
			? index - 2
			: index - 1;
	const codePoint = text.codePointAt(start);
	return codePoint == null ? null : String.fromCodePoint(codePoint);
}

function codePointAt(text: string, index: number): string | null {
	const codePoint = text.codePointAt(index);
	return codePoint == null ? null : String.fromCodePoint(codePoint);
}

function isAlphanumeric(character: string | null): boolean {
	return character != null && ALPHANUMERIC.test(character);
}

export function filterExactMatchRanges(
	text: string,
	ranges: readonly MatchRange[],
): MatchRange[] {
	return ranges.filter(
		(range) =>
			!isAlphanumeric(codePointBefore(text, range.from)) &&
			!isAlphanumeric(codePointAt(text, range.to)),
	);
}

export function isCaseSensitive(query: string, mode: CaseMode): boolean {
	if (mode === "sensitive") return true;
	if (mode === "insensitive") return false;
	return /\p{Uppercase}/u.test(query);
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function termsAreEquivalent(left: string, right: string, caseSensitive: boolean): boolean {
	if (caseSensitive) return left === right;
	return new RegExp(`^(?:${escapeRegExp(left)})$`, "iu").test(right);
}

export function queryTerms(query: string, mode: CaseMode): string[] {
	const caseSensitive = isCaseSensitive(query, mode);
	const terms: string[] = [];
	for (const term of query.trim().split(/\s+/u)) {
		if (term.length === 0) continue;
		if (terms.some((existing) => termsAreEquivalent(existing, term, caseSensitive))) continue;
		terms.push(term);
	}
	return terms;
}

export function findLiteralMatches(
	text: string,
	terms: readonly string[],
	caseMode: CaseMode,
	query: string,
): LiteralMatches {
	const caseSensitive = isCaseSensitive(query, caseMode);
	const matchedTerms = new Set<number>();
	const ranges: MatchRange[] = [];

	for (let termIndex = 0; termIndex < terms.length; termIndex += 1) {
		const term = terms[termIndex] as string;
		const expression = new RegExp(escapeRegExp(term), caseSensitive ? "gu" : "giu");
		for (const match of text.matchAll(expression)) {
			const index = match.index;
			const value = match[0];
			matchedTerms.add(termIndex);
			ranges.push({ from: index, to: index + value.length });
		}
	}

	ranges.sort((left, right) => left.from - right.from || left.to - right.to);
	const merged: MatchRange[] = [];
	for (const range of ranges) {
		const previous = merged[merged.length - 1];
		if (previous != null && range.from <= previous.to) previous.to = Math.max(previous.to, range.to);
		else merged.push({ ...range });
	}
	return { matchedTerms, ranges: merged };
}
