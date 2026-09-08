import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		prompts: {
			getProjectPrompts: vi.fn(),
			getPromptById: vi.fn(),
			getPromptByIdWithHistory: vi.fn(),
		},
		testcases: {
			getTestcasesByPromptId: vi.fn(),
			countByStatusForProject: vi.fn(),
			countByStatusForPrompt: vi.fn(),
		},
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkPromptAccess: vi.fn(),
	checkPlaceholderAccess: vi.fn(),
}));

import { db } from "@/database/db";
import { checkPromptAccess } from "@/services/access/AccessService";
import { PromptsController } from "./prompt.controller";

const PROJECT = 7;
const PROMPT = 1;

const CREATED = new Date("2026-01-02T03:04:05.000Z");
const UPDATED = new Date("2026-01-03T03:04:05.000Z");

/**
 * The row `getPromptById` renders: every Prompt scalar plus the languageModel, audit and
 * branches relations. The response is this row minus `branches`, so it is written out in
 * full here and asserted in full below -- the counts are what gets rewritten, but the
 * columns beside them are just as easy to drop by accident.
 */
const PROMPT_ROW = {
	id: PROMPT,
	projectId: PROJECT,
	name: "Support triage",
	value: "You are a support agent.",
	languageModelId: 4,
	languageModelConfig: { temperature: 0.2 },
	assertionType: "STRICT",
	assertionValue: "",
	commited: false,
	createdAt: CREATED,
	updatedAt: UPDATED,
	languageModel: { id: 4, name: "gpt-4o", vendor: "OPENAI" },
	audit: { id: 2, promptId: PROMPT, data: { score: 7 } },
	branches: [
		{
			id: 9,
			promptVersions: [
				{ id: 31, commitHash: "cafebabe", authorId: 11 },
				{ id: 30, commitHash: "deadbeef", authorId: 12 },
			],
		},
	],
};

type TestcaseRow = { promptId: number; status: string };

/**
 * A test states the project's testcases once; both readings of them are served from that
 * one statement -- the row list a per-prompt read returns, and the grouped counts the
 * aggregate returns. Nothing here asserts which of the two the controller asks for, so
 * these assertions describe the response and survive a change of query shape.
 */
function serveTestcases(rows: TestcaseRow[]) {
	const tallies = new Map<string, number>();
	for (const row of rows) {
		const key = `${row.promptId}:${row.status}`;
		tallies.set(key, (tallies.get(key) ?? 0) + 1);
	}
	const grouped = [...tallies].map(([key, count]) => {
		const [promptId, status] = key.split(":");
		return { promptId: Number(promptId), status, _count: count };
	});

	vi.mocked(db.testcases.getTestcasesByPromptId).mockImplementation(
		async (promptId: number) => rows.filter((row) => row.promptId === promptId) as never,
	);
	vi.mocked(db.testcases.countByStatusForProject).mockResolvedValue(grouped as never);
	vi.mocked(db.testcases.countByStatusForPrompt).mockImplementation(
		async (promptId: number) =>
			grouped.filter((row) => row.promptId === promptId) as never,
	);
}

function makeReq(params: Record<string, string> = {}) {
	return {
		body: undefined,
		params,
		query: {},
		genumMeta: { ids: { projID: PROJECT, orgID: 3, userID: 11 } },
	} as unknown as Request;
}

function makeRes() {
	const captured: { statusCode?: number; body?: unknown } = {};
	const res = {
		status(code: number) {
			captured.statusCode = code;
			return this;
		},
		json(body: unknown) {
			captured.body = body;
			return this;
		},
	} as unknown as Response;
	return { res, captured };
}

