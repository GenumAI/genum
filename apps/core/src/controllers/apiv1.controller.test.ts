import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { AiVendor } from "@/prisma";

vi.mock("@/database/db", () => ({
	db: {
		project: {
			getProjectApiKeyByToken: vi.fn(),
			getProjectbyApiKeyById: vi.fn(),
			updateProjectApiKeyLastUsed: vi.fn(),
		},
		organization: {
			getAvailableModels: vi.fn(),
			getOrganizationById: vi.fn(),
		},
		prompts: {
			getDefaultLanguageModelRow: vi.fn(),
			newProjectPrompt: vi.fn(),
			commit: vi.fn(),
			changePromptCommitStatus: vi.fn(),
			getPromptById: vi.fn(),
		},
	},
}));

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai" },
}));

vi.mock("@/ai/runner/run", () => ({
	runPrompt: vi.fn(),
}));

import { db } from "@/database/db";
import { runPrompt } from "@/ai/runner/run";
import { ApiV1Controller } from "./apiv1.controller";

function makeReq(body: unknown): Request {
	return {
		headers: { authorization: "Bearer valid-key" },
		body,
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

const PROJECT = { id: 10, organizationId: 1 };
const KEY = { id: 3, authorId: 7 };
const GPT_4O = { id: 5, name: "gpt-4o", vendor: AiVendor.OPENAI, parametersConfig: null };

describe("ApiV1Controller.createPrompt", () => {
	let controller: ApiV1Controller;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new ApiV1Controller();
		(db.project.getProjectApiKeyByToken as ReturnType<typeof vi.fn>).mockResolvedValue(KEY);
		(db.project.getProjectbyApiKeyById as ReturnType<typeof vi.fn>).mockResolvedValue(PROJECT);
		(db.prompts.changePromptCommitStatus as ReturnType<typeof vi.fn>).mockImplementation(
			(id: number) => Promise.resolve({ id, commited: true }),
		);
	});

	it("400s with a clear error for an unknown model name, and never creates the prompt", async () => {
		(db.organization.getAvailableModels as ReturnType<typeof vi.fn>).mockResolvedValue([
			GPT_4O,
		]);
		const { res, captured } = makeRes();

		await controller.createPrompt(
			makeReq({ name: "p", value: "v", languageModelName: "does-not-exist" }),
			res,
		);

		expect(captured.statusCode).toBe(400);
		expect(captured.body).toEqual({ error: "Unknown model: does-not-exist" });
		expect(db.prompts.newProjectPrompt).not.toHaveBeenCalled();
	});

	it("resolves languageModelName, sanitizes languageModelConfig, and persists both", async () => {
		(db.organization.getAvailableModels as ReturnType<typeof vi.fn>).mockResolvedValue([
			GPT_4O,
		]);
		(db.prompts.newProjectPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 1 });
		const { res, captured } = makeRes();

		await controller.createPrompt(
			makeReq({
				name: "p",
				value: "v",
				languageModelName: "gpt-4o",
				languageModelConfig: { response_format: "json_object", temperature: 0.2 },
			}),
			res,
		);

		expect(db.prompts.newProjectPrompt).toHaveBeenCalledWith(
			10,
			{ name: "p", value: "v" },
			7,
			{
				languageModelId: 5,
				languageModelConfig: {
					response_format: "json_object",
					temperature: 0.2,
					max_tokens: 16384,
					tools: [],
				},
			},
		);
		expect(captured.statusCode).toBe(200);
	});

	it("commits the created prompt immediately so the API can run it", async () => {
		(db.prompts.newProjectPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 42 });
		const { res, captured } = makeRes();

		await controller.createPrompt(makeReq({ name: "p", value: "v" }), res);

		expect(db.prompts.commit).toHaveBeenCalledWith(42, "Initial commit", 7);
		expect(db.prompts.changePromptCommitStatus).toHaveBeenCalledWith(42, true);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ prompt: { id: 42, commited: true } });
	});

	it("does not commit when creation was rejected for an unknown model", async () => {
		(db.organization.getAvailableModels as ReturnType<typeof vi.fn>).mockResolvedValue([
			GPT_4O,
		]);
		const { res } = makeRes();

		await controller.createPrompt(
			makeReq({ name: "p", value: "v", languageModelName: "does-not-exist" }),
			res,
		);

		expect(db.prompts.commit).not.toHaveBeenCalled();
		expect(db.prompts.changePromptCommitStatus).not.toHaveBeenCalled();
	});

	it("omitting both fields reproduces the prior call shape exactly (no override argument)", async () => {
		(db.prompts.newProjectPrompt as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 2 });
		const { res, captured } = makeRes();

		await controller.createPrompt(makeReq({ name: "p", value: "v" }), res);

		expect(db.organization.getAvailableModels).not.toHaveBeenCalled();
		expect(db.prompts.getDefaultLanguageModelRow).not.toHaveBeenCalled();
		expect(db.prompts.newProjectPrompt).toHaveBeenCalledWith(
			10,
			{ name: "p", value: "v" },
			7,
			undefined,
		);
		expect(captured.statusCode).toBe(200);
	});
});

