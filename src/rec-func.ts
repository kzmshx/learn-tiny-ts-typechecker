/**
 * サポートする構文
 * - arith.ts, basic.ts
 * - function 構文による再帰関数の定義
 *
 * 判定基準
 * - arith.ts, basic.ts
 * - 関数実装の返り値型がシグネチャの返り値型と一致する
 */

import { assert, assertNever, ensure } from "./util.ts";

type Term =
	| { tag: "true" }
	| { tag: "false" }
	| { tag: "if"; cond: Term; thn: Term; els: Term }
	| { tag: "number"; n: number }
	| { tag: "add"; left: Term; right: Term }
	| { tag: "var"; name: string }
	| {
			tag: "func";
			params: ParamType[];
			retType?: Type;
			body: Term;
	  }
	| {
			tag: "recFunc";
			funcName: string;
			params: ParamType[];
			retType: Type;
			body: Term;
			rest: Term;
	  }
	| { tag: "call"; func: Term; args: Term[] }
	| { tag: "seq"; body: Term; rest: Term }
	| { tag: "const"; name: string; init: Term; rest: Term };

type Type =
	| { tag: "Boolean" }
	| { tag: "Number" }
	| { tag: "Func"; params: ParamType[]; retType: Type };

type ParamType = { name: string; type: Type };

type TypeEnv = Record<string, Type>;

function typeEq(a: Type, b: Type): boolean {
	switch (b.tag) {
		case "Number":
		case "Boolean":
			return a.tag === b.tag;
		case "Func":
			return (
				a.tag === "Func" &&
				a.params.length === b.params.length &&
				a.params.every((p, i) => typeEq(p.type, ensure(b.params[i]).type)) &&
				typeEq(a.retType, b.retType)
			);
		default:
			assertNever(b);
	}
}

export function typecheck(t: Term, tyEnv: TypeEnv, p?: Term): Type {
	switch (t.tag) {
		case "true":
		case "false": {
			return { tag: "Boolean" };
		}
		case "if": {
			const condTy = typecheck(t.cond, tyEnv);
			assert(condTy.tag === "Boolean", "boolean expected", t.cond);
			const thnTy = typecheck(t.thn, tyEnv);
			const elsTy = typecheck(t.els, tyEnv);
			assert(typeEq(thnTy, elsTy), "branches must have the same type", t);
			return thnTy;
		}
		case "number": {
			return { tag: "Number" };
		}
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
			const tyScope = {
				...tyEnv,
				...Object.fromEntries(t.params.map((p) => [p.name, p.type])),
			};
			if (t.retType && p?.tag === "const") {
				const selfTy: Type = {
					tag: "Func",
					params: t.params,
					retType: t.retType,
				};
				tyScope[p.name] = selfTy;
			}
			const retType = typecheck(t.body, tyScope);
			if (t.retType !== undefined) {
				assert(typeEq(t.retType, retType), "return type mismatch", t);
			}
			return { tag: "Func", params: t.params, retType };
		}
		case "recFunc": {
			const selfTy: Type = {
				tag: "Func",
				params: t.params,
				retType: t.retType,
			};
			const tyScope = {
				...tyEnv,
				...Object.fromEntries(t.params.map((p) => [p.name, p.type])),
				[t.funcName]: selfTy,
			};
			const retType = typecheck(t.body, tyScope);
			assert(typeEq(t.retType, retType), "return type mismatch", t);
			return typecheck(t.rest, { ...tyEnv, [t.funcName]: selfTy });
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
			const initTy = typecheck(t.init, tyEnv, t);
			return typecheck(t.rest, { ...tyEnv, [t.name]: initTy });
		}
		default:
			assertNever(t);
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
			assertNever(t);
	}
}

if (import.meta.vitest) {
	const { describe, expect, test } = await import("vitest");
	const { parseRecFunc } = await import("tiny-ts-parser");

	const trim = (s: string): string => s.trim().replace(/\s+/g, " ");

	const bool = (): Type => ({ tag: "Boolean" });
	const num = (): Type => ({ tag: "Number" });
	const param = (name: string, type: Type): ParamType => ({ name, type });
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
				trim(`const add = (x: number, y: number) => {
								const z = x + y;
								return z;
							};
							const select = (cond: boolean, thn: number, els: number) => cond ? thn : els;
							const x = add(1, add(2, 3));
							const y = select(true, x, 0);
							y;`),
				num(),
			],
			// 再帰関数
			[
				"function f(x: number): number { return f(x); }",
				fn([["x", num()]], num()),
			],
			["const f = (x: number): number => f(x)", fn([["x", num()]], num())],
		])("OK: `%s`", (term, expected) => {
			console.dir(parseRecFunc(term), { depth: 4 });
			expect(typecheck(parseRecFunc(term), {})).toStrictEqual(expected);
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
				trim(`const add = (x: number, y: number) => {
								const z = x + y;
								return z;
							};
							z;`),
				"unknown variable: z",
			],
			["function f(): boolean { return 1; }", "return type mismatch"],
			["(): boolean => 1", "return type mismatch"],
			["const a = a + 1", "unknown variable: a"],
		])("NG: `%s`", (term, expected) => {
			expect(() => typecheck(parseRecFunc(term), {})).toThrow(expected);
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

const f = (x: number): number => f(x);