describe("getProjectPrompts", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();
		serveTestcases([]);
	});

	const listRow = (id: number, name: string, versions: unknown[]) => ({
		id,
		name,
		assertionType: "STRICT",
		languageModelId: 4,
		createdAt: CREATED,
		updatedAt: UPDATED,
		commited: false,
		_count: { testCases: 0 },
		branches: [{ promptVersions: versions }],
	});

	it("reports each prompt's testcases as a per-status count", async () => {
		vi.mocked(db.prompts.getProjectPrompts).mockResolvedValue([
			listRow(1, "Triage", []),
			listRow(2, "Summarize", []),
		] as never);
		serveTestcases([
			{ promptId: 1, status: "OK" },
			{ promptId: 1, status: "OK" },
			{ promptId: 1, status: "NOK" },
			{ promptId: 2, status: "NEED_RUN" },
		]);
		const { res, captured } = makeRes();

		await controller.getProjectPrompts(makeReq(), res);

		const prompts = (captured.body as { prompts: { testcaseStatuses: unknown }[] }).prompts;
		expect(prompts[0].testcaseStatuses).toEqual({ OK: 2, NOK: 1 });
		expect(prompts[1].testcaseStatuses).toEqual({ NEED_RUN: 1 });
	});

	it("leaves a status with no testcases out of the histogram rather than reporting a zero", async () => {
		// The web client reads every status as `?.OK || 0`, so an absent key already means
		// zero. Filling the gaps in would change the payload for every prompt in the
		// fleet; this is the contract the rewrite has to keep.
		vi.mocked(db.prompts.getProjectPrompts).mockResolvedValue([
			listRow(1, "Triage", []),
		] as never);
		serveTestcases([{ promptId: 1, status: "OK" }]);
		const { res, captured } = makeRes();

		await controller.getProjectPrompts(makeReq(), res);

		const prompts = (captured.body as { prompts: { testcaseStatuses: unknown }[] }).prompts;
		expect(prompts[0].testcaseStatuses).toEqual({ OK: 1 });
		expect(Object.keys(prompts[0].testcaseStatuses as object)).toEqual(["OK"]);
	});

	it("gives a prompt with no testcases an empty histogram, not a missing one", async () => {
		// An aggregate returns no row at all for such a prompt, so the key has to be
		// defaulted rather than read off the result.
		vi.mocked(db.prompts.getProjectPrompts).mockResolvedValue([
			listRow(1, "Triage", []),
			listRow(2, "Summarize", []),
		] as never);
		serveTestcases([{ promptId: 1, status: "OK" }]);
		const { res, captured } = makeRes();

		await controller.getProjectPrompts(makeReq(), res);

		const prompts = (captured.body as { prompts: { testcaseStatuses: unknown }[] }).prompts;
		expect(prompts[1]).toHaveProperty("testcaseStatuses");
		expect(prompts[1].testcaseStatuses).toEqual({});
	});

	it("replaces branches with the newest version as lastCommit", async () => {
		const newest = { commitHash: "cafebabe", createdAt: UPDATED, author: { id: 11 } };
		vi.mocked(db.prompts.getProjectPrompts).mockResolvedValue([
			listRow(1, "Triage", [newest]),
		] as never);
		const { res, captured } = makeRes();

		await controller.getProjectPrompts(makeReq(), res);

		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			prompts: [
				{
					id: 1,
					name: "Triage",
					assertionType: "STRICT",
					languageModelId: 4,
					createdAt: CREATED,
					updatedAt: UPDATED,
					commited: false,
					_count: { testCases: 0 },
					testcaseStatuses: {},
					lastCommit: newest,
				},
			],
		});
	});

	it("reports lastCommit as null for a prompt that has never been committed", async () => {
		vi.mocked(db.prompts.getProjectPrompts).mockResolvedValue([
			listRow(1, "No versions yet", []),
			{ ...listRow(2, "No branch at all", []), branches: [] },
		] as never);
		const { res, captured } = makeRes();

		await controller.getProjectPrompts(makeReq(), res);

		const prompts = (captured.body as { prompts: { lastCommit: unknown }[] }).prompts;
		expect(prompts[0].lastCommit).toBeNull();
		expect(prompts[1].lastCommit).toBeNull();
	});
});

