#!/usr/bin/env -S node --experimental-strip-types

import { parseArgs } from "node:util";
import { parseArith, parseBasic, parseObj, parseRecFunc } from "tiny-ts-parser";
import { typecheck as typecheckArith } from "../src/arith.ts";
import { typecheck as typecheckBasic } from "../src/basic.ts";
import { typecheck as typecheckObj } from "../src/obj.ts";
import { typecheck as typecheckRecFunc } from "../src/rec-func.ts";

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
	console.error(
		[
			"Usage:",
			"  tiny-ts-typechecker <content> [--mode <mode>]",
			"",
			"Options:",
			"  --mode: arith, basic, obj, rec-func",
			"",
			"Examples:",
			"  tiny-ts-typechecker '1 + 2' --mode arith",
			"  tiny-ts-typechecker 'const x = 1; const y = 2; x + y' --mode basic",
			"  tiny-ts-typechecker 'const obj = { a: 1, b: true }; obj.a' --mode obj",
			"  tiny-ts-typechecker 'const f = (x: number): number => f(x)' --mode rec-func",
		].join("\n"),
	);
	process.exit(1);
}

const content = positionals[0];

switch (values.mode) {
	case "arith":
		console.dir(typecheckArith(parseArith(content)));
		break;
	case "basic":
		console.dir(typecheckBasic(parseBasic(content), {}));
		break;
	case "obj":
		console.dir(typecheckObj(parseObj(content), {}));
		break;
	case "rec-func":
		console.dir(typecheckRecFunc(parseRecFunc(content), {}));
		break;
	default:
		console.error(`Unknown mode: ${values.mode}`);
		process.exit(1);
}
