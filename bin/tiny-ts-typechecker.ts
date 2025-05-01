#!/usr/bin/env node

import { parseArgs } from "node:util";
import { parseArith } from "tiny-ts-parser";
import { typecheck as typecheckArith } from "../src/arith";

const { values, positionals } = parseArgs({
	args: process.argv.slice(2),
	options: {
		mode: {
			type: "string",
			default: "arith",
		},
	},
	strict: true,
	allowPositionals: true,
});

if (positionals.length === 0 || positionals[0] === undefined) {
	console.error("Usage: tiny-ts-typechecker <content> [--mode <arith>]");
	process.exit(1);
}

const content = positionals[0];

switch (values.mode) {
	case "arith":
		console.dir(typecheckArith(parseArith(content)));
		break;
	default:
		console.error(`Unknown mode: ${values.mode}`);
		process.exit(1);
}
