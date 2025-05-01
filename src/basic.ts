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
	| { tag: "const"; name: string; init: Term; rest: Term };

export function typecheck(t: Term): Type {
	switch (t.tag) {
		case "true":
			return { tag: "Boolean" };
		case "false":
			return { tag: "Boolean" };
		case "if": {
			const condTy = typecheck(t.cond);
			if (condTy.tag !== "Boolean") {
				throw "boolean expected";
			}
			const thnTy = typecheck(t.thn);
			const elsTy = typecheck(t.els);
			if (!typeEq(thnTy, elsTy)) {
				throw "branches must have the same type";
			}
			return thnTy;
		}
		case "number":
			return { tag: "Number" };
		case "add": {
			const leftTy = typecheck(t.left);
			if (leftTy.tag !== "Number") {
				throw "number expected on left side of `+`";
			}
			const rightTy = typecheck(t.right);
			if (rightTy.tag !== "Number") {
				throw "number expected on right side of `+`";
			}
			return { tag: "Number" };
		}
		default:
			throw `unknown term: ${JSON.stringify(t)}`;
	}
}

function typeEq(a: Type, b: Type): boolean {
	switch (b.tag) {
		case "Func":
			return (
				a.tag === "Func" &&
				a.params.length === b.params.length &&
				a.params.every((p, i) => typeEq(p.type, (b.params[i] as Param).type)) &&
				typeEq(a.retType, b.retType)
			);
		default:
			return a.tag === b.tag;
	}
}

if (import.meta.vitest) {
	const { describe, expect, test } = await import("vitest");
	const { parseBasic } = await import("tiny-ts-parser");

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
			// arith.ts
			["true", tBoolean()],
			["false", tBoolean()],
			["1", tNumber()],
			["1 + 2", tNumber()],
			["true ? 1 : 0", tNumber()],
			["true ? true : false", tBoolean()],
			// 無名関数の定義
			["(x: number) => x + 1", tFunc([tParam("x", tNumber())], tNumber())],
		])("OK: `%s`", (term, expected) => {
			expect(typecheck(parseBasic(term))).toEqual(expected);
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
}
