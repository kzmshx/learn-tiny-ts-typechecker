/**
 * サポートする構文
 * - arith.ts
 * - basic.ts
 * - オブジェクトリテラル
 * - オブジェクトプロパティアクセス
 *
 * 判定基準
 * - 関数のオブジェクト型引数について、仮引数と実引数が完全一致すること
 * - オブジェクトプロパティアクセスにおいて、オブジェクトにそのプロパティが存在すること
 */

import { assert, ensure } from "./util.ts";

type Term =
	| { tag: "true" }
	| { tag: "false" }
	| { tag: "if"; cond: Term; thn: Term; els: Term }
	| { tag: "number"; n: number }
	| { tag: "add"; left: Term; right: Term }
	| { tag: "var"; name: string }
	| { tag: "func"; params: Param[]; body: Term }
	| { tag: "call"; func: Term; args: Term[] }
	| { tag: "seq"; body: Term; rest: Term }
	| { tag: "const"; name: string; init: Term; rest: Term }
	| { tag: "seq2"; body: Term[] }
	| { tag: "const2"; name: string; init: Term };

type Type =
	| { tag: "Boolean" }
	| { tag: "Number" }
	| { tag: "Func"; params: Param[]; retType: Type };

type Param = { name: string; type: Type };

type TypeEnv = Record<string, Type>;

function typeEq(a: Type, b: Type): boolean {
	switch (b.tag) {
		case "Func":
			return (
				a.tag === "Func" &&
				a.params.length === b.params.length &&
				a.params.every((p, i) => typeEq(p.type, ensure(b.params[i]).type)) &&
				typeEq(a.retType, b.retType)
			);
		default:
			return a.tag === b.tag;
	}
}

export function typecheck(t: Term, tyEnv: TypeEnv): Type {
	switch (t.tag) {
		case "true":
			return { tag: "Boolean" };
		case "false":
			return { tag: "Boolean" };
		case "if": {
			const condTy = typecheck(t.cond, tyEnv);
			assert(condTy.tag === "Boolean", "boolean expected", t.cond);
			const thnTy = typecheck(t.thn, tyEnv);
			const elsTy = typecheck(t.els, tyEnv);
			assert(typeEq(thnTy, elsTy), "branches must have the same type", t);
			return thnTy;
		}
		case "number":
			return { tag: "Number" };
		case "add": {
			const leftTy = typecheck(t.left, tyEnv);
			assert(
				leftTy.tag === "Number",
				"number expected on left side of `+`",
				t.left,
			);
			const rightTy = typecheck(t.right, tyEnv);
			assert(
				rightTy.tag === "Number",
				"number expected on right side of `+`",
				t.right,
			);
			return { tag: "Number" };
		}
		case "var": {
			const ty = tyEnv[t.name];
			assert(ty !== undefined, `unknown variable: ${t.name}`, t);
			return ty;
		}
		case "func": {
			const scopedTyEnv = { ...tyEnv };
			for (const param of t.params) {
				scopedTyEnv[param.name] = param.type;
			}
			const retType = typecheck(t.body, scopedTyEnv);
			return { tag: "Func", params: t.params, retType };
		}
		case "call": {
			const funcTy = typecheck(t.func, tyEnv);
			assert(funcTy.tag === "Func", "function expected", t);
			assert(
				funcTy.params.length === t.args.length,
				"wrong number of arguments",
				t,
			);
			for (let i = 0; i < t.args.length; i++) {
				const arg = ensure(t.args[i]);
				const param = ensure(funcTy.params[i]);
				const argTy = typecheck(arg, tyEnv);
				assert(typeEq(argTy, param.type), "parameter type mismatch", t);
			}
			return funcTy.retType;
		}
		case "seq": {
			typecheck(t.body, tyEnv);
			return typecheck(t.rest, tyEnv);
		}
		case "const": {
			const initTy = typecheck(t.init, tyEnv);
			return typecheck(t.rest, { ...tyEnv, [t.name]: initTy });
		}
		case "seq2": {
			let lastTy: Type | null = null;
			for (const term of t.body) {
				if (term.tag === "const2") {
					const initTy = typecheck(term.init, tyEnv);
					tyEnv[term.name] = initTy;
					lastTy = initTy;
				} else {
					lastTy = typecheck(term, tyEnv);
				}
			}
			assert(lastTy !== null, "empty sequence", t);
			return lastTy;
		}
		case "const2": {
			throw "const2 must not be reached";
		}
		default:
			throw `unknown term: ${JSON.stringify(t)}`;
	}
}

