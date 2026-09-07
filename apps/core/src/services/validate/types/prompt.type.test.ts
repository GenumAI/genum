import { describe, it, expect, vi } from "vitest";

// `prompt.type.ts` pulls SourceType/LogLevel from the logger barrel, which builds a
// ClickHouse client off the validated env at import time.
vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

import { PromptRunSchema } from "./prompt.type";

const TRACE = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

describe("PromptRunSchema", () => {
	it("leaves the single-shot path untouched when messages are absent", () => {
		const parsed = PromptRunSchema.parse({ question: "hi" });

		expect(parsed.messages).toBeUndefined();
		expect(parsed.traceId).toBeUndefined();
		expect(parsed.files).toEqual([]);
	});

	it("accepts a continuation turn carrying its trace", () => {
		const parsed = PromptRunSchema.parse({
			question: "weather?",
			traceId: TRACE,
			messages: [
				{
					role: "assistant",
					content: "",
					toolCalls: [{ id: "call_1", name: "get_weather", args: { city: "Zagreb" } }],
				},
				{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
			],
		});

		expect(parsed.traceId).toBe(TRACE);
		expect(parsed.messages).toHaveLength(2);
	});

	it("rejects a tool message with no toolCallId", () => {
		expect(() =>
			PromptRunSchema.parse({
				question: "weather?",
				traceId: TRACE,
				messages: [{ role: "tool", name: "get_weather", content: "12C" }],
			}),
		).toThrow();
	});

	it("rejects an unknown key inside a message", () => {
		expect(() =>
			PromptRunSchema.parse({
				question: "weather?",
				traceId: TRACE,
				messages: [
					{
						role: "tool",
						toolCallId: "call_1",
						name: "get_weather",
						content: "12C",
						executed: true,
					},
				],
			}),
		).toThrow();
	});

	it("rejects an unknown role", () => {
		expect(() =>
			PromptRunSchema.parse({
				question: "weather?",
				traceId: TRACE,
				messages: [{ role: "system", content: "be nice" }],
			}),
		).toThrow();
	});

	it("rejects empty ids and names: a blank tool name matches nothing on replay", () => {
		expect(() =>
			PromptRunSchema.parse({
				question: "weather?",
				traceId: TRACE,
				messages: [
					{
						role: "assistant",
						content: "",
						toolCalls: [{ id: "", name: "get_weather", args: {} }],
					},
				],
			}),
		).toThrow();

		expect(() =>
			PromptRunSchema.parse({
				question: "weather?",
				traceId: TRACE,
				messages: [{ role: "tool", toolCallId: "call_1", name: "", content: "12C" }],
			}),
		).toThrow();
	});

	it("caps the conversation and each message: every turn is a billed provider call", () => {
		const message = { role: "tool", toolCallId: "c", name: "t", content: "x" };

		expect(() =>
			PromptRunSchema.parse({
				question: "hi",
				traceId: TRACE,
				messages: Array.from({ length: 101 }, () => message),
			}),
		).toThrow();

		expect(() =>
			PromptRunSchema.parse({
				question: "hi",
				traceId: TRACE,
				messages: [{ ...message, content: "x".repeat(32_001) }],
			}),
		).toThrow();
	});

	it("rejects a continuation with no trace, and a trace with no continuation", () => {
		expect(() =>
			PromptRunSchema.parse({
				question: "hi",
				messages: [{ role: "tool", toolCallId: "c", name: "t", content: "x" }],
			}),
		).toThrow();

		expect(() => PromptRunSchema.parse({ question: "hi", traceId: TRACE })).toThrow();
	});

	it("rejects a trace id that is not a uuid", () => {
		expect(() =>
			PromptRunSchema.parse({
				question: "hi",
				traceId: "../../etc/passwd",
				messages: [{ role: "tool", toolCallId: "c", name: "t", content: "x" }],
			}),
		).toThrow();
	});
});
