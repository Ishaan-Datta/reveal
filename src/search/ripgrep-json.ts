import { StringDecoder } from "node:string_decoder";

import type { MatchRange, SearchResult } from "../model";

interface RipgrepText {
	text?: string;
	bytes?: string;
}

interface RipgrepSubmatch {
	start: number;
	end: number;
}

interface RipgrepMatchData {
	path: RipgrepText;
	lines: RipgrepText;
	line_number: number | null;
	submatches: RipgrepSubmatch[];
}

interface RipgrepMessage {
	type: string;
	data?: RipgrepMatchData;
}

function decodeText(value: RipgrepText): string {
	if (typeof value.text === "string") return value.text;
	if (typeof value.bytes === "string") {
		return Buffer.from(value.bytes, "base64").toString("utf8");
	}
	throw new Error("Ripgrep returned text in an unsupported format.");
}

export function byteOffsetToStringIndex(text: string, byteOffset: number): number {
	if (byteOffset <= 0) return 0;

	let bytes = 0;
	let stringIndex = 0;
	for (const character of text) {
		const characterBytes = Buffer.byteLength(character, "utf8");
		if (bytes + characterBytes > byteOffset) break;
		bytes += characterBytes;
		stringIndex += character.length;
	}
	return stringIndex;
}

export function normalizeVaultPath(path: string): string | null {
	const normalized = path.replaceAll("\\", "/").replace(/^\.\/+/, "");
	if (
		normalized.length === 0 ||
		normalized.startsWith("/") ||
		/^[A-Za-z]:\//.test(normalized) ||
		normalized.split("/").includes("..")
	) {
		return null;
	}
	return normalized;
}

export function parseRipgrepLine(line: string): SearchResult | null {
	const message = JSON.parse(line) as RipgrepMessage;
	if (message.type !== "match" || message.data?.line_number == null) return null;

	const path = normalizeVaultPath(decodeText(message.data.path));
	if (path == null) return null;

	const rawLine = decodeText(message.data.lines);
	const lineText = rawLine.replace(/[\r\n]+$/, "");
	const ranges: MatchRange[] = message.data.submatches.map((submatch) => ({
		from: byteOffsetToStringIndex(rawLine, submatch.start),
		to: byteOffsetToStringIndex(rawLine, submatch.end),
	}));

	return {
		path,
		line: message.data.line_number - 1,
		lineText,
		ranges,
	};
}

export class RipgrepJsonParser {
	private readonly decoder = new StringDecoder("utf8");
	private buffered = "";

	constructor(private readonly onResult: (result: SearchResult) => void) {}

	push(chunk: Buffer): void {
		this.buffered += this.decoder.write(chunk);
		this.readCompleteLines();
	}

	finish(): void {
		this.buffered += this.decoder.end();
		this.readCompleteLines(true);
	}

	private readCompleteLines(flush = false): void {
		const lines = this.buffered.split("\n");
		const pending = lines.pop() ?? "";
		this.buffered = flush ? "" : pending;

		for (const line of lines) {
			if (line.trim().length === 0) continue;
			const result = parseRipgrepLine(line);
			if (result != null) this.onResult(result);
		}

		if (flush && pending.trim().length > 0) {
			const result = parseRipgrepLine(pending);
			if (result != null) this.onResult(result);
		}
	}
}