export function typeShow(t: Type): string {
	switch (t.tag) {
		case "Boolean":
			return "boolean";
		case "Number":
			return "number";
		case "Func": {
			const params = t.params
				.map((p) => `${p.name}: ${typeShow(p.type)}`)
				.join(", ");
			const ret = typeShow(t.retType);
			return `(${params}) => ${ret}`;
		}
		default:
			throw `unknown type: ${JSON.stringify(t)}`;
	}
}

if (import.meta.vitest) {
	const { describe, expect, test } = await import("vitest");
	const { parseBasic, parseBasic2 } = await import("tiny-ts-parser");

	const bool = (): Type => ({ tag: "Boolean" });
	const num = (): Type => ({ tag: "Number" });
	const param = (name: string, type: Type): Param => ({ name, type });
	const fn = (params: [name: string, type: Type][], retType: Type): Type => ({
		tag: "Func",
		params: params.map(([name, type]) => param(name, type)),
		retType,
	});

	describe(typecheck, () => {
		test.each([
			["true", bool()],
			["false", bool()],
			["1", num()],
			["1 + 2", num()],
			["true ? 1 : 0", num()],
			["true ? true : false", bool()],
			["(x: number) => 1", fn([["x", num()]], num())],
			["(x: number) => x + 1", fn([["x", num()]], num())],
			["((x: number) => x)(1)", num()],
			["(fn: () => number) => fn()", fn([["fn", fn([], num())]], num())],
			["0; 1", num()],
			["false; 1", num()],
			["const x = 1", num()],
			["const x = 1; const x = true", bool()],
			[
				`
				const add = (x: number, y: number) => {
					const z = x + y;
					return z;
				};
				const select = (cond: boolean, thn: number, els: number) => cond ? thn : els;
				const x = add(1, add(2, 3));
				const y = select(true, x, 0);
				y;
				`
					.trim()
					.replace(/\s+/g, " "),
				num(),
			],
		])("OK: `%s`", (term, expected) => {
			expect(typecheck(parseBasic(term), {})).toStrictEqual(expected);
			expect(typecheck(parseBasic2(term), {})).toStrictEqual(expected);
		});

		test.each([
			["1 ? 1 : 0", "boolean expected"],
			["true ? true : 0", "branches must have the same type"],
			["true + 1", "number expected on left side of `+`"],
			["1 + true", "number expected on right side of `+`"],
			["x", "unknown variable: x"],
			["(x: number) => x()", "function expected"],
			["((x: number) => x)(1, 2)", "wrong number of arguments"],
			["((x: number) => x)(true)", "parameter type mismatch"],
			["true + 1; 1", "number expected on left side of `+`"],
			["1; true + 1", "number expected on left side of `+`"],
			[
				`
				const add = (x: number, y: number) => {
					const z = x + y;
					return z;
				};
				z;
				`
					.trim()
					.replace(/\s+/g, " "),
				"unknown variable: z",
			],
		])("NG: `%s`", (term, expected) => {
			expect(() => typecheck(parseBasic(term), {})).toThrow(expected);
			expect(() => typecheck(parseBasic2(term), {})).toThrow(expected);
		});
	});

	describe(typeEq, () => {
		test.each([
			[num(), num()],
			[bool(), bool()],
			[fn([], num()), fn([], num())],
			[fn([["x", bool()]], num()), fn([["x", bool()]], num())],
			[fn([["x", bool()]], num()), fn([["y", bool()]], num())],
		])("`%s` == `%s`", (a, b) => {
			expect(typeEq(a, b)).toStrictEqual(true);
		});

		test.each([
			[num(), bool()],
			[bool(), num()],
			[fn([], num()), bool()],
			[fn([], num()), fn([], bool())],
			[fn([], num()), fn([["x", num()]], num())],
			[fn([["x", num()]], num()), fn([["x", bool()]], num())],
		])("`%s` != `%s`", (a, b) => {
			expect(typeEq(a, b)).toStrictEqual(false);
		});
	});

	describe(typeShow, () => {
		test.each([
			[bool(), "boolean"],
			[num(), "number"],
			[fn([], num()), "() => number"],
			[fn([["x", bool()]], num()), "(x: boolean) => number"],
			[
				fn(
					[
						["f", fn([["x", num()]], bool())],
						["g", fn([["y", num()]], bool())],
					],
					fn([["z", num()]], bool()),
				),
				"(f: (x: number) => boolean, g: (y: number) => boolean) => (z: number) => boolean",
			],
		])("shows %s as %s", (t, expected) => {
			expect(typeShow(t)).toStrictEqual(expected);
		});
	});
}
