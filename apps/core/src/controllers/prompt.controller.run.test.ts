import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: { prompts: {} },
}));

vi.mock("@/services/access/AccessService", () => ({
	checkPromptAccess: vi.fn(),
	checkPlaceholderAccess: vi.fn(),
}));

vi.mock("@/ai/runner/run", () => ({
	runPrompt: vi.fn(),
}));

vi.mock("@/services/file.service", () => ({
	fileService: { getFileObjectsByIds: vi.fn() },
}));

// Only the two writers are stubbed; SourceType, LogType and the rest stay real.
vi.mock("@/services/logger", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/services/logger")>()),
	logUsage: vi.fn(),
	logSpans: vi.fn(),
	getPromptLogs: vi.fn(),
}));

import { checkPromptAccess } from "@/services/access/AccessService";
import { runPrompt } from "@/ai/runner/run";
import { fileService } from "@/services/file.service";
import { deriveTurnTraceId, logSpans, logUsage } from "@/services/logger";
import type { LogDocument } from "@/services/logger";
import { PromptsController } from "./prompt.controller";

const PROJECT = 10;
const ORG = 3;
const PROMPT = 77;
const TRACE = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";

function makeReq(body: unknown): Request {
	return {
		params: { id: String(PROMPT) },
		body,
		genumMeta: { ids: { userID: 1, orgID: ORG, projID: PROJECT } },
	} as unknown as Request;
}

function makeRes() {
	const captured: { statusCode: number; body: any } = { statusCode: 0, body: undefined };
	const res = {
		status(code: number) {
			captured.statusCode = code;
			return this;
		},
		json(payload: unknown) {
			captured.body = payload;
			return this;
		},
	};
	return { res: res as unknown as Response, captured };
}

/** The usage document `runPrompt` hands to `collectUsage` on a successful turn. */
function usageDocument(): LogDocument {
	return {
		source: "ui",
		log_type: "prs",
		log_lvl: "SUCCESS",
		orgId: ORG,
		project_id: PROJECT,
		prompt_id: PROMPT,
		user_id: 1,
		vendor: "OPENAI",
		model: "gpt-4o",
		tokens_in: 10,
		tokens_out: 5,
		tokens_sum: 15,
		cost: 0.02,
		response_ms: 100,
		in: "weather?",
		out: "",
		placeholders: {},
	} as unknown as LogDocument;
}

/** Makes `runPrompt` behave like the real one: hand usage over, return the completion. */
function mockRun(result: { answer: string; toolCalls?: unknown[] }) {
	vi.mocked(runPrompt).mockImplementation((async (params: any) => {
		params.collectUsage?.(usageDocument());
		return { ...result, cost: { total: 0.02 }, placeholders: {} };
	}) as never);
}

