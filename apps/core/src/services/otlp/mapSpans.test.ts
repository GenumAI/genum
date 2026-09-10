import { describe, expect, it } from "vitest";

import { mapOtlpSpans, tracesOf } from "./mapSpans";
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

	it("finds the conversation id on ANY span of the trace, not only the earliest", () => {
		// The numbering pass (`tracesOf`) scans every span for it, so a trace whose tool
		// span starts before its chat span was numbered against a session it was then
		// stored OUTSIDE of: `session_id` came out empty, the turn never appeared in the
		// session read, and the ordinal it consumed was handed to another trace on the next
		// batch. Both passes must agree, permanently -- the table cannot be rewritten.
		const tool = {
			traceId: "t1",
			spanId: "s-tool",
			startTimeUnixNano: "1757500000000000000",
			attributes: attrs({
				"gen_ai.operation.name": "execute_tool",
				"genum.prompt.id": 2,
			}),
		};
		const chat = {
			traceId: "t1",
			spanId: "s-chat",
			startTimeUnixNano: "1757500009000000000",
			attributes: attrs({
				"gen_ai.operation.name": "chat",
				"gen_ai.conversation.id": "conv-1",
				"genum.prompt.id": 2,
			}),
		};

		const { rows } = mapOtlpSpans(payload(tool, chat), CONTEXT);

		expect(rows.map((row) => row.session_id)).toEqual(["conv-1", "conv-1"]);
		expect(tracesOf(payload(tool, chat))[0].sessionId).toBe("conv-1");
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

	it("stores the answer as text, not as the message envelope it arrived in", () => {
		// `spansToSteps` makes a chat row's `output` the text of a `final` step, so an
		// envelope stored verbatim becomes the expected answer of any testcase pinned from
		// this session -- and no replay can ever produce a JSON array of message objects.
		// Every ingested regression test would be NOK by construction.
		const { rows } = mapOtlpSpans(
			payload({
				...CHAT,
				attributes: [
					...(CHAT.attributes ?? []),
					{
						key: "gen_ai.output.messages",
						value: {
							stringValue: JSON.stringify([
								{ role: "assistant", parts: [{ type: "text", content: "21C and clear." }] },
							]),
						},
					},
				],
			}),
			CONTEXT,
		);

		expect(rows[0].output).toBe("21C and clear.");
	});

	it("reads the older {role, content} answer shape too", () => {
		const { rows } = mapOtlpSpans(
			payload({
				...CHAT,
				attributes: [
					...(CHAT.attributes ?? []),
					{
						key: "gen_ai.output.messages",
						value: { stringValue: JSON.stringify([{ role: "assistant", content: "sunny" }]) },
					},
				],
			}),
			CONTEXT,
		);

		expect(rows[0].output).toBe("sunny");
	});

	it("keeps an answer it cannot parse rather than dropping it", () => {
		// A sender that puts a bare string there is not conforming, but the answer is the
		// one thing worth keeping even when the envelope is unrecognisable.
		const { rows } = mapOtlpSpans(
			payload({
				...CHAT,
				attributes: [
					...(CHAT.attributes ?? []),
					{ key: "gen_ai.output.messages", value: { stringValue: "just an answer" } },
				],
			}),
			CONTEXT,
		);

		expect(rows[0].output).toBe("just an answer");
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

	it("rejects a prompt id the column cannot hold, instead of wrapping it", () => {
		// `prompt_id` is UInt32. Verified against the server: 5000000000 is stored as
		// 705032704, so the spans land silently on a DIFFERENT prompt's page -- in an
		// append-only table, permanently. A negative id is worse: the insert fails, the
		// controller answers 503, and a collector retries a failed batch whole, so one
		// malformed attribute blocks the session forever. Both bypass `partialSuccess`,
		// which exists precisely so a bad span cannot take a good batch down with it.
		for (const id of ["5000000000", "-1", "1e30"]) {
			const { rows, rejected } = mapOtlpSpans(
				payload({
					...CHAT,
					attributes: [
						...(CHAT.attributes ?? []),
						{ key: "genum.prompt.id", value: { stringValue: id } },
					],
				}),
				// No default: the bad value must be REFUSED, not quietly replaced by one
				// that happens to be lying around.
				{ orgId: 1, projectId: 2 },
			);

			expect(rows).toHaveLength(0);
			expect(rejected).toBe(1);
		}
	});

	it("keeps usage counts the column can hold and drops the rest to zero", () => {
		// Display-only numbers, so a nonsensical one is worth ignoring rather than
		// refusing the span it came on -- but never worth handing to a UInt32 insert.
		const { rows, rejected } = mapOtlpSpans(
			payload({
				...CHAT,
				attributes: attrs({
					"gen_ai.operation.name": "chat",
					"genum.prompt.id": 2,
					"gen_ai.usage.input_tokens": -5,
					"gen_ai.usage.output_tokens": 9999999999,
				}),
			}),
			CONTEXT,
		);

		expect(rejected).toBe(0);
		expect(rows[0]).toMatchObject({ tokens_in: 0, tokens_out: 0 });
	});

	it("survives a start time that is not an integer, or is beyond a date", () => {
		// `BigInt("1757500000000000000.0")` throws SyntaxError. Uncaught, it escaped the
		// controller as a 500 carrying the raw error text, and the collector retried the
		// same batch forever. A hand-rolled exporter sending an ISO string does the same.
		for (const start of ["1757500000000000000.0", "2026-09-10T00:00:00Z", "1e30", ""]) {
			const { rows, rejected } = mapOtlpSpans(
				payload({ ...CHAT, startTimeUnixNano: start }),
				CONTEXT,
			);

			expect(rejected).toBe(0);
			expect(rows).toHaveLength(1);
			expect(new Date(`${rows[0].timestamp}Z`).getUTCFullYear()).toBeGreaterThan(2020);
		}
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
				payload(
					turn("t1", [
						{ role: "user", content: "what is the weather?" },
						{ role: "assistant", content: "sunny" },
						{ role: "user", content: "and tomorrow?" },
					]),
				),
				{ ...CONTEXT, turnIndexByTrace: new Map([["t1", 1]]) },
			);

			expect(rows.find((row) => row.span_type === "user")?.output).toBe("and tomorrow?");
		});

		it("decides from the messages, not from the ordinal it was handed", () => {
			// The ordinal comes from arrival order, which a collector restart can invert.
			// Keyed on it, a turn delivered before its predecessor took ordinal 0 and lost
			// its reply, while the predecessor arriving second was given a spurious reply
			// holding the session's opening question -- both permanent, both invisible.
			const openingNumberedLate = mapOtlpSpans(payload(turn("t0", OPENING)), {
				...CONTEXT,
				turnIndexByTrace: new Map([["t0", 5]]),
			});
			const replyNumberedFirst = mapOtlpSpans(payload(turn("t1", REPLY)), {
				...CONTEXT,
				turnIndexByTrace: new Map([["t1", 0]]),
			});

			// One user entry is the opening question, whatever ordinal it was given.
			expect(openingNumberedLate.rows.some((row) => row.span_type === "user")).toBe(false);
			// Two means this turn was provoked by the last of them, likewise.
			expect(replyNumberedFirst.rows.find((row) => row.span_type === "user")?.output).toBe(
				"and tomorrow?",
			);
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
