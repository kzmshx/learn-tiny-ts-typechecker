# learn-tiny-ts-typechecker

[型システムのしくみ ― TypeScript で実装しながら学ぶ型とプログラミング言語](https://www.lambdanote.com/products/type-systems)

## Usage

### Installation

```sh
npm install
```

## CLI Usage

```sh
tiny-ts-typechecker '<content>' --mode <mode>
```

- `<content>`: The TypeScript code to typecheck (as a string).
- `--mode`: Selects the type checking mode. Available options:
  - `arith`: Arithmetic expressions only
  - `basic`: Variables, functions, sequencing, etc.
  - `obj`: Also supports object literals and property access
  - `rec-func`: Also supports recursive functions

### Examples

```sh
tiny-ts-typechecker '1 + 2' --mode arith
tiny-ts-typechecker 'const x = 1; const y = 2; x + y' --mode basic
tiny-ts-typechecker 'const obj = { a: 1, b: true }; obj.a' --mode obj
tiny-ts-typechecker 'const f = (x: number): number => f(x)' --mode rec-func
```