describe("getPromptById", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();
		// The guard and the two repository reads are three doors onto the same row, so all
		// three are served the same fixture: a test that names the row once cannot drift
		// between them when the payload moves from one door to another.
		vi.mocked(checkPromptAccess).mockResolvedValue(PROMPT_ROW as never);
		vi.mocked(db.prompts.getPromptById).mockResolvedValue(PROMPT_ROW as never);
		vi.mocked(db.prompts.getPromptByIdWithHistory).mockResolvedValue(PROMPT_ROW as never);
		serveTestcases([]);
	});

	it("checks that the prompt in the URL belongs to the project in the request context", async () => {
		const { res } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
	});

	it("answers with the whole prompt row, its per-status counts and its newest commit", async () => {
		serveTestcases([
			{ promptId: PROMPT, status: "OK" },
			{ promptId: PROMPT, status: "OK" },
			{ promptId: PROMPT, status: "NOK" },
			{ promptId: 99, status: "OK" },
		]);
		const { res, captured } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({
			prompt: {
				id: PROMPT,
				projectId: PROJECT,
				name: "Support triage",
				value: "You are a support agent.",
				languageModelId: 4,
				languageModelConfig: { temperature: 0.2 },
				assertionType: "STRICT",
				assertionValue: "",
				commited: false,
				createdAt: CREATED,
				updatedAt: UPDATED,
				languageModel: { id: 4, name: "gpt-4o", vendor: "OPENAI" },
				audit: { id: 2, promptId: PROMPT, data: { score: 7 } },
				testcaseStatuses: { OK: 2, NOK: 1 },
				lastCommit: "cafebabe",
				lastCommitAuthor: 11,
			},
		});
	});

	it("counts only this prompt's testcases", async () => {
		serveTestcases([
			{ promptId: PROMPT, status: "OK" },
			{ promptId: 99, status: "NOK" },
			{ promptId: 99, status: "NOK" },
		]);
		const { res, captured } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		const prompt = (captured.body as { prompt: { testcaseStatuses: unknown } }).prompt;
		expect(prompt.testcaseStatuses).toEqual({ OK: 1 });
	});

	it("gives a prompt with no testcases an empty histogram", async () => {
		serveTestcases([{ promptId: 99, status: "OK" }]);
		const { res, captured } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		const prompt = (captured.body as { prompt: { testcaseStatuses: unknown } }).prompt;
		expect(prompt).toHaveProperty("testcaseStatuses");
		expect(prompt.testcaseStatuses).toEqual({});
	});

	it("omits a status that has no testcases", async () => {
		serveTestcases([
			{ promptId: PROMPT, status: "FAILED" },
			{ promptId: PROMPT, status: "FAILED" },
		]);
		const { res, captured } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		const statuses = (captured.body as { prompt: { testcaseStatuses: object } }).prompt
			.testcaseStatuses;
		expect(Object.keys(statuses)).toEqual(["FAILED"]);
	});

	it("reports lastCommit and lastCommitAuthor as null when nothing has been committed", async () => {
		const uncommitted = { ...PROMPT_ROW, branches: [{ id: 9, promptVersions: [] }] };
		vi.mocked(checkPromptAccess).mockResolvedValue(uncommitted as never);
		vi.mocked(db.prompts.getPromptById).mockResolvedValue(uncommitted as never);
		vi.mocked(db.prompts.getPromptByIdWithHistory).mockResolvedValue(uncommitted as never);
		const { res, captured } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		const prompt = (captured.body as { prompt: { lastCommit: unknown; lastCommitAuthor: unknown } })
			.prompt;
		expect(prompt.lastCommit).toBeNull();
		expect(prompt.lastCommitAuthor).toBeNull();
	});

	it("answers 404 if the prompt is deleted between the guard and the read", async () => {
		vi.mocked(db.prompts.getPromptByIdWithHistory).mockResolvedValue(null as never);
		const { res, captured } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		expect(captured.statusCode).toBe(404);
		expect(captured.body).toEqual({ error: "Prompt is not found" });
	});

	it("never leaks the branches relation into the response", async () => {
		// The prompt page reads lastCommit, not the version list; branches carries every
		// commit's full text, so shipping it would put the whole history on the wire.
		const { res, captured } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		expect((captured.body as { prompt: object }).prompt).not.toHaveProperty("branches");
	});
});

// The counts used to come from reading every testcase in the project -- one full read per
// prompt for the list, each carrying input, expectedOutput and lastOutput (all unbounded
// TEXT) for rows nobody looked at beyond `status`. These pin the query shape rather than
// the answer, because the answer is identical either way and that is exactly how a loop
// like this survives a review.
describe("the status histogram is an aggregate, not a read of every testcase", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();
		vi.mocked(checkPromptAccess).mockResolvedValue(PROMPT_ROW as never);
		vi.mocked(db.prompts.getPromptByIdWithHistory).mockResolvedValue(PROMPT_ROW as never);
		serveTestcases([{ promptId: 1, status: "OK" }]);
	});

	it("asks once for the whole project, however many prompts it holds", async () => {
		vi.mocked(db.prompts.getProjectPrompts).mockResolvedValue(
			Array.from({ length: 25 }, (_, i) => ({
				id: i + 1,
				branches: [{ promptVersions: [] }],
			})) as never,
		);
		const { res } = makeRes();

		await controller.getProjectPrompts(makeReq(), res);

		expect(db.testcases.countByStatusForProject).toHaveBeenCalledTimes(1);
		expect(db.testcases.countByStatusForProject).toHaveBeenCalledWith(PROJECT);
		expect(db.testcases.getTestcasesByPromptId).not.toHaveBeenCalled();
	});

	it("asks once for a single prompt", async () => {
		const { res } = makeRes();

		await controller.getPromptById(makeReq({ id: String(PROMPT) }), res);

		expect(db.testcases.countByStatusForPrompt).toHaveBeenCalledTimes(1);
		expect(db.testcases.countByStatusForPrompt).toHaveBeenCalledWith(PROMPT);
		expect(db.testcases.getTestcasesByPromptId).not.toHaveBeenCalled();
	});

	it("keeps the commit history off every route but the prompt page", async () => {
		// checkPromptAccess reads the scalar row on some thirty-four routes; branches ->
		// promptVersions grows by a full prompt body on every commit, so only the page
		// that renders the history may ask for it, and it asks by name.
		const { res } = makeRes();

		await controller.getProjectPrompts(makeReq(), res);

		expect(db.prompts.getPromptByIdWithHistory).not.toHaveBeenCalled();
	});
});
