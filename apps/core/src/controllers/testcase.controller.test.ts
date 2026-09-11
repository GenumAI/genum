import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		testcases: {
			updateTestcaseByID: vi.fn(),
			newTestcase: vi.fn(),
			setPlaceholderSelection: vi.fn(),
		},
		placeholders: {
			resolveSelection: vi.fn(),
		},
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkTestcaseAccess: vi.fn(),
	checkPromptAccess: vi.fn(),
}));

vi.mock("@/ai/runner/system", () => ({
	system_prompt: {
		testcaseNamer: vi.fn(),
		testcaseAssertionV2: vi.fn(),
	},
}));

vi.mock("@/ai/runner/run", () => ({
	runPrompt: vi.fn(),
	callPromptModel: vi.fn(),
}));

vi.mock("@/services/file.service", () => ({
	fileService: { getFileObjectsByIds: vi.fn() },
}));

// Only the two writers are stubbed; SourceType and the rest stay real.
vi.mock("@/services/logger", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/services/logger")>()),
	logUsage: vi.fn(),
	logSpans: vi.fn(),
}));

import { db } from "@/database/db";
import { checkTestcaseAccess, checkPromptAccess } from "@/services/access/AccessService";
import { system_prompt } from "@/ai/runner/system";
import { callPromptModel, runPrompt } from "@/ai/runner/run";
import { logSpans, logUsage } from "@/services/logger";
import type { LogDocument } from "@/services/logger";
import { fileService } from "@/services/file.service";
import { TestcasesController } from "./testcase.controller";

const PROJECT = 10;
const PROMPT = 77;

function makeReq(body: unknown): Request {
	return {
		params: { id: "5" },
		body,
		genumMeta: { ids: { userID: 1, orgID: 1, projID: PROJECT } },
	} as unknown as Request;
}

