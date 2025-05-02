export function assert(
	condition: boolean,
	message?: string,
): asserts condition {
	if (!condition) {
		throw message;
	}
}

export function exists<T>(v: T | null | undefined): v is NonNullable<T> {
	return typeof v !== "undefined" && v !== null;
}

export function ensure<T>(v: T | null | undefined): NonNullable<T> {
	if (!exists(v)) {
		throw "value should exists";
	}
	return v;
}
