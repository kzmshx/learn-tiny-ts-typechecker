/**
 * サポートする構文
 * - arith.ts, basic.ts, obj.ts
 * - 部分型付け
 */

import { assert, assertNever, ensure } from "./util.ts";

type Term =
	| { tag: "true" }
	| { tag: "false" }
	// | { tag: "if"; cond: Term; thn: Term; els: Term }
	| { tag: "number"; n: number }
	| { tag: "add"; left: Term; right: Term }
	| { tag: "var"; name: string }
	| { tag: "func"; params: ParamType[]; body: Term }
	| { tag: "call"; func: Term; args: Term[] }
	| { tag: "seq"; body: Term; rest: Term }
	| { tag: "const"; name: string; init: Term; rest: Term }
	| { tag: "objectNew"; props: PropTerm[] }
	| { tag: "objectGet"; obj: Term; propName: string };

type PropTerm = { name: string; term: Term };

type Type =
	| { tag: "Boolean" }
	| { tag: "Number" }
	| { tag: "Func"; params: ParamType[]; retType: Type }
	| { tag: "Object"; props: PropType[] };

type ParamType = { name: string; type: Type };

type PropType = { name: string; type: Type };

type TypeEnv = Record<string, Type>;

function isEqualType(a: Type, b: Type): boolean {
	switch (b.tag) {
		case "Number":
		case "Boolean":
			return a.tag === b.tag;
		case "Func":
			return (
				a.tag === "Func" &&
				a.params.length === b.params.length &&
				a.params.every((p, i) =>
					isEqualType(p.type, ensure(b.params[i]).type),
				) &&
				isEqualType(a.retType, b.retType)
			);
		case "Object": {
			const bTypes = Object.fromEntries(b.props.map((p) => [p.name, p.type]));
			return (
				a.tag === "Object" &&
				a.props.length === b.props.length &&
				a.props.every((p) => {
					const bType = bTypes[p.name];
					return bType && isEqualType(p.type, bType);
				})
			);
		}
		default:
			assertNever(b);
	}
}

function isSubtypeOf(a: Type, b: Type): boolean {
	switch (b.tag) {
		case "Number":
		case "Boolean":
			return a.tag === b.tag;
		case "Func":
			return (
				a.tag === b.tag &&
				a.params.length === b.params.length &&
				a.params.every((ap, i) => {
					const bp = ensure(b.params[i]);
					return isSubtypeOf(bp.type, ap.type);
				}) &&
				isSubtypeOf(a.retType, b.retType)
			);
		case "Object": {
			return (
				a.tag === b.tag &&
				b.props.every((bp) => {
					const ap = a.props.find((ap) => ap.name === bp.name);
					return ap && isSubtypeOf(ap.type, bp.type);
				})
			);
		}
		default:
			assertNever(b);
	}
}