describe("PromptsController.runPrompt", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();
		vi.mocked(fileService.getFileObjectsByIds).mockResolvedValue([] as never);
		vi.mocked(checkPromptAccess).mockResolvedValue({
			id: PROMPT,
			projectId: PROJECT,
			value: "do this",
		} as never);
	});

	it("logs a plain run exactly as before: one prs row, no trace, no spans", async () => {
		mockRun({ answer: "sunny" });
		const { res, captured } = makeRes();

		await controller.runPrompt(makeReq({ question: "weather?" }), res);

		expect(captured.statusCode).toBe(200);
		expect(captured.body.traceId).toBeUndefined();
		expect(logUsage).toHaveBeenCalledTimes(1);
		const row = vi.mocked(logUsage).mock.calls[0][0];
		expect(row.log_type).toBe("prs");
		expect(row.trace_id).toBeUndefined();
		expect(logSpans).not.toHaveBeenCalled();
	});

	it("mints a trace on the turn that first calls a tool and returns it", async () => {
		mockRun({ answer: "", toolCalls: [{ id: "call_1", name: "get_weather", args: {} }] });
		const { res, captured } = makeRes();

		await controller.runPrompt(makeReq({ question: "weather?" }), res);

		const traceId = captured.body.traceId;
		expect(traceId).toMatch(/^[0-9a-f-]{36}$/);
		const row = vi.mocked(logUsage).mock.calls[0][0];
		// Turn 1 stays "prs", so run counts still see one trajectory once.
		expect(row.log_type).toBe("prs");
		expect(row.trace_id).toBe(traceId);
		// The call has no result yet, so there is no completed step to append.
		expect(logSpans).not.toHaveBeenCalled();
	});

	it("logs a continuation turn as prt on the trace it was given, and appends its spans", async () => {
		mockRun({ answer: "It is 12 degrees." });
		const { res, captured } = makeRes();

		await controller.runPrompt(
			makeReq({
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
			}),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(captured.body.traceId).toBe(TRACE);

		// Usage is written for THIS turn as it happens -- never held for a "final" turn
		// the server cannot identify, and never lost when a trajectory is abandoned.
		expect(logUsage).toHaveBeenCalledTimes(1);
		const row = vi.mocked(logUsage).mock.calls[0][0];
		expect(row.log_type).toBe("prt");
		expect(row.trace_id).toBe(TRACE);
		expect(row.cost).toBe(0.02);

		expect(logSpans).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(logSpans).mock.calls[0][0];
		// `traceId` addresses the SESSION; the turn gets its own trace id, derived from
		// (session, turn index) rather than random, so a retried request lands on the same
		// trace and the queued (trace_id, span_id) dedup can actually collapse it.
		expect(batch.trace_id).not.toBe(TRACE);
		expect(batch.trace_id).toBe(deriveTurnTraceId(TRACE, 0));
		expect(batch.session_id).toBe(TRACE);
		expect(batch.turn_index).toBe(0);
		expect(batch.steps).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Zagreb" },
				recordedResult: "12C",
			},
			{ kind: "final", text: "It is 12 degrees." },
		]);
	});

	it("emits a turn's every tool call, not only the last request's, when the turn ends", async () => {
		mockRun({ answer: "Done." });
		const { res } = makeRes();

		await controller.runPrompt(
			makeReq({
				question: "weather?",
				traceId: TRACE,
				messages: [
					{
						role: "assistant",
						content: "",
						toolCalls: [{ id: "call_1", name: "get_weather", args: {} }],
					},
					{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
					{
						role: "assistant",
						content: "",
						toolCalls: [{ id: "call_2", name: "get_time", args: {} }],
					},
					{ role: "tool", toolCallId: "call_2", name: "get_time", content: "10:00" },
				],
			}),
			res,
		);

		const batch = vi.mocked(logSpans).mock.calls[0][0];
		expect(batch.turn_index).toBe(0);
		expect(batch.steps.map((step) => step.kind)).toEqual(["tool_call", "tool_call", "final"]);
	});

	it("writes nothing mid-turn and one whole batch on the request the turn ends on", async () => {
		// The model asks for a SECOND tool inside the same turn: nothing is known yet, so
		// nothing is written.
		mockRun({ answer: "", toolCalls: [{ id: "call_2", name: "get_time", args: {} }] });
		const { res: midRes } = makeRes();
		await controller.runPrompt(
			makeReq({
				question: "weather?",
				traceId: TRACE,
				messages: [
					{
						role: "assistant",
						content: "",
						toolCalls: [{ id: "call_1", name: "get_weather", args: {} }],
					},
					{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
				],
			}),
			midRes,
		);
		expect(logSpans).not.toHaveBeenCalled();

		// The turn ends here: one batch, carrying the SESSION id and the turn's own trace.
		mockRun({ answer: "12 in Zagreb" });
		const { res: endRes } = makeRes();
		await controller.runPrompt(
			makeReq({
				question: "weather?",
				traceId: TRACE,
				messages: [
					{
						role: "assistant",
						content: "",
						toolCalls: [{ id: "call_1", name: "get_weather", args: {} }],
					},
					{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
				],
			}),
			endRes,
		);

		expect(logSpans).toHaveBeenCalledTimes(1);
		const batch = vi.mocked(logSpans).mock.calls[0][0];
		expect(batch.session_id).toBe(TRACE);
		expect(batch.trace_id).not.toBe(TRACE);
		expect(batch.trace_id).toBe(deriveTurnTraceId(TRACE, 0));
	});

	it("retries the SAME turn-ending request onto the same trace, so dedup can collapse it", async () => {
		// OTLP delivers at least once and the playground retries a turn-ending request it
		// never got a response for. The retry must land on the same trace id as the
		// original write -- a random per-call id would defeat the queued (trace_id,
		// span_id) dedup entirely.
		mockRun({ answer: "12 in Zagreb" });
		const { res: firstRes } = makeRes();
		const body = {
			question: "weather?",
			traceId: TRACE,
			messages: [
				{
					role: "assistant",
					content: "",
					toolCalls: [{ id: "call_1", name: "get_weather", args: {} }],
				},
				{ role: "tool", toolCallId: "call_1", name: "get_weather", content: "12C" },
			],
		};
		await controller.runPrompt(makeReq(body), firstRes);

		mockRun({ answer: "12 in Zagreb" });
		const { res: retryRes } = makeRes();
		await controller.runPrompt(makeReq(body), retryRes);

		expect(logSpans).toHaveBeenCalledTimes(2);
		const [first, retry] = vi.mocked(logSpans).mock.calls.map((call) => call[0]);
		expect(retry.trace_id).toBe(first.trace_id);
		expect(retry.trace_id).toBe(deriveTurnTraceId(TRACE, 0));
	});

	it("forwards the conversation to the runner unchanged", async () => {
		mockRun({ answer: "done" });
		const { res } = makeRes();
		const messages = [{ role: "tool", toolCallId: "call_1", name: "t", content: "r" }];

		await controller.runPrompt(makeReq({ question: "q", traceId: TRACE, messages }), res);

		expect(vi.mocked(runPrompt).mock.calls[0][0].messages).toEqual(messages);
	});

	it("mints a trace for a continuation that carries no trace, logging it as a turn", async () => {
		// Was: rejected outright, because the old refine required messages and traceId
		// together. A continuation with no trace is exactly the case the server now
		// mints one for -- "Turn 1 answers plainly, turn 2 asks the real question" never
		// gets a traceId from the client on turn 1, so turn 2 must be allowed to arrive
		// without one.
		mockRun({ answer: "done" });
		const { res, captured } = makeRes();

		await controller.runPrompt(
			makeReq({
				question: "q",
				messages: [{ role: "tool", toolCallId: "call_1", name: "t", content: "r" }],
			}),
			res,
		);

		expect(runPrompt).toHaveBeenCalledTimes(1);
		expect(captured.body.traceId).toMatch(/^[0-9a-f-]{36}$/);
		const row = vi.mocked(logUsage).mock.calls[0][0];
		expect(row.log_type).toBe("prt");
	});

	it("refuses a continuation whose reply lost the answer it replies to, before billing", async () => {
		// The shape a stale browser bundle sends after a deploy, and one any third-party
		// caller may send. It parses -- every message is individually valid -- and would
		// write the tool call a second time plus a `user` span onto an index the turn's
		// `final` already holds, into an append-only table that can never be corrected.
		mockRun({ answer: "whatever" });
		const { res } = makeRes();

		await expect(
			controller.runPrompt(
				makeReq({
					question: "q",
					traceId: TRACE,
					messages: [
						{
							role: "assistant",
							content: "",
							toolCalls: [{ id: "1", name: "t", args: {} }],
						},
						{ role: "tool", toolCallId: "1", name: "t", content: "{}" },
						{ role: "user", content: "and in London?" },
					],
				}),
				res,
			),
		).rejects.toMatchObject({ statusCode: 400 });

		// Refused before the provider is called and before anything is written: a
		// rejection that still bills the turn and still writes the corrupt spans would
		// be no rejection at all.
		expect(runPrompt).not.toHaveBeenCalled();
		expect(logUsage).not.toHaveBeenCalled();
		expect(logSpans).not.toHaveBeenCalled();
	});

	it("still rejects a traceId sent without messages", async () => {
		mockRun({ answer: "done" });
		const { res } = makeRes();

		await expect(
			controller.runPrompt(makeReq({ question: "q", traceId: TRACE }), res),
		).rejects.toThrow();
		expect(runPrompt).not.toHaveBeenCalled();
	});

	it("mints a trace for a session that continued without calling a tool", async () => {
		// "Turn 1 answers plainly, turn 2 asks the real question" is a normal agent
		// session, and the old rule -- a trace exists only once a trajectory does --
		// made it unrecordable. Not calling a tool is itself an answer worth pinning.
		mockRun({ answer: "hi" });
		const { res: firstRes, captured: first } = makeRes();
		await controller.runPrompt(makeReq({ question: "hello" }), firstRes);
		expect(first.body.traceId).toBeUndefined();

		mockRun({ answer: "the real answer" });
		const { res: secondRes, captured: second } = makeRes();
		await controller.runPrompt(
			makeReq({
				question: "hello",
				messages: [
					{ role: "assistant", content: "hi" },
					{ role: "user", content: "now the real question" },
				],
			}),
			secondRes,
		);
		expect(second.body.traceId).toMatch(/^[0-9a-f-]{36}$/);
	});

	it("counts a user reply as a run and a tool continuation as a turn", async () => {
		mockRun({ answer: "again" });
		const { res: userRes } = makeRes();
		await controller.runPrompt(
			makeReq({
				question: "q",
				traceId: TRACE,
				// The answer the reply replies to travels with it: a continuation without
				// it is refused, because its spans cannot be numbered (see
				// `conversationNumberingProblem`).
				messages: [
					{ role: "assistant", content: "the previous answer" },
					{ role: "user", content: "again" },
				],
			}),
			userRes,
		);
		expect(vi.mocked(logUsage).mock.calls[0][0].log_type).toBe("prs");

		mockRun({ answer: "tool answer" });
		const { res: toolRes } = makeRes();
		await controller.runPrompt(
			makeReq({
				question: "q",
				traceId: TRACE,
				messages: [{ role: "tool", toolCallId: "1", name: "t", content: "{}" }],
			}),
			toolRes,
		);
		expect(vi.mocked(logUsage).mock.calls[1][0].log_type).toBe("prt");
	});
});