function makeRes() {
	const captured: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
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

describe("TestcasesController.updateTestcase", () => {
	let controller: TestcasesController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new TestcasesController();
		vi.mocked(checkTestcaseAccess).mockResolvedValue({
			id: 5,
			promptId: PROMPT,
			prompt: { projectId: PROJECT },
		} as never);
		vi.mocked(db.testcases.updateTestcaseByID).mockResolvedValue({ id: 5 } as never);
		vi.mocked(db.testcases.newTestcase).mockResolvedValue({ id: 5 } as never);
		vi.mocked(db.testcases.setPlaceholderSelection).mockResolvedValue(undefined as never);
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [],
			unresolved: [],
		} as never);
		vi.mocked(checkPromptAccess).mockResolvedValue({
			id: PROMPT,
			projectId: PROJECT,
			value: "do this",
		} as never);
		vi.mocked(system_prompt.testcaseNamer).mockResolvedValue({ answer: "generated" } as never);
	});

	it("updates a testcase with a simple field change", async () => {
		const { res, captured } = makeRes();

		await controller.updateTestcase(makeReq({ name: "renamed" }), res);

		expect(captured.statusCode).toBe(200);
		expect(db.testcases.updateTestcaseByID).toHaveBeenCalled();
	});

	it("pins the resolved values on the testcase", async () => {
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [{ placeholderId: 5, placeholderValueId: 9 }],
			unresolved: [],
		} as never);
		const { res, captured } = makeRes();

		await controller.createTestcase(
			makeReq({
				promptId: PROMPT,
				input: "i",
				expectedOutput: "e",
				lastOutput: "",
				placeholders: { admin_role: "true" },
			}),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(db.testcases.setPlaceholderSelection).toHaveBeenCalledWith(expect.any(Number), [
			{ placeholderId: 5, placeholderValueId: 9 },
		]);
	});

	it("refuses a placeholder value belonging to another prompt", async () => {
		// The guard the retired memory selector used to carry: resolution is scoped to
		// this prompt, so a value id from another tenant's prompt is simply not
		// resolvable here.
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [],
			unresolved: ["admin_role"],
		} as never);
		const { res, captured } = makeRes();

		await controller.createTestcase(
			makeReq({
				promptId: PROMPT,
				input: "i",
				expectedOutput: "e",
				lastOutput: "",
				placeholders: { admin_role: "true" },
			}),
			res,
		);

		expect(db.testcases.setPlaceholderSelection).toHaveBeenCalledWith(expect.any(Number), []);
		expect(
			(captured.body as { unresolvedPlaceholders: string[] }).unresolvedPlaceholders,
		).toEqual(["admin_role"]);
	});

	it("leaves an existing placeholder selection untouched when the update omits the field", async () => {
		const { res, captured } = makeRes();

		await controller.updateTestcase(makeReq({ name: "renamed" }), res);

		expect(captured.statusCode).toBe(200);
		expect(db.placeholders.resolveSelection).not.toHaveBeenCalled();
		expect(db.testcases.setPlaceholderSelection).not.toHaveBeenCalled();
		expect(
			(captured.body as { unresolvedPlaceholders: string[] }).unresolvedPlaceholders,
		).toEqual([]);
	});

	it("clears the placeholder selection when the update sends an explicit empty object", async () => {
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [],
			unresolved: [],
		} as never);
		const { res, captured } = makeRes();

		await controller.updateTestcase(makeReq({ placeholders: {} }), res);

		expect(captured.statusCode).toBe(200);
		expect(db.placeholders.resolveSelection).toHaveBeenCalledWith(PROMPT, {});
		expect(db.testcases.setPlaceholderSelection).toHaveBeenCalledWith(5, []);
	});

	it("pins nothing on update when the selection is unresolvable", async () => {
		// The retired update-path bug: the old memory selector field was writable
		// through `TestcasesUpdateSchema` and never checked against the testcase's own
		// prompt, so another tenant's memory could be pinned via update even though
		// createTestcase guarded the same field. `resolveSelection` is scoped to
		// `existing.promptId`, so a value id from another prompt simply never resolves --
		// prove the update path actually passes that scope through instead of trusting
		// the create-path test alone.
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [],
			unresolved: ["admin_role"],
		} as never);
		const { res, captured } = makeRes();

		await controller.updateTestcase(makeReq({ placeholders: { admin_role: "true" } }), res);

		expect(captured.statusCode).toBe(200);
		expect(db.placeholders.resolveSelection).toHaveBeenCalledWith(PROMPT, {
			admin_role: "true",
		});
		expect(db.testcases.setPlaceholderSelection).toHaveBeenCalledWith(5, []);
		expect(
			(captured.body as { unresolvedPlaceholders: string[] }).unresolvedPlaceholders,
		).toEqual(["admin_role"]);
	});

	it("pins a real selection on update, as before", async () => {
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [{ placeholderId: 5, placeholderValueId: 9 }],
			unresolved: [],
		} as never);
		const { res, captured } = makeRes();

		await controller.updateTestcase(
			makeReq({ placeholders: { admin_role: "true" } }),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(db.placeholders.resolveSelection).toHaveBeenCalledWith(PROMPT, {
			admin_role: "true",
		});
		expect(db.testcases.setPlaceholderSelection).toHaveBeenCalledWith(5, [
			{ placeholderId: 5, placeholderValueId: 9 },
		]);
	});

	it("clearing expectedSteps also clears stepsConfig and lastMismatches", async () => {
		// A client that sends only `expectedSteps: null` must not be able to leave the row
		// holding an orphaned config or an explanation of steps that are gone.
		const { res } = makeRes();

		await controller.updateTestcase(makeReq({ expectedSteps: null }), res);

		expect(db.testcases.updateTestcaseByID).toHaveBeenCalledWith(
			5,
			expect.objectContaining({
				expectedSteps: null,
				stepsConfig: null,
				lastMismatches: null,
			}),
		);
	});

	it("rewrites expectedOutput to the last enabled final when the session is truncated", async () => {
		// Truncating changes which final is last. If expectedOutput does not follow, removing
		// the trajectory later yields a text testcase asserting an answer from a turn the
		// session no longer reaches -- and the previous spec requires the text testcase
		// underneath to be correct at that moment.
		const { res } = makeRes();

		await controller.updateTestcase(
			makeReq({
				expectedSteps: [
					{ kind: "final", text: "first answer" },
					{ kind: "user", text: "again", enabled: false },
					{ kind: "final", text: "second answer" },
				],
			}),
			res,
		);

		expect(db.testcases.updateTestcaseByID).toHaveBeenCalledWith(
			5,
			expect.objectContaining({ expectedOutput: "first answer" }),
		);
	});

	it("rewrites expectedOutput when the last final's text is edited", async () => {
		const { res } = makeRes();

		await controller.updateTestcase(
			makeReq({
				expectedSteps: [
					{ kind: "final", text: "one" },
					{ kind: "user", text: "again" },
					{ kind: "final", text: "the new answer" },
				],
			}),
			res,
		);

		expect(db.testcases.updateTestcaseByID).toHaveBeenCalledWith(
			5,
			expect.objectContaining({ expectedOutput: "the new answer" }),
		);
	});

	it("skips a disabled final and cascades the last enabled one instead", async () => {
		// The literal last final in the effective list is not necessarily enabled -- a
		// disabled final is still in the list (no user step ended the session), but it is
		// excluded from the assertion, so it must be excluded from the cascade too.
		const { res } = makeRes();

		await controller.updateTestcase(
			makeReq({
				expectedSteps: [
					{ kind: "final", text: "A" },
					{ kind: "final", text: "B", enabled: false },
				],
			}),
			res,
		);

		expect(db.testcases.updateTestcaseByID).toHaveBeenCalledWith(
			5,
			expect.objectContaining({ expectedOutput: "A" }),
		);
	});

	it("leaves expectedOutput alone when the update carries no expectedSteps", async () => {
		const { res } = makeRes();

		await controller.updateTestcase(makeReq({ input: "changed" }), res);

		expect(db.testcases.updateTestcaseByID).toHaveBeenCalledWith(
			5,
			expect.objectContaining({ input: "changed" }),
		);
		const updateData = vi.mocked(db.testcases.updateTestcaseByID).mock.calls[0][1] as Record<
			string,
			unknown
		>;
		expect(updateData).not.toHaveProperty("expectedOutput");
	});

	it("responds with the newly pinned selection, not the pre-update one", async () => {
		// updateTestcaseByID's response carries the placeholderValues include (Task 9), so
		// writing the new pin AFTER building that response would answer with the stale
		// pin. Assert the write happens first by having the mocked read reflect it.
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [{ placeholderId: 5, placeholderValueId: 9 }],
			unresolved: [],
		} as never);
		vi.mocked(db.testcases.setPlaceholderSelection).mockImplementation(async () => {
			vi.mocked(db.testcases.updateTestcaseByID).mockResolvedValue({
				id: 5,
				placeholderValues: [{ placeholderId: 5, placeholderValueId: 9 }],
			} as never);
		});
		const { res, captured } = makeRes();

		await controller.updateTestcase(makeReq({ placeholders: { admin_role: "true" } }), res);

		expect(captured.statusCode).toBe(200);
		expect(
			(captured.body as { testcase: { placeholderValues: unknown[] } }).testcase
				.placeholderValues,
		).toEqual([{ placeholderId: 5, placeholderValueId: 9 }]);
	});
});

