import { describe, expect, it } from "vitest";
import { Type } from "@google/genai";

import { toGeminiParameters, toGeminiSchema } from "./schema";

describe("toGeminiSchema", () => {
	it("keeps an array's items", () => {
		// The regression this file exists for: the old mapping kept only type and
		// description, so a list parameter reached the model as `{"type":"array"}` and
		// the model was never told what goes in it.
		expect(toGeminiSchema({ type: "array", items: { type: "string" } })).toEqual({
			type: Type.ARRAY,
			items: { type: Type.STRING },
		});
	});

	it("keeps a nested object's properties and required list", () => {
		expect(
			toGeminiSchema({
				type: "object",
				properties: {
					user: {
						type: "object",
						properties: { name: { type: "string" } },
						required: ["name"],
					},
				},
			}),
		).toEqual({
			type: Type.OBJECT,
			properties: {
				user: {
					type: Type.OBJECT,
					properties: { name: { type: Type.STRING } },
					required: ["name"],
				},
			},
		});
	});

	it("keeps an enum", () => {
		expect(toGeminiSchema({ type: "string", enum: ["a", "b"] })).toEqual({
			type: Type.STRING,
			enum: ["a", "b"],
		});
	});

	it("spells a non-string enum out, because Gemini's enum is a string list", () => {
		expect(toGeminiSchema({ type: "number", enum: [1, 2] })).toEqual({
			type: Type.NUMBER,
			enum: ["1", "2"],
		});
	});

	it("maps integer to INTEGER, not to STRING", () => {
		// The old mapping had no integer case and fell through to its STRING default, so
		// every integer parameter was declared to the model as text.
		expect(toGeminiSchema({ type: "integer" })).toEqual({ type: Type.INTEGER });
	});

	it("reads a nullable type list as Gemini's nullable flag", () => {
		expect(toGeminiSchema({ type: ["string", "null"] })).toEqual({
			type: Type.STRING,
			nullable: true,
		});
	});

	it("keeps the bounds Gemini documents, as the strings it expects", () => {
		expect(
			toGeminiSchema({ type: "array", minItems: 1, maxItems: 5 }),
		).toEqual({
			type: Type.ARRAY,
			minItems: "1",
			maxItems: "5",
		});
	});

	it("keeps a supported format and drops one Gemini does not know", () => {
		expect(toGeminiSchema({ type: "string", format: "date-time" })).toEqual({
			type: Type.STRING,
			format: "date-time",
		});
		expect(toGeminiSchema({ type: "string", format: "uuid" })).toEqual({
			type: Type.STRING,
		});
	});

	it("drops keywords Gemini rejects rather than forwarding them", () => {
		// Forwarding one fails the whole request, so the tool cannot be called at all --
		// strictly worse than describing it a little loosely.
		expect(
			toGeminiSchema({
				type: "object",
				properties: { a: { type: "string" } },
				additionalProperties: false,
				$ref: "#/$defs/x",
				allOf: [{ type: "object" }],
				const: "x",
			}),
		).toEqual({
			type: Type.OBJECT,
			properties: { a: { type: Type.STRING } },
		});
	});

	it("survives a node that is not an object", () => {
		expect(toGeminiSchema(null)).toEqual({});
		expect(toGeminiSchema("string")).toEqual({});
		expect(toGeminiSchema(undefined)).toEqual({});
	});

	it("drops a type it does not recognise instead of calling it a string", () => {
		// Declaring an unknown type as STRING tells the model something false. Saying
		// nothing about the type leaves the description to carry it.
		expect(toGeminiSchema({ type: "tuple", description: "a pair" })).toEqual({
			description: "a pair",
		});
	});
});

describe("toGeminiParameters", () => {
	it("declares the root an object even when the schema omitted it", () => {
		expect(toGeminiParameters({ properties: { a: { type: "string" } } })).toEqual({
			type: Type.OBJECT,
			properties: { a: { type: Type.STRING } },
		});
	});

	it("carries a real tool's whole shape through", () => {
		expect(
			toGeminiParameters({
				type: "object",
				properties: {
					city: { type: "string", description: "City name" },
					days: { type: "integer", minimum: 1, maximum: 14 },
					units: { type: "string", enum: ["metric", "imperial"] },
					tags: { type: "array", items: { type: "string" }, maxItems: 3 },
				},
				required: ["city"],
			}),
		).toEqual({
			type: Type.OBJECT,
			properties: {
				city: { type: Type.STRING, description: "City name" },
				days: { type: Type.INTEGER, minimum: 1, maximum: 14 },
				units: { type: Type.STRING, enum: ["metric", "imperial"] },
				tags: { type: Type.ARRAY, items: { type: Type.STRING }, maxItems: "3" },
			},
			required: ["city"],
		});
	});
});
