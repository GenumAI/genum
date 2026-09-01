import { describe, it, expect } from "vitest";
import { mapApiKeyStatsRow, resolveLogPlaceholders, toLogPlaceholders } from "./mappers";

describe("mapApiKeyStatsRow", () => {
	it("coerces the string aggregates ClickHouse returns into numbers", () => {
		const result = mapApiKeyStatsRow({
			api_key_id: "12",
			total_requests: "1240",
			total_tokens_sum: "842100",
			total_cost: "12.4",
			last_activity: "2026-07-24 10:15:30.000",
		});

		expect(result.api_key_id).toBe(12);
		expect(result.total_requests).toBe(1240);
		expect(result.total_tokens_sum).toBe(842100);
		expect(result.total_cost).toBe(12.4);
		expect(result.last_activity).toBe(new Date("2026-07-24T10:15:30.000").toISOString());
	});

	it("keeps a missing last_activity as null", () => {
		const result = mapApiKeyStatsRow({
			api_key_id: 7,
			total_requests: 1,
			total_tokens_sum: 10,
			total_cost: 0.5,
			last_activity: null,
		});

		expect(result.last_activity).toBeNull();
	});

	it("defaults absent aggregates to zero", () => {
		const result = mapApiKeyStatsRow({
			api_key_id: 3,
			total_requests: "",
			total_tokens_sum: "",
			total_cost: "",
			last_activity: null,
		});

		expect(result.total_requests).toBe(0);
		expect(result.total_tokens_sum).toBe(0);
		expect(result.total_cost).toBe(0);
	});
});

describe("toLogPlaceholders", () => {
	it("writes an unresolved key as an empty string", () => {
		// A ClickHouse Map has no null value, and dropping the entry would make
		// "no value resolved" indistinguishable from "the key was not in the text".
		expect(toLogPlaceholders({ admin_role: "true", memory_key: null })).toEqual({
			admin_role: "true",
			memory_key: "",
		});
	});
});

describe("resolveLogPlaceholders", () => {
	it("returns the map when the row has one", () => {
		expect(resolveLogPlaceholders({ placeholders: { admin_role: "true" } })).toEqual({
			admin_role: "true",
		});
	});

	it("presents a legacy memory_key row as a memory_key placeholder", () => {
		expect(resolveLogPlaceholders({ placeholders: {}, memory_key: "client_bmw" })).toEqual({
			memory_key: "client_bmw",
		});
	});

	it("returns undefined when the row carries neither", () => {
		expect(resolveLogPlaceholders({ placeholders: {}, memory_key: null })).toBeUndefined();
	});
});