describe("TestcasesController.runTestcase", () => {
	let controller: TestcasesController;

	function makeTestcase(placeholderValues: unknown[]) {
		return {
			id: 5,
			promptId: PROMPT,
			input: "question",
			expectedOutput: "expected",
			files: [],
			placeholderValues,
			prompt: {
				id: PROMPT,
				projectId: PROJECT,
				value: "do this",
				assertionType: "MANUAL",
				assertionValue: null,
			},
		} as never;
	}

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new TestcasesController();
		vi.mocked(db.testcases.updateTestcaseByID).mockResolvedValue({ id: 5 } as never);
		vi.mocked(runPrompt).mockResolvedValue({
			answer: "the answer",
			chainOfThoughts: "",
		} as never);
	});

	it("runs with the testcase's pinned selection when the request carries none", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTestcase([
				{
					placeholderId: 5,
					placeholderValueId: 9,
					placeholderValue: {
						id: 9,
						name: "true",
						isDefault: false,
						placeholder: { id: 5, key: "admin_role" },
					},
				},
			]),
		);
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(runPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ placeholders: { admin_role: "true" } }),
		);
	});

	it("lets an explicit request selection override the pinned one", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTestcase([
				{
					placeholderId: 5,
					placeholderValueId: 9,
					placeholderValue: {
						id: 9,
						name: "true",
						isDefault: false,
						placeholder: { id: 5, key: "admin_role" },
					},
				},
			]),
		);
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq({ placeholders: { admin_role: "false" } }), res);

		expect(captured.statusCode).toBe(200);
		expect(runPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ placeholders: { admin_role: "false" } }),
		);
	});

	it("accepts the exact body the playground sends -- question, files and placeholders together", async () => {
		// Regression test: TestcaseRunSchema is `.strict()`. RunTestcaseData
		// (testcases.api.ts) and usePlaygroundPromptRun.ts both build a body carrying
		// all four run-param fields, not just `placeholders` -- a schema that declares
		// only `placeholders` 400s on this exact shape via errorHandler's ZodError
		// mapping, even though the controller legitimately ignores `question`/`files`
		// here (it uses the testcase's own input and files).
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTestcase([
				{
					placeholderId: 5,
					placeholderValueId: 9,
					placeholderValue: {
						id: 9,
						name: "true",
						isDefault: false,
						placeholder: { id: 5, key: "admin_role" },
					},
				},
			]),
		);
		const { res, captured } = makeRes();

		await controller.runTestcase(
			makeReq({
				question: "question",
				files: [],
				placeholders: { admin_role: "false" },
			}),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(runPrompt).toHaveBeenCalledWith(
			expect.objectContaining({ placeholders: { admin_role: "false" } }),
		);
	});
});