describe("ApiV1Controller.verifyRequest status codes", () => {
	let controller: ApiV1Controller;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new ApiV1Controller();
	});

	function reqWithAuth(authorization?: string): Request {
		return {
			headers: authorization ? { authorization } : {},
			body: { name: "n", value: "v" },
		} as unknown as Request;
	}

	// Previously these threw a bare Error, so the public API answered an
	// unauthenticated probe with 500 plus a Sentry event instead of 401.
	it("401s on a missing Authorization header", async () => {
		const { res } = makeRes();

		await expect(controller.createPrompt(reqWithAuth(), res)).rejects.toMatchObject({
			statusCode: 401,
		});
	});

	it("401s on an unknown API key", async () => {
		(db.project.getProjectApiKeyByToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		const { res } = makeRes();

		await expect(
			controller.createPrompt(reqWithAuth("Bearer nope"), res),
		).rejects.toMatchObject({ statusCode: 401 });
	});

	it("404s when the key resolves but its project is gone", async () => {
		(db.project.getProjectApiKeyByToken as ReturnType<typeof vi.fn>).mockResolvedValue(KEY);
		(db.project.getProjectbyApiKeyById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
		const { res } = makeRes();

		await expect(
			controller.createPrompt(reqWithAuth("Bearer valid-key"), res),
		).rejects.toMatchObject({ statusCode: 404 });
	});
});

describe("ApiV1Controller.runPrompt", () => {
	let controller: ApiV1Controller;
	const ORGANIZATION = { id: 1 };
	const PROMPT = { id: 20, projectId: PROJECT.id, value: "hi" };

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new ApiV1Controller();
		(db.project.getProjectApiKeyByToken as ReturnType<typeof vi.fn>).mockResolvedValue(KEY);
		(db.project.getProjectbyApiKeyById as ReturnType<typeof vi.fn>).mockResolvedValue(PROJECT);
		(db.organization.getOrganizationById as ReturnType<typeof vi.fn>).mockResolvedValue(
			ORGANIZATION,
		);
		(db.prompts.getPromptById as ReturnType<typeof vi.fn>).mockResolvedValue(PROMPT);
		vi.mocked(runPrompt).mockResolvedValue({
			answer: "a",
			placeholders: { resolved: {}, ignored: [] },
		} as never);
	});

	// A `promptWithCommit.placeholderDefinitions ?? []` typo here would type-check and
	// pass every other test, but `run.ts` treats any truthy value -- `[]` included -- as
	// "these are the definitions" and skips loading the live placeholder tables, so a
	// non-productive run must see `undefined`, not an empty array.
	it("on a non-productive run, passes placeholderDefinitions as undefined, not []", async () => {
		const { res, captured } = makeRes();

		await controller.runPrompt(
			makeReq({ id: PROMPT.id, question: "q", productive: false }),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(runPrompt).toHaveBeenCalledTimes(1);
		const arg = vi.mocked(runPrompt).mock.calls[0][0];
		expect(arg.placeholderDefinitions).toBeUndefined();
	});
});
