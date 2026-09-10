import { describe, expect, it } from "vitest";

import { mapOtlpSpans } from "./mapSpans";
import { formatClickHouseTimestamp } from "@/services/logger/mappers";
import type { OtlpAttribute, OtlpPayload, OtlpSpan } from "./types";

const CONTEXT = { orgId: 1, projectId: 2, defaultPromptId: 9 };

function attrs(pairs: Record<string, string | number>): OtlpAttribute[] {
	return Object.entries(pairs).map(([key, value]) => ({
		key,
		// An int64 crosses JSON as a string. Written that way here on purpose: a fixture
		// that sends numbers would pass against a mapping that cannot read real traffic.
		value: typeof value === "number" ? { intValue: String(value) } : { stringValue: value },
	}));
}

function payload(...spans: OtlpSpan[]): OtlpPayload {
	return { resourceSpans: [{ scopeSpans: [{ spans }] }] };
}

const CHAT: OtlpSpan = {
	traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
	spanId: "00f067aa0ba902b7",
	name: "chat gpt-4o",
	startTimeUnixNano: "1757500000000000000",
	attributes: attrs({
		"gen_ai.operation.name": "chat",
		"gen_ai.request.model": "gpt-4o",
		"gen_ai.system": "openai",
		"gen_ai.usage.input_tokens": 120,
		"gen_ai.usage.output_tokens": 34,
	}),
};

