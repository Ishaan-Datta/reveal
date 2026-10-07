import { builtinModules } from "node:module";

import { context } from "esbuild";

const production = process.argv[2] === "production";
const builtins = [...builtinModules, ...builtinModules.map((name) => `node:${name}`)];

const ctx = await context({
	entryPoints: ["src/main.ts"],
	bundle: true,
	external: ["obsidian", "electron", ...builtins],
	format: "cjs",
	platform: "browser",
	target: "es2021",
	logLevel: "info",
	sourcemap: production ? false : "inline",
	minify: production,
	treeShaking: true,
	outfile: "main.js",
});

if (production) {
	await ctx.rebuild();
	await ctx.dispose();
} else {
	await ctx.watch();
}
