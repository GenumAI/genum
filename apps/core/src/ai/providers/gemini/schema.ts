import { type Schema, Type } from "@google/genai";

/**
 * A tool's JSON Schema, narrowed to the subset Gemini accepts.
 *
 * Gemini does not take JSON Schema. It takes a named subset of it, and rejects the call
 * outright on a keyword it does not know -- so a schema cannot simply be passed through
 * the way OpenAI, DeepSeek and Anthropic take it. The previous mapping avoided that by
 * keeping only `type` and `description` per property, which meant an array parameter
 * arrived as `{"type":"array"}` with no `items`, a nested object arrived empty, and every
 * `enum` and `required` was lost. The model was then asked to call a tool whose arguments
 * it had not been told the shape of.
 *
 * The rule here is an allowlist, and the direction of failure is deliberate: a keyword we
 * do not recognise is DROPPED, never forwarded. Dropping a constraint weakens what the
 * model is told; forwarding an unknown one fails the whole request. The first is a worse
 * tool call, the second is no tool call at all.
 */

/** Per-type `format` values Gemini documents. Anything else is dropped, not guessed. */
const SUPPORTED_FORMATS: Partial<Record<Type, ReadonlySet<string>>> = {
	[Type.STRING]: new Set(["enum", "date-time"]),
	[Type.NUMBER]: new Set(["float", "double"]),
	[Type.INTEGER]: new Set(["int32", "int64"]),
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * JSON Schema's type onto Gemini's.
 *
 * `integer` is listed. The mapping this replaces had no case for it and fell through to
 * its `default: STRING`, so every integer parameter was declared to the model as a
 * string -- and a model that answers "3" where a number was wanted is not obviously
 * wrong to anyone reading the trace.
 */
function geminiType(type: string): Type | undefined {
	switch (type.toLowerCase()) {
		case "string":
			return Type.STRING;
		case "number":
			return Type.NUMBER;
		case "integer":
			return Type.INTEGER;
		case "boolean":
			return Type.BOOLEAN;
		case "object":
			return Type.OBJECT;
		case "array":
			return Type.ARRAY;
		default:
			return undefined;
	}
}

/**
 * The `type` keyword, which JSON Schema also allows as a list (`["string", "null"]`).
 * The list form is how nullability is usually written, and Gemini spells that as a
 * separate `nullable` flag -- so it is read out here rather than dropped with the list.
 */
function readType(raw: unknown): { type?: Type; nullable?: boolean } {
	if (typeof raw === "string") {
		return { type: geminiType(raw) };
	}

	if (Array.isArray(raw)) {
		const names = raw.filter((entry): entry is string => typeof entry === "string");
		const nullable = names.some((name) => name.toLowerCase() === "null");
		const first = names.find((name) => name.toLowerCase() !== "null");
		return {
			type: first === undefined ? undefined : geminiType(first),
			...(nullable ? { nullable: true } : {}),
		};
	}

	return {};
}

/** Gemini's `enum` is a list of strings, so a numeric or boolean enum is spelled out. */
function readEnum(raw: unknown): string[] | undefined {
	if (!Array.isArray(raw) || raw.length === 0) return undefined;

	const values = raw
		.filter(
			(entry): entry is string | number | boolean =>
				typeof entry === "string" ||
				typeof entry === "number" ||
				typeof entry === "boolean",
		)
		.map(String);

	return values.length > 0 ? values : undefined;
}

function readNumber(raw: unknown): number | undefined {
	return typeof raw === "number" && Number.isFinite(raw) ? raw : undefined;
}

function readString(raw: unknown): string | undefined {
	return typeof raw === "string" ? raw : undefined;
}

/** One JSON Schema node, recursively. */
export function toGeminiSchema(node: unknown): Schema {
	if (!isRecord(node)) return {};

	const { type, nullable } = readType(node.type);
	const schema: Schema = {};

	if (type !== undefined) schema.type = type;
	if (nullable === true || node.nullable === true) schema.nullable = true;

	const description = readString(node.description);
	if (description !== undefined) schema.description = description;

	const title = readString(node.title);
	if (title !== undefined) schema.title = title;

	const format = readString(node.format);
	if (format !== undefined && type !== undefined && SUPPORTED_FORMATS[type]?.has(format)) {
		schema.format = format;
	}

	const enumValues = readEnum(node.enum);
	if (enumValues !== undefined) schema.enum = enumValues;

	// The keyword whose loss broke arrays: without it the model is told a list is wanted
	// and nothing about what goes in it.
	if (node.items !== undefined) schema.items = toGeminiSchema(node.items);

	if (isRecord(node.properties)) {
		const properties: Record<string, Schema> = {};
		for (const [key, value] of Object.entries(node.properties)) {
			properties[key] = toGeminiSchema(value);
		}
		schema.properties = properties;
	}

	if (Array.isArray(node.required)) {
		const required = node.required.filter((key): key is string => typeof key === "string");
		if (required.length > 0) schema.required = required;
	}

	if (Array.isArray(node.anyOf)) {
		schema.anyOf = node.anyOf.map(toGeminiSchema);
	}

	const minItems = readNumber(node.minItems);
	if (minItems !== undefined) schema.minItems = String(minItems);
	const maxItems = readNumber(node.maxItems);
	if (maxItems !== undefined) schema.maxItems = String(maxItems);

	const minLength = readNumber(node.minLength);
	if (minLength !== undefined) schema.minLength = String(minLength);
	const maxLength = readNumber(node.maxLength);
	if (maxLength !== undefined) schema.maxLength = String(maxLength);

	const minimum = readNumber(node.minimum);
	if (minimum !== undefined) schema.minimum = minimum;
	const maximum = readNumber(node.maximum);
	if (maximum !== undefined) schema.maximum = maximum;

	const pattern = readString(node.pattern);
	if (pattern !== undefined) schema.pattern = pattern;

	// Everything else -- `$ref`, `$defs`, `allOf`, `oneOf`, `const`, `patternProperties`,
	// `additionalProperties` -- is dropped. Gemini rejects the request on any of them, and
	// a tool the model cannot call at all is worse than one described a little loosely.

	return schema;
}

/**
 * A tool's root `parameters`. Gemini requires an object at the root, so the type is
 * asserted here rather than read: a root that says anything else was already refused by
 * `FunctionParameterSchema`, and a request built without it is rejected by the API.
 */
export function toGeminiParameters(parameters: unknown): Schema {
	return { ...toGeminiSchema(parameters), type: Type.OBJECT };
}