describe("TestcasesController.runTestcase with a recorded trajectory", () => {
	let controller: TestcasesController;

	const expectedSteps = [
		{
			kind: "tool_call",
			name: "get_weather",
			args: { city: "Berlin" },
			recordedResult: '{"temp":12}',
		},
		{ kind: "final", text: "It is 12°" },
	];

	function makeTrajectoryTestcase(overrides: Record<string, unknown> = {}) {
		return {
			id: 5,
			promptId: PROMPT,
			input: "what is the weather",
			expectedOutput: "",
			files: [],
			placeholderValues: [],
			expectedSteps,
			stepsConfig: null,
			prompt: {
				id: PROMPT,
				projectId: PROJECT,
				value: "do this",
				assertionType: "STRICT",
				assertionValue: null,
			},
			...overrides,
		} as never;
	}

	function updatePayload() {
		return vi.mocked(db.testcases.updateTestcaseByID).mock.calls[0][1] as Record<
			string,
			unknown
		>;
	}

	// A turn of the replay: the answer the model gave, plus the usage document
	// `runPrompt` would otherwise have written to ClickHouse itself.
	function modelTurn(turn: Record<string, unknown>, usage: Partial<LogDocument> = {}) {
		vi.mocked(callPromptModel).mockImplementationOnce(async (data) => {
			data.collectUsage?.({
				source: "testcase",
				log_type: "prs",
				log_lvl: "SUCCESS",
				orgId: 1,
				project_id: PROJECT,
				prompt_id: PROMPT,
				vendor: "OPENAI",
				model: "gpt-4o",
				tokens_in: 10,
				tokens_out: 5,
				tokens_sum: 15,
				cost: 0.25,
				response_ms: 100,
				testcase_id: 5,
				in: "what is the weather",
				out: String(turn.answer ?? ""),
				...usage,
			} as LogDocument);
			return turn as never;
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new TestcasesController();
		vi.mocked(db.testcases.updateTestcaseByID).mockResolvedValue({ id: 5 } as never);
	});

	it("replays the recording and passes when the trajectory is unchanged", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn({
			answer: "",
			toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
		});
		modelTurn({ answer: "It is 12°" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		// The replay IS the run: no extra, separately billed single-shot call.
		expect(runPrompt).not.toHaveBeenCalled();
		expect(callPromptModel).toHaveBeenCalledTimes(2);
		expect(updatePayload().status).toBe("OK");
		expect(updatePayload().assertionThoughts).toBe("");
		// The tool step keeps the result the replay fed back, so the stored trajectory is
		// readable without the expectation it was replayed from.
		expect(updatePayload().lastSteps).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Berlin" },
				recordedResult: '{"temp":12}',
			},
			{ kind: "final", text: "It is 12°" },
		]);
		expect(updatePayload().lastOutput).toBe("It is 12°");
	});

	it("replays the real prompt with the testcase's own pins, files and id", async () => {
		// The drift GAP-3 exists to prevent: a replay that ran the prompt with different
		// placeholders, files or attribution than a plain run would still go green while
		// asserting something the product never does.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				files: [{ fileId: "f1" }],
				placeholderValues: [
					{
						placeholderId: 5,
						placeholderValueId: 9,
						placeholderValue: {
							id: 9,
							name: "true",
							isDefault: false,
							placeholder: { id: 5, key: "admin_role" },
						},
					},
				],
			}),
		);
		vi.mocked(fileService.getFileObjectsByIds).mockResolvedValue([
			{ id: "f1" },
		] as never);
		modelTurn({ answer: "It is 12°" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(callPromptModel).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: expect.objectContaining({ id: PROMPT }),
				question: "what is the weather",
				source: "testcase",
				testcase_id: 5,
				userOrgId: 1,
				userProjectId: PROJECT,
				placeholders: { admin_role: "true" },
				files: [{ id: "f1" }],
				collectUsage: expect.any(Function),
			}),
			// The conversation so far -- empty on the opening turn.
			[],
		);
	});

	it("writes one root log row and one span batch, correlated by trace_id", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn(
			{ answer: "", toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }] },
			{ tokens_in: 10, tokens_out: 5, tokens_sum: 15, cost: 0.25, response_ms: 100 },
		);
		modelTurn(
			{ answer: "It is 12°" },
			{ tokens_in: 20, tokens_out: 2, tokens_sum: 22, cost: 0.75, response_ms: 300 },
		);
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		// Two provider calls, ONE row: otherwise this run counts twice in every
		// COUNT()/avg(cost) aggregate and its empty intermediate turn reads as a
		// completed run of its own.
		expect(logUsage).toHaveBeenCalledTimes(1);
		const root = vi.mocked(logUsage).mock.calls[0][0];
		expect(root.tokens_in).toBe(30);
		expect(root.tokens_out).toBe(7);
		expect(root.tokens_sum).toBe(37);
		expect(root.cost).toBe(1);
		expect(root.response_ms).toBe(400);
		expect(root.out).toBe("It is 12°");
		// The root row keeps the turns' own attribution rather than being rebuilt.
		expect(root.testcase_id).toBe(5);
		expect(root.prompt_id).toBe(PROMPT);
		expect(root.trace_id).toEqual(expect.any(String));

		expect(logSpans).toHaveBeenCalledTimes(1);
		const spans = vi.mocked(logSpans).mock.calls[0][0];
		expect(spans.session_id).toBe(root.trace_id);
		expect(spans.trace_id).not.toBe(root.trace_id);
		expect(spans.vendor).toBe("OPENAI");
		expect(spans.model).toBe("gpt-4o");
		// The spans carry the real tool result, not an empty string.
		expect(spans.steps).toEqual([
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Berlin" },
				recordedResult: '{"temp":12}',
			},
			{ kind: "final", text: "It is 12°" },
		]);
	});

	it("writes one trace per replayed turn, sharing one session", async () => {
		// A replay knows all its turns at once. Writing them as one trace would rebuild the
		// session-wide numbering this whole change removes, and would say -- in an append-only
		// table -- that a three-turn conversation was one request.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				expectedSteps: [
					{ kind: "final", text: "It is 12°" },
					{ kind: "user", text: "and tomorrow?" },
					{ kind: "final", text: "Sunny tomorrow" },
				],
			}),
		);
		modelTurn({ answer: "It is 12°" });
		modelTurn({ answer: "Sunny tomorrow" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		const batches = vi.mocked(logSpans).mock.calls.map(([batch]) => batch);

		expect(batches).toHaveLength(2);
		expect(new Set(batches.map((batch) => batch.session_id)).size).toBe(1);
		expect(batches.map((batch) => batch.turn_index)).toEqual([0, 1]);
		expect(new Set(batches.map((batch) => batch.trace_id)).size).toBe(2);
		expect(batches.every((batch) => batch.steps.length > 0)).toBe(true);
	});

	it("records the completed turns when a later turn throws, and still rethrows", async () => {
		// Quota was charged on turn 1 the moment it returned. If its usage document died
		// with the exception, the org would be billed for a call that appears nowhere --
		// and before turns were collected, that row was written as it happened.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn(
			{ answer: "", toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }] },
			{ tokens_in: 10, tokens_out: 5, tokens_sum: 15, cost: 0.25, response_ms: 100 },
		);
		vi.mocked(callPromptModel).mockRejectedValueOnce(new Error("provider down"));
		const { res } = makeRes();

		await expect(controller.runTestcase(makeReq(undefined), res)).rejects.toThrow(
			"provider down",
		);

		expect(logUsage).toHaveBeenCalledTimes(1);
		const row = vi.mocked(logUsage).mock.calls[0][0];
		expect(row.tokens_sum).toBe(15);
		expect(row.cost).toBe(0.25);
		expect(row.trace_id).toEqual(expect.any(String));
		// A run that died partway is not a successful run.
		expect(row.log_type).toBe("pre");
		expect(row.log_lvl).toBe("ERROR");
		// The steps died with the replay: zero turns, so the writer is never called at all
		// -- more direct than calling it with an empty batch.
		expect(logSpans).not.toHaveBeenCalled();
		// The verdict is never written for a run that threw.
		expect(db.testcases.updateTestcaseByID).not.toHaveBeenCalled();
	});

	it("writes nothing extra when the very first turn throws", async () => {
		// Nothing was billed through the collector, and runPrompt already logged its own
		// AIError for the failing call.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		vi.mocked(callPromptModel).mockRejectedValueOnce(new Error("provider down"));
		const { res } = makeRes();

		await expect(controller.runTestcase(makeReq(undefined), res)).rejects.toThrow(
			"provider down",
		);

		expect(logUsage).not.toHaveBeenCalled();
		expect(logSpans).not.toHaveBeenCalled();
	});

	it("writes no batch when the replay stops on the first turn's first tool call", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn({ answer: "", toolCalls: [{ id: "c1", name: "send_email", args: {} }] });
		const { res } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		// The provider calls happened and cost money: they are logged whatever the
		// assertion concluded.
		expect(logUsage).toHaveBeenCalledTimes(1);
		// The stop fires on the turn's first tool call, before any step of that turn is
		// recorded, so the replay produced zero completed turns -- and, same as a failed
		// run, the writer is not called at all rather than with an empty batch.
		expect(logSpans).not.toHaveBeenCalled();
	});

	it("keeps turn 1's batch when turn 2 stops on its own first tool call", async () => {
		// Before per-turn batching there was one write for the whole run, so this question
		// could not arise. Now it can: a replay that finishes turn 1 and then aborts inside
		// turn 2 must not lose turn 1's already-completed batch along with it.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				expectedSteps: [
					{ kind: "final", text: "It is 12°" },
					{ kind: "user", text: "and tomorrow?" },
					{
						kind: "tool_call",
						name: "send_email",
						args: {},
						recordedResult: "sent",
					},
					{ kind: "final", text: "done" },
				],
			}),
		);
		modelTurn({ answer: "It is 12°" });
		// Turn 2's own first call: an unrecorded tool, so replayTrajectory stops right here.
		modelTurn({ answer: "", toolCalls: [{ id: "c2", name: "send_sms", args: {} }] });
		const { res } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		const batches = vi.mocked(logSpans).mock.calls.map(([batch]) => batch);

		// Turn 1's real batch is there, and it is not empty.
		const turn0 = batches.find((batch) => batch.turn_index === 0);
		expect(turn0).toBeDefined();
		expect(turn0?.steps).toEqual([{ kind: "final", text: "It is 12°" }]);

		// Turn 2's aborted attempt is never written: no batch carries the unrecorded tool
		// call, or the model turn that made it, at all. `replayTrajectory` does record
		// turn 2's own opening user reply (pushed on the transition out of turn 1, before
		// its first model call is even made) as a one-step "turn_index: 1" batch of its
		// own -- that reply really happened, independent of what turn 2's model call went
		// on to do, so it is legitimate telemetry rather than the aborted turn's content.
		for (const batch of batches) {
			const hasAbortedCall = batch.steps.some(
				(step) => step.kind === "tool_call" && step.name === "send_sms",
			);
			expect(hasAbortedCall).toBe(false);
		}
		expect(batches.every((batch) => batch.steps.length > 0)).toBe(true);
	});

	it("fails and names the tool when an argument changed", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn({
			answer: "",
			toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Munich" } }],
		});
		modelTurn({ answer: "It is 12°" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().status).toBe("NOK");
		expect(updatePayload().assertionThoughts).toContain("get_weather");
	});

	it("persists the structured mismatches of a STRICT trajectory run", async () => {
		// The web marks individual steps from this. A joined string cannot say WHICH step
		// failed, which is the entire point of pinning steps one by one.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({ stepsConfig: { orderMatters: false } }),
		);
		modelTurn({
			answer: "",
			toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Munich" } }],
		});
		modelTurn({ answer: "It is 12°" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().status).toBe("NOK");
		expect(updatePayload().lastMismatches).toEqual([expect.objectContaining({ index: 0 })]);
	});

	it("clears lastMismatches when the verdict did not come from step comparison", async () => {
		// An AI or MANUAL verdict explains itself in assertionThoughts. Leaving the
		// previous run's per-step marks beside a verdict that did not produce them would
		// mark steps that were never compared. (A stopped replay is NOT in this set: it
		// does compare, up to the stop -- see decision 5, tested below.)
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				prompt: {
					id: PROMPT,
					projectId: PROJECT,
					value: "do this",
					assertionType: "MANUAL",
					assertionValue: null,
				},
			}),
		);
		modelTurn({ answer: "It is 12°" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().lastMismatches).toBeNull();
	});

	it("fails with the stop message when the model calls an unrecorded tool", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn({ answer: "", toolCalls: [{ id: "c1", name: "send_email", args: {} }] });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().status).toBe("NOK");
		expect(updatePayload().assertionThoughts).toContain("send_email");
	});

	it("keeps the comparison the stopped replay did produce (decision 5)", async () => {
		// The recording's first turn is a `get_weather` call and a final. This run makes
		// the call correctly, then diverges on a tool the recording does not cover -- so
		// the comparison up to the stop has step 0 met and step 1 (the final, never
		// reached) unmet. Nulling `lastMismatches` here threw that away and left the panel
		// unable to mark a single step on the one path where the author most needs to see
		// how far the run got.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(makeTrajectoryTestcase());
		modelTurn({
			answer: "",
			toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
		});
		modelTurn({ answer: "", toolCalls: [{ id: "c2", name: "send_email", args: {} }] });
		const { res } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(updatePayload().status).toBe("NOK");
		expect(updatePayload().lastMismatches).toEqual([expect.objectContaining({ index: 1 })]);
	});

	it("records the trajectory but asserts nothing when the prompt is MANUAL", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				prompt: {
					id: PROMPT,
					projectId: PROJECT,
					value: "do this",
					assertionType: "MANUAL",
					assertionValue: null,
				},
			}),
		);
		modelTurn({ answer: "It is 12°" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().status).toBe("NEED_RUN");
		expect(updatePayload().lastSteps).toEqual([{ kind: "final", text: "It is 12°" }]);
	});

	it("hands the judge both trajectories when the prompt is AI", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				prompt: {
					id: PROMPT,
					projectId: PROJECT,
					value: "do this",
					assertionType: "AI",
					assertionValue: "the same tools",
				},
			}),
		);
		modelTurn({ answer: "It is 12°" });
		vi.mocked(system_prompt.testcaseAssertionV2).mockResolvedValue({
			assertionStatus: "OK",
			assertionThoughts: "same trajectory",
		} as never);
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().status).toBe("OK");
		const judgeInput = vi.mocked(system_prompt.testcaseAssertionV2).mock.calls[0][0] as string;
		expect(judgeInput).toContain("get_weather");
		expect(updatePayload().assertionThoughts).toBe("same trajectory");
	});

	it("honours orderMatters stored on the testcase", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({ stepsConfig: { orderMatters: true } }),
		);
		// The final answer arrives before the tool call: equivalent unordered, wrong ordered.
		modelTurn({
			answer: "It is 12°",
			toolCalls: [{ id: "c1", name: "get_weather", args: { city: "Berlin" } }],
		});
		modelTurn({ answer: "done" });
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().status).toBe("NOK");
	});

	it("treats a stored empty trajectory as the text testcase it is", async () => {
		// Belt and braces behind `.min(1)`: a row that has one anyway must not become a
		// testcase that can never fail.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({ expectedSteps: [], expectedOutput: "the answer" }),
		);
		vi.mocked(runPrompt).mockResolvedValue({ answer: "the answer" } as never);
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(callPromptModel).not.toHaveBeenCalled();
		expect(runPrompt).toHaveBeenCalledTimes(1);
		expect(updatePayload().lastSteps).toBeUndefined();
	});

	it("refuses to assert against a malformed stored trajectory", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({ expectedSteps: [{ kind: "tool_call" }] }),
		);
		const { res } = makeRes();

		await expect(controller.runTestcase(makeReq(undefined), res)).rejects.toThrow(
			/not a valid trajectory/,
		);
		expect(callPromptModel).not.toHaveBeenCalled();
	});

	it("leaves a text testcase on exactly the path it had before", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				expectedSteps: null,
				expectedOutput: "the answer",
			}),
		);
		vi.mocked(runPrompt).mockResolvedValue({
			answer: "the answer",
			chainOfThoughts: "",
		} as never);
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(runPrompt).toHaveBeenCalledTimes(1);
		expect(callPromptModel).not.toHaveBeenCalled();
		expect(updatePayload().status).toBe("OK");
		expect(updatePayload().lastSteps).toBeUndefined();
		// One row, written by runPrompt itself, no trace and no spans: the text path is
		// provably the path it always was.
		expect(vi.mocked(runPrompt).mock.calls[0][0].collectUsage).toBeUndefined();
		expect(logUsage).not.toHaveBeenCalled();
		expect(logSpans).not.toHaveBeenCalled();
	});

	it("clears lastMismatches on a plain text run", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(
			makeTrajectoryTestcase({
				expectedSteps: null,
				expectedOutput: "the answer",
			}),
		);
		vi.mocked(runPrompt).mockResolvedValue({
			answer: "the answer",
			chainOfThoughts: "",
		} as never);
		const { res, captured } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(captured.statusCode).toBe(200);
		expect(updatePayload().lastMismatches).toBeNull();
	});
});

