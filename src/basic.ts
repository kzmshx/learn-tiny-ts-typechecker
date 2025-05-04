/**
 * サポートする構文
 * - arith.ts
 * - 変数の定義
 * - 変数の参照
 * - 無名関数の定義
 * - 関数の呼び出し
 * - 関数の逐次実行
 *
 * 判定基準
 * - 未定義変数を参照してはならない
 * - 関数呼び出しにおいて、呼び出されるものが関数型でなければならない
 * - 関数呼び出しにおいて、仮引数と実引数の個数と型が一致していなければならない
 */

import { assert, ensure } from "./util.ts";

type Type =
	| { tag: "Boolean" }
	| { tag: "Number" }
	| { tag: "Func"; params: Param[]; retType: Type };

type Param = { name: string; type: Type };

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

	const tBoolean = (): Type => ({ tag: "Boolean" });
	const tNumber = (): Type => ({ tag: "Number" });
	const tParam = (name: string, type: Type): Param => ({ name, type });
	const tFunc = (params: Param[], retType: Type): Type => ({
		tag: "Func",
		params,
		retType,
	});

	describe(typecheck, () => {
		test.each([
			["true", tBoolean()],
			["false", tBoolean()],
			["1", tNumber()],
			["1 + 2", tNumber()],
			["true ? 1 : 0", tNumber()],
			["true ? true : false", tBoolean()],
			// 無名関数定義
			["(x: number) => 1", tFunc([tParam("x", tNumber())], tNumber())],
			["(x: number) => x + 1", tFunc([tParam("x", tNumber())], tNumber())],
			// 関数呼び出し
			["((x: number) => x)(1)", tNumber()],
			// 変数参照
			[
				"(fn: () => number) => fn()",
				tFunc([tParam("fn", tFunc([], tNumber()))], tNumber()),
			],
			// 逐次実行
			["0; 1", tNumber()],
			["false; 1", tNumber()],
			// 変数の定義
			["const x = 1", tNumber()],
			["const x = 1; const x = true", tBoolean()],
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
				tNumber(),
			],
		])("OK: `%s`", (term, expected) => {
			expect(typecheck(parseBasic(term), {})).toEqual(expected);
			expect(typecheck(parseBasic2(term), {})).toEqual(expected);
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
		test.each<[string, Type, Type]>([
			["数値", tNumber(), tNumber()],
			["真偽値", tBoolean(), tBoolean()],
			["関数", tFunc([], tNumber()), tFunc([], tNumber())],
			[
				"仮引数名が同じ関数",
				tFunc([tParam("x", tBoolean())], tNumber()),
				tFunc([tParam("x", tBoolean())], tNumber()),
			],
			[
				"仮引数名が異なる関数",
				tFunc([tParam("x", tBoolean())], tNumber()),
				tFunc([tParam("y", tBoolean())], tNumber()),
			],
		])("eq: %s", (_, a, b) => {
			expect(typeEq(a, b)).toBe(true);
		});

		test.each<[string, Type, Type]>([
			["数値と真偽値", tNumber(), tBoolean()],
			["真偽値と数値", tBoolean(), tNumber()],
			["関数と真偽値", tFunc([], tNumber()), tBoolean()],
			["返り値型が異なる関数", tFunc([], tNumber()), tFunc([], tBoolean())],
			[
				"仮引数の個数が異なる関数",
				tFunc([], tNumber()),
				tFunc([tParam("x", tNumber())], tNumber()),
			],
			[
				"仮引数の型が異なる関数",
				tFunc([tParam("x", tNumber())], tNumber()),
				tFunc([tParam("x", tBoolean())], tNumber()),
			],
		])("not eq: %s", (_, a, b) => {
			expect(typeEq(a, b)).toBe(false);
		});
	});

	describe(typeShow, () => {
		test.each<[Type, string]>([
			[tBoolean(), "boolean"],
			[tNumber(), "number"],
			[tFunc([], tNumber()), "() => number"],
			[tFunc([tParam("x", tBoolean())], tNumber()), "(x: boolean) => number"],
			[
				tFunc(
					[
						tParam("f", tFunc([tParam("x", tNumber())], tBoolean())),
						tParam("g", tFunc([tParam("y", tNumber())], tBoolean())),
					],
					tFunc([tParam("z", tNumber())], tBoolean()),
				),
				"(f: (x: number) => boolean, g: (y: number) => boolean) => (z: number) => boolean",
			],
		])("shows %s as %s", (t, expected) => {
			expect(typeShow(t)).toStrictEqual(expected);
		});
	});
}
