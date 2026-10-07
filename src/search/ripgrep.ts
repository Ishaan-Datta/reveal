import { spawn } from "node:child_process";

import type { RevealSettings, SearchResult, SearchScope } from "../model";
import { RipgrepJsonParser } from "./ripgrep-json";

const MAX_ERROR_LENGTH = 8_192;

export interface RipgrepSearchRequest {
	query: string;
	scope: SearchScope;
	vaultPath: string;
	settings: RevealSettings;
	signal: AbortSignal;
	onResult: (result: SearchResult) => void;
}

export class RipgrepProcessError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "RipgrepProcessError";
	}
}

export function createAbortError(): Error {
	const error = new Error("Search cancelled.");
	error.name = "AbortError";
	return error;
}

function errorMessage(error: unknown): string {
	if (error instanceof Error) return error.message;
	if (typeof error === "string") return error;
	return "Unknown error.";
}

export function buildRipgrepArgs(
	query: string,
	scope: SearchScope,
	settings: RevealSettings,
): string[] {
	const args = ["--json", "--no-config", "--color", "never"];

	switch (settings.caseMode) {
		case "sensitive":
			args.push("--case-sensitive");
			break;
		case "insensitive":
			args.push("--ignore-case");
			break;
		case "smart":
			args.push("--smart-case");
			break;
	}

	if (!settings.useRegex) args.push("--fixed-strings");
	if (settings.includeHidden) args.push("--hidden");
	if (!settings.respectIgnoreFiles) args.push("--no-ignore");
	if (scope.type === "vault") args.push("--glob", "*.md");

	args.push("--regexp", query, "--", scope.type === "vault" ? "." : scope.path);
	return args;
}

export function runRipgrepSearch(request: RipgrepSearchRequest): Promise<number> {
	if (request.signal.aborted) return Promise.reject(createAbortError());

	return new Promise((resolve, reject) => {
		let resultCount = 0;
		let stderr = "";
		let settled = false;
		let reachedLimit = false;
		let parseError: unknown;

		const child = spawn(
			request.settings.ripgrepPath,
			buildRipgrepArgs(request.query, request.scope, request.settings),
			{
				cwd: request.vaultPath,
				shell: false,
				windowsHide: true,
			},
		);

		const settle = (error?: Error): void => {
			if (settled) return;
			settled = true;
			request.signal.removeEventListener("abort", abort);
			if (error == null) resolve(resultCount);
			else reject(error);
		};

		const parser = new RipgrepJsonParser((result) => {
			if (reachedLimit || request.signal.aborted) return;
			resultCount += 1;
			request.onResult(result);
			if (resultCount >= request.settings.maxResults) {
				reachedLimit = true;
				child.kill();
			}
		});

		const abort = (): void => {
			child.kill();
		};
		request.signal.addEventListener("abort", abort, { once: true });

		child.stdout.on("data", (chunk: Buffer) => {
			if (parseError != null) return;
			try {
				parser.push(chunk);
			} catch (error) {
				parseError = error;
				child.kill();
			}
		});

		child.stderr.on("data", (chunk: Buffer) => {
			if (stderr.length < MAX_ERROR_LENGTH) {
				stderr += chunk.toString("utf8").slice(0, MAX_ERROR_LENGTH - stderr.length);
			}
		});

		child.on("error", (error) => {
			if (request.signal.aborted) settle(createAbortError());
			else settle(new RipgrepProcessError(error.message));
		});

		child.on("close", (code) => {
			if (request.signal.aborted) {
				settle(createAbortError());
				return;
			}

			if (parseError != null) {
				const message = errorMessage(parseError);
				settle(new RipgrepProcessError(`Could not parse ripgrep output: ${message}`));
				return;
			}

			if (!reachedLimit) {
				try {
					parser.finish();
				} catch (error) {
					const message = errorMessage(error);
					settle(new RipgrepProcessError(`Could not parse ripgrep output: ${message}`));
					return;
				}
			}

			if (reachedLimit || code === 0 || code === 1) {
				settle();
				return;
			}

			const detail = stderr.trim();
			settle(
				new RipgrepProcessError(
					detail.length > 0
						? detail
						: `Ripgrep exited with status ${code == null ? "unknown" : String(code)}.`,
				),
			);
		});
	});
}

export function getRipgrepVersion(executable: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let stdout = "";
		let stderr = "";
		const child = spawn(executable, ["--version"], {
			shell: false,
			windowsHide: true,
		});

		const timeout = setTimeout(() => child.kill(), 5_000);
		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString("utf8");
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString("utf8");
		});
		child.on("error", (error) => {
			clearTimeout(timeout);
			reject(new RipgrepProcessError(error.message));
		});
		child.on("close", (code) => {
			clearTimeout(timeout);
			if (code === 0) resolve(stdout.trim().split("\n")[0] ?? "ripgrep");
			else reject(new RipgrepProcessError(stderr.trim() || "Could not run ripgrep."));
		});
	});
}