describe("TestcasesController.createTestcase with a recorded trajectory", () => {
	let controller: TestcasesController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new TestcasesController();
		vi.mocked(db.testcases.newTestcase).mockResolvedValue({ id: 5 } as never);
		vi.mocked(db.testcases.setPlaceholderSelection).mockResolvedValue(undefined as never);
		vi.mocked(db.placeholders.resolveSelection).mockResolvedValue({
			rows: [],
			unresolved: [],
		} as never);
		vi.mocked(checkPromptAccess).mockResolvedValue({
			id: PROMPT,
			projectId: PROJECT,
			value: "do this",
		} as never);
		vi.mocked(system_prompt.testcaseNamer).mockResolvedValue({ answer: "generated" } as never);
	});

	it("persists the pinned steps and their config", async () => {
		const { res, captured } = makeRes();
		const steps = [
			{
				kind: "tool_call",
				name: "get_weather",
				args: { city: "Berlin" },
				argsMatch: "exact",
				recordedResult: '{"temp":12}',
			},
			{ kind: "final", text: "It is 12°" },
		];

		await controller.createTestcase(
			makeReq({
				promptId: PROMPT,
				input: "i",
				expectedOutput: "e",
				lastOutput: "",
				expectedSteps: steps,
				stepsConfig: { orderMatters: true },
			}),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(db.testcases.newTestcase).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedSteps: steps,
				stepsConfig: { orderMatters: true },
			}),
		);
	});

	it("derives expectedOutput from the effective last enabled final, not from the client", async () => {
		// Decision 7's cascade applies on create too. The picker can confirm an already
		// truncated selection, and "add testcase from log" sends the log's whole answer as
		// `expectedOutput` regardless -- so a row created from this would be born pinning
		// turn 2's answer for a session that ends in turn 1.
		const { res } = makeRes();

		await controller.createTestcase(
			makeReq({
				promptId: PROMPT,
				input: "i",
				expectedOutput: "second answer",
				lastOutput: "",
				expectedSteps: [
					{ kind: "tool_call", name: "get_weather" },
					{ kind: "final", text: "first answer" },
					{ kind: "user", text: "and in London?", enabled: false },
					{ kind: "tool_call", name: "get_weather" },
					{ kind: "final", text: "second answer" },
				],
			}),
			res,
		);

		expect(db.testcases.newTestcase).toHaveBeenCalledWith(
			expect.objectContaining({ expectedOutput: "first answer" }),
		);
	});

	it("keeps the client's expectedOutput when the trajectory has no enabled final", async () => {
		// `expectedOutput` is a non-nullable column and the text testcase underneath has to
		// stay usable, so "nothing to derive" leaves it alone rather than blanking it.
		const { res } = makeRes();

		await controller.createTestcase(
			makeReq({
				promptId: PROMPT,
				input: "i",
				expectedOutput: "keep me",
				lastOutput: "",
				expectedSteps: [
					{ kind: "tool_call", name: "get_weather" },
					{ kind: "final", text: "unticked", enabled: false },
				],
			}),
			res,
		);

		expect(db.testcases.newTestcase).toHaveBeenCalledWith(
			expect.objectContaining({ expectedOutput: "keep me" }),
		);
	});

	it("rejects a malformed trajectory at the boundary", async () => {
		const { res } = makeRes();

		await expect(
			controller.createTestcase(
				makeReq({
					promptId: PROMPT,
					input: "i",
					expectedOutput: "e",
					lastOutput: "",
					// A tool call with no name, and a kind that is not a step at all.
					expectedSteps: [{ kind: "tool_call" }, { kind: "shell", cmd: "rm -rf /" }],
				}),
				res,
			),
		).rejects.toThrow();

		expect(db.testcases.newTestcase).not.toHaveBeenCalled();
	});

	it("rejects an empty trajectory", async () => {
		// `[]` is truthy, so it would take the trajectory path and then match anything
		// the model did -- a testcase that can never fail.
		const { res } = makeRes();

		await expect(
			controller.createTestcase(
				makeReq({
					promptId: PROMPT,
					input: "i",
					expectedOutput: "e",
					lastOutput: "",
					expectedSteps: [],
				}),
				res,
			),
		).rejects.toThrow();

		expect(db.testcases.newTestcase).not.toHaveBeenCalled();
	});

	it("refuses a client-supplied lastSteps", async () => {
		const { res } = makeRes();

		await expect(
			controller.createTestcase(
				makeReq({
					promptId: PROMPT,
					input: "i",
					expectedOutput: "e",
					lastOutput: "",
					lastSteps: [{ kind: "final", text: "not yours to write" }],
				}),
				res,
			),
		).rejects.toThrow();

		expect(db.testcases.newTestcase).not.toHaveBeenCalled();
	});
});

