import type { Request, Response } from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OtlpController } from "./otlp.controller";
import { db } from "@/database/db";
import { getSessionTraceIds, insertSpanRows, logUsage } from "@/services/logger";

vi.mock("@/database/db", () => ({
	db: {
		project: {
			getProjectApiKeyByToken: vi.fn(),
			getProjectbyApiKeyById: vi.fn(),
		},
	},
}));

vi.mock("@/services/logger", () => ({
	insertSpanRows: vi.fn(),
	getSessionTraceIds: vi.fn(),
	logUsage: vi.fn(),
	SourceType: { ui: "ui", testcase: "testcase", api: "api", otlp: "otlp" },
	LogLevel: { success: "SUCCESS", info: "INFO", warn: "WARN", error: "ERROR" },
	LogType: {
		PromptRunSuccess: "prs",
		PromptRunTurn: "prt",
		TraceIngested: "oti",
		PromptRunError: "pre",
		AIError: "ae",
		TechnicalError: "te",
	},
}));

const KEY = { id: 7 };
const PROJECT = { id: 3, organizationId: 11 };

function span(overrides: Record<string, unknown> = {}) {
	return {
		traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
		spanId: "00f067aa0ba902b7",
		name: "chat gpt-4o",
		startTimeUnixNano: "1757500000000000000",
		attributes: [
			{ key: "gen_ai.operation.name", value: { stringValue: "chat" } },
			{ key: "gen_ai.request.model", value: { stringValue: "gpt-4o" } },
			{ key: "genum.prompt.id", value: { intValue: "42" } },
		],
		...overrides,
	};
}

function body(...spans: ReturnType<typeof span>[]) {
	return { resourceSpans: [{ scopeSpans: [{ spans }] }] };
}

// No default for `authorization`: a default parameter treats an explicitly passed
// `undefined` as absent, so the unauthenticated test would have sent a valid key.
function request(payload: unknown, authorization?: string) {
	return { headers: { authorization }, body: payload } as unknown as Request;
}

function authorized(payload: unknown) {
	return request(payload, "Bearer tok");
}

function response() {
	const res = {
		statusCode: 0,
		body: undefined as unknown,
		status(code: number) {
			res.statusCode = code;
			return res;
		},
		json(payload: unknown) {
			res.body = payload;
			return res;
		},
	};
	return res as unknown as Response & { statusCode: number; body: any };
}

