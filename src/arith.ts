type Type = { tag: "Boolean" } | { tag: "Number" };

type Term =
	| { tag: "true" }
	| { tag: "false" }
	| { tag: "if"; cond: Term; thn: Term; els: Term }
	| { tag: "number"; n: number }
	| { tag: "add"; left: Term; right: Term };

/**
 * 判定基準
 * 1. number 型同士でのみ加算ができる
 * 2. 条件演算子の条件式は boolean 型である
 * 3. 条件演算子の分岐先は同じ型である
 */
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
			if (thnTy.tag !== elsTy.tag) {
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

export function typecheck2(t: Term): Type {
	switch (t.tag) {
		case "true":
			return { tag: "Boolean" };
		case "false":
			return { tag: "Boolean" };
		case "if": {
			typecheck(t.cond);
			const [thnTy, elsTy] = [typecheck(t.thn), typecheck(t.els)];
			if (thnTy.tag !== elsTy.tag) {
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

if (import.meta.vitest) {
	const { describe, expect, test } = await import("vitest");
	const { parseArith } = await import("tiny-ts-parser");

	describe(typecheck, () => {
		test.each([
			["true", { tag: "Boolean" }],
			["false", { tag: "Boolean" }],
			["1", { tag: "Number" }],
			["1 + 2", { tag: "Number" }],
			["true ? 1 : 0", { tag: "Number" }],
			["true ? true : false", { tag: "Boolean" }],
		])("OK: `%s`", (term, expected) => {
			expect(typecheck(parseArith(term))).toEqual(expected);
		});

		test.each([
			["1 ? 1 : 0", "boolean expected"],
			["true ? true : 0", "branches must have the same type"],
			["true + 1", "number expected on left side of `+`"],
			["1 + true", "number expected on right side of `+`"],
		])("NG: `%s`", (term, expected) => {
			expect(() => typecheck(parseArith(term))).toThrow(expected);
		});
	});

	describe(typecheck2, () => {
		test.each([
			["true", { tag: "Boolean" }],
			["false", { tag: "Boolean" }],
			["1", { tag: "Number" }],
			["1 + 2", { tag: "Number" }],
			["true ? 1 : 0", { tag: "Number" }],
			["true ? true : false", { tag: "Boolean" }],
			["1 ? 1 : 0", { tag: "Number" }],
		])("OK: `%s`", (term, expected) => {
			expect(typecheck2(parseArith(term))).toEqual(expected);
		});
	});
}