describe("TestcasesController.runTestcase tool subset", () => {
	let controller: TestcasesController;

	function withTools(offeredTools: unknown) {
		return {
			id: 5,
			promptId: PROMPT,
			input: "question",
			expectedOutput: "expected",
			files: [],
			placeholderValues: [],
			offeredTools,
			prompt: {
				id: PROMPT,
				projectId: PROJECT,
				value: "do this",
				assertionType: "MANUAL",
				assertionValue: null,
				languageModelConfig: {
					temperature: 0.2,
					tools: [
						{ name: "search_mail", parameters: { type: "object" } },
						{ name: "send_mail", parameters: { type: "object" } },
					],
				},
			},
		} as never;
	}

	function toolsPassed(): string[] | undefined {
		const params = vi.mocked(runPrompt).mock.calls[0][0] as {
			prompt: { languageModelConfig?: { tools?: { name: string }[] } };
		};
		return params.prompt.languageModelConfig?.tools?.map((tool) => tool.name);
	}

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new TestcasesController();
		vi.mocked(db.testcases.updateTestcaseByID).mockResolvedValue({ id: 5 } as never);
		vi.mocked(runPrompt).mockResolvedValue({
			answer: "the answer",
			chainOfThoughts: "",
		} as never);
	});

	it("offers only the tools the recorded session was offered", async () => {
		// Replaying a restricted session against the prompt's whole list is a different
		// run: the model reaches for a tool the recording never had, and the difference
		// is reported as a prompt regression the author never caused.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(withTools(["search_mail"]));
		const { res } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(toolsPassed()).toEqual(["search_mail"]);
	});

	it("offers the prompt's whole list when the recording never said", async () => {
		// Null is every testcase pinned before the session recorded what it ran with.
		// Those must keep running the way they ran.
		vi.mocked(checkTestcaseAccess).mockResolvedValue(withTools(null));
		const { res } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		expect(toolsPassed()).toEqual(["search_mail", "send_mail"]);
	});

	it("leaves the rest of the prompt's model configuration untouched", async () => {
		vi.mocked(checkTestcaseAccess).mockResolvedValue(withTools(["send_mail"]));
		const { res } = makeRes();

		await controller.runTestcase(makeReq(undefined), res);

		const params = vi.mocked(runPrompt).mock.calls[0][0] as {
			prompt: { value: string; languageModelConfig?: { temperature?: number } };
		};
		expect(params.prompt.value).toBe("do this");
		expect(params.prompt.languageModelConfig?.temperature).toBe(0.2);
	});
});