describe("OtlpController.ingestTraces", () => {
	const controller = new OtlpController();

	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(db.project.getProjectApiKeyByToken).mockResolvedValue(KEY as never);
		vi.mocked(db.project.getProjectbyApiKeyById).mockResolvedValue(PROJECT as never);
		vi.mocked(getSessionTraceIds).mockResolvedValue([]);
		vi.mocked(insertSpanRows).mockResolvedValue(undefined);
		vi.mocked(logUsage).mockResolvedValue(undefined);
	});

	it("refuses a request with no Authorization header, and writes nothing", async () => {
		await expect(
			controller.ingestTraces(request(body(span())), response()),
		).rejects.toMatchObject({ statusCode: 401 });

		expect(insertSpanRows).not.toHaveBeenCalled();
	});

	it("stores a valid batch under the key's project, marked as ingested", async () => {
		const res = response();

		await controller.ingestTraces(authorized(body(span())), res);

		expect(res.statusCode).toBe(200);
		const rows = vi.mocked(insertSpanRows).mock.calls[0][0];
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			source: "otlp",
			cost: 0,
			orgId: 11,
			project_id: 3,
			prompt_id: 42,
		});
	});

	it("writes the same rows for a redelivered batch rather than dropping it", async () => {
		// Dedup is the READ's job (`LIMIT 1 BY`). An endpoint that tried to drop the
		// duplicate itself would need to know what is already stored -- a lookup per span
		// on the hot path -- and would still miss the race between two collectors. What
		// matters here is that the second delivery produces rows identical to the first,
		// which is what makes the read able to collapse them.
		const first = response();
		const second = response();

		await controller.ingestTraces(authorized(body(span())), first);
		await controller.ingestTraces(authorized(body(span())), second);

		const [a] = vi.mocked(insertSpanRows).mock.calls[0];
		const [b] = vi.mocked(insertSpanRows).mock.calls[1];
		expect(b).toEqual(a);
		expect(second.statusCode).toBe(200);
	});

	it("reports one unusable span as a partial success and stores the rest", async () => {
		const unusable = span({ spanId: "00f067aa0ba902b8", attributes: [] });
		const res = response();

		await controller.ingestTraces(authorized(body(span(), unusable)), res);

		expect(res.statusCode).toBe(200);
		expect(res.body.partialSuccess.rejectedSpans).toBe("1");
		// The good span still landed. A collector retries a failed batch WHOLE, so failing
		// it over one bad span would resend every good span alongside.
		expect(vi.mocked(insertSpanRows).mock.calls[0][0]).toHaveLength(1);
	});

	it("refuses a batch in which nothing is storable, and writes nothing", async () => {
		await expect(
			controller.ingestTraces(authorized(body(span({ attributes: [] }))), response()),
		).rejects.toMatchObject({ statusCode: 400 });

		expect(insertSpanRows).not.toHaveBeenCalled();
	});

	it("names the missing attribute when a batch has no prompt", async () => {
		// The usual cause, and a one-line fix at the sender -- if the message says which
		// attribute is missing.
		await expect(
			controller.ingestTraces(authorized(body(span({ attributes: [] }))), response()),
		).rejects.toMatchObject({ message: expect.stringContaining("genum.prompt.id") });
	});

	it("refuses a body that is not an OTLP payload", async () => {
		await expect(controller.ingestTraces(authorized("not json"), response())).rejects.toMatchObject(
			{ statusCode: 400 },
		);
		await expect(controller.ingestTraces(authorized(undefined), response())).rejects.toMatchObject({
			statusCode: 400,
		});
	});

	it("numbers a new turn after the turns the session already holds", async () => {
		vi.mocked(getSessionTraceIds).mockResolvedValue(["turn-0", "turn-1"]);
		const res = response();

		await controller.ingestTraces(
			authorized(
				body(
					span({
						traceId: "turn-2",
						attributes: [
							...span().attributes,
							{ key: "gen_ai.conversation.id", value: { stringValue: "conv-1" } },
						],
					}),
				),
			),
			res,
		);

		expect(getSessionTraceIds).toHaveBeenCalledWith("conv-1", 11, 3);
		expect(vi.mocked(insertSpanRows).mock.calls[0][0][0].turn_index).toBe(2);
	});

	it("does not look up a session for a trace that has no conversation id", async () => {
		// The conventions forbid inventing one, so there is nothing to look it up by -- and
		// a lookup keyed on the trace id would match this very trace on a redelivery.
		await controller.ingestTraces(authorized(body(span())), response());

		expect(getSessionTraceIds).not.toHaveBeenCalled();
	});

	it("answers 503 when the write fails, so the collector retries", async () => {
		// Never a swallowed failure: a collector that receives 200 for a batch we did not
		// store never sends it again, and the trace is gone for good.
		vi.mocked(insertSpanRows).mockRejectedValue(new Error("clickhouse down"));

		await expect(
			controller.ingestTraces(authorized(body(span())), response()),
		).rejects.toMatchObject({ statusCode: 503 });
	});

	describe("making the session reachable", () => {
		it("writes one logs row per ingested trace, keyed by the session", () => {
			// The logs list is the ONLY entry point to a trajectory. Without a row here an
			// ingested session is stored correctly and can never be opened -- and the span
			// table is append-only, so it cannot be fixed after the fact.
			return controller.ingestTraces(authorized(body(span())), response()).then(() => {
				expect(logUsage).toHaveBeenCalledTimes(1);
				expect(vi.mocked(logUsage).mock.calls[0][0]).toMatchObject({
					source: "otlp",
					log_type: "oti",
					orgId: 11,
					project_id: 3,
					prompt_id: 42,
					// The SESSION, not the turn's trace: this is the id the spans read is
					// keyed on, so a row carrying the turn id would open an empty session.
					trace_id: "4bf92f3577b34da6a3ce929d0e0e4736",
				});
			});
		});

		it("writes zero usage, so no ingested traffic reaches our billing totals", async () => {
			// The sender's token counts stay on the spans, where they are shown per step.
			// Zeros here are what keeps every sum() in queries.ts correct without a dozen
			// separate exclusions, each of which could be got subtly wrong.
			await controller.ingestTraces(authorized(body(span())), response());

			expect(vi.mocked(logUsage).mock.calls[0][0]).toMatchObject({
				tokens_in: 0,
				tokens_out: 0,
				tokens_sum: 0,
				cost: 0,
			});
		});

		it("keys the row on the conversation when the sender gave one", async () => {
			await controller.ingestTraces(
				authorized(
					body(
						span({
							attributes: [
								...span().attributes,
								{ key: "gen_ai.conversation.id", value: { stringValue: "conv-1" } },
							],
						}),
					),
				),
				response(),
			);

			expect(vi.mocked(logUsage).mock.calls[0][0]).toMatchObject({ trace_id: "conv-1" });
		});

		it("writes nothing at all when the batch is refused", async () => {
			await expect(
				controller.ingestTraces(authorized(body(span({ attributes: [] }))), response()),
			).rejects.toMatchObject({ statusCode: 400 });

			expect(logUsage).not.toHaveBeenCalled();
		});
	});
});
