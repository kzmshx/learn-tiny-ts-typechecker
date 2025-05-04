# learn-tiny-ts-typechecker

[型システムのしくみ ― TypeScript で実装しながら学ぶ型とプログラミング言語](https://www.lambdanote.com/products/type-systems)

## Usage

### Installation

Requires Node.js v22 or later. Depends on `tiny-ts-parser`.

```sh
npm install
```

### CLI Examples

```sh
npx tiny-ts-typechecker '1 + 2' --mode arith
npx tiny-ts-typechecker 'const x = 1; const y = 2; x + y' --mode basic
npx tiny-ts-typechecker 'const obj = { a: 1, b: true }; obj.a' --mode obj
```

- Use `--mode` to select the type checking mode:
  - `arith`: Arithmetic expressions only
  - `basic`: Variables, functions, sequencing, etc.
  - `obj`: Also supports object literals and property access
