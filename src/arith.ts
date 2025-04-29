type Type = { tag: "Boolean" } | { tag: "Number" };

type Term =
  | { tag: "true" }
  | { tag: "false" }
  | { tag: "if"; cond: Term; thn: Term; els: Term }
  | { tag: "number"; n: number }
  | { tag: "add"; left: Term; right: Term };

export function typecheckArith(t: Term): Type {
  switch (t.tag) {
    case "true":
      return { tag: "Boolean" };
    case "false":
      return { tag: "Boolean" };
    case "if":
      const condTy = typecheckArith(t.cond);
      if (condTy.tag !== "Boolean") {
        throw "boolean expected";
      }
      const thnTy = typecheckArith(t.thn);
      const elsTy = typecheckArith(t.els);
      if (thnTy.tag !== elsTy.tag) {
        throw "branches must have the same type";
      }
      return thnTy;
    case "number":
      return { tag: "Number" };
    case "add":
      const leftTy = typecheckArith(t.left);
      if (leftTy.tag !== "Number") {
        throw "number expected on left side of `+`";
      }
      const rightTy = typecheckArith(t.right);
      if (rightTy.tag !== "Number") {
        throw "number expected on right side of `+`";
      }
      return { tag: "Number" };
    default:
      throw `unknown term: ${JSON.stringify(t)}`;
  }
}

if (import.meta.vitest) {
  const { describe, expect, test } = await import("vitest");
  const { parseArith } = await import("tiny-ts-parser");

  describe(typecheckArith, () => {
    test.each([
      ["true", { tag: "Boolean" }],
      ["false", { tag: "Boolean" }],
      ["1", { tag: "Number" }],
      ["1 + 2", { tag: "Number" }],
      ["true ? 1 : 0", { tag: "Number" }],
    ])("OK: `%s`", (term, expected) => {
      expect(typecheckArith(parseArith(term))).toEqual(expected);
    });

    test.each([
      ["1 ? 1 : 0", "boolean expected"],
      ["true ? true : 0", "branches must have the same type"],
      ["true + 1", "number expected on left side of `+`"],
      ["1 + true", "number expected on right side of `+`"],
    ])("NG: `%s`", (term, expected) => {
      expect(() => typecheckArith(parseArith(term))).toThrow(expected);
    });
  });
}
