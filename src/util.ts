import { error } from "tiny-ts-parser";

export function assertNever(v: never): never {
	throw `unreachable: ${v}`;
}

export function assert(
	condition: boolean,
	message: string,
	// biome-ignore lint/suspicious/noExplicitAny:
	term: any,
): asserts condition {
	if (!condition) {
		error(message, term);
	}
}

export function exists<T>(v: T | null | undefined): v is NonNullable<T> {
	return typeof v !== "undefined" && v !== null;
}

export function ensure<T>(
	v: T | null | undefined,
	message?: string,
): NonNullable<T> {
	if (!exists(v)) {
		throw message ?? "value should exists";
	}
	return v;
}