describe("mapOtlpSpans", () => {
	it("maps a chat span field for field, per the spec's table", () => {
		const { rows, rejected } = mapOtlpSpans(payload(CHAT), CONTEXT);

		expect(rejected).toBe(0);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
			span_id: "00f067aa0ba902b7",
			span_type: "chat",
			name: "chat gpt-4o",
			model: "gpt-4o",
			vendor: "openai",
			tokens_in: 120,
			tokens_out: 34,
			orgId: 1,
			project_id: 2,
			prompt_id: 9,
		});
	});

	it("keeps the sender's ids verbatim", () => {
		// S4. An id we re-encoded cannot be pasted into the sender's own tracing UI, which
		// is the main reason anyone looks at this page. 16 hex for a span, 32 for a trace --
		// neither is a UUID, and neither is made into one.
		const { rows } = mapOtlpSpans(payload(CHAT), CONTEXT);

		expect(rows[0].span_id).toBe("00f067aa0ba902b7");
		expect(rows[0].trace_id).toBe("4bf92f3577b34da6a3ce929d0e0e4736");
	});

	it("stores a parent span id, and reads an empty one as no parent", () => {
		// S3: the tree is recorded as sent, even though this version renders it flat.
		const withParent = mapOtlpSpans(
			payload({ ...CHAT, parentSpanId: "aaaaaaaaaaaaaaaa" }),
			CONTEXT,
		);
		const withoutParent = mapOtlpSpans(payload({ ...CHAT, parentSpanId: "" }), CONTEXT);

		expect(withParent.rows[0].parent_span_id).toBe("aaaaaaaaaaaaaaaa");
		expect(withoutParent.rows[0].parent_span_id).toBeNull();
	});

	it("turns nanoseconds into the timestamp literal ClickHouse takes", () => {
		const { rows } = mapOtlpSpans(payload(CHAT), CONTEXT);

		// 1757500000000000000ns is 1757500000000ms, written in the same UTC literal every
		// other timestamp reaches ClickHouse in -- a `DateTime64(3)` column does not read
		// a bare epoch number the way one might expect.
		//
		// The nanoseconds themselves never pass through Number(): 1.75e18 is past
		// MAX_SAFE_INTEGER and would come back changed.
		expect(rows[0].timestamp).toBe(formatClickHouseTimestamp(new Date(1757500000000)));
	});

	it("falls back to now for a span with no start time, rather than to 1970", () => {
		const { rows } = mapOtlpSpans(payload({ ...CHAT, startTimeUnixNano: undefined }), CONTEXT);

		// A row stamped at the epoch lands in a partition of its own and reads as older
		// than every other row forever; this table is append-only, so it cannot be fixed.
		expect(new Date(`${rows[0].timestamp}Z`).getUTCFullYear()).toBeGreaterThan(2020);
	});

	it("groups by gen_ai.conversation.id, and gives a span without one a session of its own", () => {
		const withConversation = mapOtlpSpans(
			payload({
				...CHAT,
				attributes: [...(CHAT.attributes ?? []), ...attrs({ "gen_ai.conversation.id": "c1" })],
			}),
			CONTEXT,
		);
		const without = mapOtlpSpans(payload(CHAT), CONTEXT);

		expect(withConversation.rows[0].session_id).toBe("c1");
		// Empty, NOT the trace id copied across. The conventions forbid inventing a
		// conversation id, and the read path already treats empty as a session of one trace.
		expect(without.rows[0].session_id).toBe("");
	});

	it("writes cost 0 and source otlp on every row", () => {
		// The one irreversible requirement of the quota decision: `trace_spans` is
		// append-only, so a row that does not say it was ingested can never be made to.
		const { rows } = mapOtlpSpans(
			payload(CHAT, { ...CHAT, spanId: "00f067aa0ba902b8" }),
			CONTEXT,
		);

		expect(rows.every((row) => row.cost === 0)).toBe(true);
		expect(rows.every((row) => row.source === "otlp")).toBe(true);
	});

	it("maps a tool span's name, arguments and result", () => {
		const { rows } = mapOtlpSpans(
			payload({
				...CHAT,
				name: "execute_tool get_weather",
				attributes: attrs({
					"gen_ai.operation.name": "execute_tool",
					"gen_ai.tool.name": "get_weather",
					"gen_ai.tool.call.arguments": '{"city":"Kyiv"}',
					"gen_ai.tool.call.result": '{"c":21}',
				}),
			}),
			CONTEXT,
		);

		expect(rows[0]).toMatchObject({
			span_type: "execute_tool",
			name: "execute_tool get_weather",
			tool_args: '{"city":"Kyiv"}',
			tool_result: '{"c":21}',
		});
	});

	it("stores an operation it does not model instead of refusing it", () => {
		const { rows, rejected } = mapOtlpSpans(
			payload({
				...CHAT,
				name: "embeddings text-embedding-3",
				attributes: attrs({ "gen_ai.operation.name": "embeddings" }),
			}),
			CONTEXT,
		);

		expect(rejected).toBe(0);
		// Kept as sent. A span we cannot interpret is still one the author may want to see.
		expect(rows[0].span_type).toBe("embeddings");
	});

	it("prefers genum.prompt.id over the key's default", () => {
		const { rows } = mapOtlpSpans(
			payload({
				...CHAT,
				attributes: [...(CHAT.attributes ?? []), ...attrs({ "genum.prompt.id": 42 })],
			}),
			CONTEXT,
		);

		expect(rows[0].prompt_id).toBe(42);
	});

	it("rejects a span with no prompt anywhere, and says why", () => {
		// Never guessed. A guessed prompt puts a customer's traces on someone else's page.
		const { rows, rejected, reasons } = mapOtlpSpans(payload(CHAT), {
			orgId: 1,
			projectId: 2,
		});

		expect(rows).toHaveLength(0);
		expect(rejected).toBe(1);
		expect(reasons.join(" ")).toContain("prompt");
	});

	it("rejects a span with no trace id or no span id", () => {
		const { rows, rejected } = mapOtlpSpans(
			payload({ ...CHAT, spanId: undefined }, { ...CHAT, traceId: undefined }),
			CONTEXT,
		);

		// Dedup is on (trace_id, span_id). A row missing either can never be collapsed,
		// so it would duplicate itself permanently on the first retry.
		expect(rows).toHaveLength(0);
		expect(rejected).toBe(2);
	});

	it("numbers spans within a trace from zero, in start-time order", () => {
		const later = { ...CHAT, spanId: "bbbbbbbbbbbbbbbb", startTimeUnixNano: "1757500009000000000" };
		const earlier = { ...CHAT, spanId: "aaaaaaaaaaaaaaaa", startTimeUnixNano: "1757500001000000000" };

		const { rows } = mapOtlpSpans(payload(later, earlier), CONTEXT);

		expect(rows.map((row) => [row.span_id, row.span_index])).toEqual([
			["aaaaaaaaaaaaaaaa", 0],
			["bbbbbbbbbbbbbbbb", 1],
		]);
	});

	describe("the human reply (S2)", () => {
		const conversation = attrs({ "gen_ai.conversation.id": "c1" });

		function turn(traceId: string, messages: unknown): OtlpSpan {
			return {
				...CHAT,
				traceId,
				spanId: `span-${traceId}`,
				attributes: [
					...(CHAT.attributes ?? []),
					...conversation,
					{ key: "gen_ai.input.messages", value: { stringValue: JSON.stringify(messages) } },
				],
			};
		}

		const OPENING = [{ role: "user", parts: [{ type: "text", content: "what is the weather?" }] }];
		const REPLY = [
			...OPENING,
			{ role: "assistant", parts: [{ type: "text", content: "sunny" }] },
			{ role: "user", parts: [{ type: "text", content: "and tomorrow?" }] },
		];

		it("derives a user step for a turn that is not the first, from the last user entry", () => {
			const { rows } = mapOtlpSpans(payload(turn("t0", OPENING), turn("t1", REPLY)), {
				...CONTEXT,
				turnIndexByTrace: new Map([
					["t0", 0],
					["t1", 1],
				]),
			});

			const user = rows.filter((row) => row.span_type === "user");
			expect(user).toHaveLength(1);
			expect(user[0]).toMatchObject({
				trace_id: "t1",
				turn_index: 1,
				output: "and tomorrow?",
				// First step of its turn: the reply is what provoked everything after it.
				span_index: 0,
			});
		});

		it("derives nothing for the first turn", () => {
			// Turn 0's last user message is the session's opening question, which is the
			// testcase's `input`. Stored as a step it would replay as a reply the author
			// never sent, ahead of the question that actually opened the conversation.
			const { rows } = mapOtlpSpans(payload(turn("t0", OPENING)), {
				...CONTEXT,
				turnIndexByTrace: new Map([["t0", 0]]),
			});

			expect(rows.some((row) => row.span_type === "user")).toBe(false);
		});

		it("derives nothing when the attribute is absent, and does not fail", () => {
			const { rows, rejected } = mapOtlpSpans(
				payload({ ...CHAT, traceId: "t1", attributes: [...(CHAT.attributes ?? []), ...conversation] }),
				{ ...CONTEXT, turnIndexByTrace: new Map([["t1", 1]]) },
			);

			expect(rejected).toBe(0);
			expect(rows.some((row) => row.span_type === "user")).toBe(false);
		});

		it("reads the older {role, content} message shape too", () => {
			const { rows } = mapOtlpSpans(
				payload(turn("t1", [{ role: "user", content: "and tomorrow?" }])),
				{ ...CONTEXT, turnIndexByTrace: new Map([["t1", 1]]) },
			);

			expect(rows.find((row) => row.span_type === "user")?.output).toBe("and tomorrow?");
		});

		it("numbers the payload's own traces when the caller knows no ordinals", () => {
			// A first delivery: two traces of one conversation, ordered by start time. The
			// second is not the first turn, so its reply is derived even with no map.
			const first = turn("t0", OPENING);
			const second = { ...turn("t1", REPLY), startTimeUnixNano: "1757500900000000000" };

			const { rows } = mapOtlpSpans(payload(second, first), CONTEXT);

			expect(rows.find((row) => row.trace_id === "t0")?.turn_index).toBe(0);
			expect(rows.find((row) => row.trace_id === "t1")?.turn_index).toBe(1);
			expect(rows.find((row) => row.span_type === "user")?.trace_id).toBe("t1");
		});
	});
});