export function typecheck(t: Term, tyEnv: TypeEnv): Type {
	switch (t.tag) {
		case "true":
		case "false":
			return { tag: "Boolean" };
		// case "if": {
		// 	const condTy = typecheck(t.cond, tyEnv);
		// 	assert(condTy.tag === "Boolean", "boolean expected", t.cond);
		// 	const thnTy = typecheck(t.thn, tyEnv);
		// 	const elsTy = typecheck(t.els, tyEnv);
		// 	assert(isEqualType(thnTy, elsTy), "branches must have the same type", t);
		// 	return thnTy;
		// }
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
			const tyScope = {
				...tyEnv,
				...Object.fromEntries(t.params.map((p) => [p.name, p.type])),
			};
			const retType = typecheck(t.body, tyScope);
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
				assert(isEqualType(argTy, param.type), "parameter type mismatch", t);
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
		case "objectNew": {
			const props = t.props.map(({ name, term }) => ({
				name,
				type: typecheck(term, tyEnv),
			}));
			return { tag: "Object", props };
		}
		case "objectGet": {
			const objTy = typecheck(t.obj, tyEnv);
			assert(objTy.tag === "Object", "object expected", t);
			const propTy = objTy.props.find((p) => p.name === t.propName);
			assert(propTy !== undefined, `unknown property: ${t.propName}`, t);
			return propTy.type;
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
		case "Object": {
			const props = t.props
				.map((p) => `${p.name}: ${typeShow(p.type)}`)
				.join(", ");
			return `{ ${props} }`;
		}
		default:
			assertNever(t);
	}
}

if (import.meta.vitest) {
	const { describe, expect, test } = await import("vitest");
	const { parseSub } = await import("tiny-ts-parser");

	const trim = (s: string): string => s.trim().replace(/\s+/g, " ");

	const bool = (): Type => ({ tag: "Boolean" });
	const num = (): Type => ({ tag: "Number" });
	const param = (name: string, type: Type): ParamType => ({ name, type });
	const prop = (name: string, type: Type): PropType => ({ name, type });
	const func = (params: [name: string, type: Type][], retType: Type): Type => ({
		tag: "Func",
		params: params.map(([name, type]) => param(name, type)),
		retType,
	});
	const obj = (...props: [name: string, type: Type][]): Type => ({
		tag: "Object",
		props: props.map(([name, type]) => prop(name, type)),
	});

	describe(typecheck, () => {
		test.each([
			["true", bool()],
			["false", bool()],
			["1", num()],
			["1 + 2", num()],
			// ["true ? 1 : 0", num()],
			// ["true ? true : false", bool()],
			["(x: number) => 1", func([["x", num()]], num())],
			["(x: number) => x + 1", func([["x", num()]], num())],
			["((x: number) => x)(1)", num()],
			["(fn: () => number) => fn()", func([["fn", func([], num())]], num())],
			["0; 1", num()],
			["false; 1", num()],
			["const x = 1", num()],
			["const x = 1; const x = true", bool()],
			// [
			// 	trim(`const add = (x: number, y: number) => {
			// 					const z = x + y;
			// 					return z;
			// 				};
			// 				const select = (cond: boolean, thn: number, els: number) => cond ? thn : els;
			// 				const x = add(1, add(2, 3));
			// 				const y = select(true, x, 0);
			// 				y;`),
			// 	num(),
			// ],
			["({ a: 1, b: true })", obj(["a", num()], ["b", bool()])],
			["const obj = { a: 1, b: true }; obj.a;", num()],
			["const obj = { a: 1, b: true }; obj.b;", bool()],
		])("OK: `%s`", (term, expected) => {
			expect(typecheck(parseSub(term), {})).toStrictEqual(expected);
		});

		test.each([
			// ["1 ? 1 : 0", "boolean expected"],
			// ["true ? true : 0", "branches must have the same type"],
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
			["const nonObj = 1; nonObj.a;", "object expected"],
			["const obj = { a: 1, b: true }; obj.c;", "unknown property: c"],
			[
				"const f = (obj: { a: number }) => obj.a; f({ a: 1, b: true });",
				"parameter type mismatch",
			],
		])("NG: `%s`", (term, expected) => {
			expect(() => typecheck(parseSub(term), {})).toThrow(expected);
		});
	});

	describe(isEqualType, () => {
		test.each([
			[num(), num()],
			[bool(), bool()],
			[func([], num()), func([], num())],
			[func([["x", bool()]], num()), func([["x", bool()]], num())],
			[func([["x", bool()]], num()), func([["y", bool()]], num())],
			[obj(["a", num()]), obj(["a", num()])],
			[obj(["a", num()], ["b", bool()]), obj(["a", num()], ["b", bool()])],
			[obj(["a", num()], ["b", bool()]), obj(["b", bool()], ["a", num()])],
		])("`%s` is equal to `%s`", (a, b) => {
			expect(isEqualType(a, b)).toStrictEqual(true);
		});

		test.each([
			[num(), bool()],
			[bool(), num()],
			[func([], num()), bool()],
			[func([], num()), func([], bool())],
			[func([], num()), func([["x", num()]], num())],
			[func([["x", num()]], num()), func([["x", bool()]], num())],
			[obj(["a", num()]), obj(["a", bool()])],
			[obj(["a", num()]), obj(["b", num()])],
			[obj(["a", num()]), obj(["a", num()], ["b", bool()])],
			[obj(["a", num()], ["b", bool()]), obj(["a", num()])],
		])("`%s` is not equal to `%s`", (a, b) => {
			expect(isEqualType(a, b)).toStrictEqual(false);
		});
	});

	describe(isSubtypeOf, () => {
		test.each([
			[num(), num()],
			[bool(), bool()],
			[func([], num()), func([], num())],
			[func([["x", bool()]], num()), func([["x", bool()]], num())],
			[func([["x", bool()]], num()), func([["y", bool()]], num())],
			[obj(["a", num()]), obj(["a", num()])],
			[obj(["a", num()], ["b", bool()]), obj(["a", num()], ["b", bool()])],
			[obj(["a", num()], ["b", bool()]), obj(["b", bool()], ["a", num()])],
			[obj(["a", num()], ["b", bool()]), obj(["a", num()])],
			[
				func([["x", obj(["a", num()])]], num()),
				func([["x", obj(["a", num()], ["b", num()])]], num()),
			],
			[func([], obj(["a", num()], ["b", num()])), func([], obj(["a", num()]))],
		])("true: `%s` is a subtype of `%s`", (a, b) => {
			expect(isSubtypeOf(a, b)).toStrictEqual(true);
		});

		test.each([
			[num(), bool()],
			[bool(), num()],
			[func([], num()), bool()],
			[func([], num()), func([], bool())],
			[func([], num()), func([["x", num()]], num())],
			[func([["x", num()]], num()), func([["x", bool()]], num())],
			[obj(["a", num()]), obj(["a", bool()])],
			[obj(["a", num()]), obj(["b", num()])],
			[obj(["a", num()]), obj(["a", num()], ["b", bool()])],
			[func([], obj(["a", num()])), func([], obj(["a", num()], ["b", num()]))],
		])("false: `%s` is not a subtype of `%s`", (a, b) => {
			expect(isSubtypeOf(a, b)).toStrictEqual(false);
		});
	});

	describe(typeShow, () => {
		test.each([
			[bool(), "boolean"],
			[num(), "number"],
			[func([], num()), "() => number"],
			[func([["x", bool()]], num()), "(x: boolean) => number"],
			[
				func(
					[
						["f", func([["x", num()]], bool())],
						["g", func([["y", num()]], bool())],
					],
					func([["z", num()]], bool()),
				),
				"(f: (x: number) => boolean, g: (y: number) => boolean) => (z: number) => boolean",
			],
			// オブジェクト
			[obj(["a", num()]), "{ a: number }"],
			[obj(["a", num()], ["b", bool()]), "{ a: number, b: boolean }"],
			[obj(["a", func([], num())]), "{ a: () => number }"],
		])("shows %s as %s", (t, expected) => {
			expect(typeShow(t)).toStrictEqual(expected);
		});
	});
}
