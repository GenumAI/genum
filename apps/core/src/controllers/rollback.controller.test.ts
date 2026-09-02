import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		prompts: {
			getPromptVersion: vi.fn(),
			rollbackPrompt: vi.fn(),
			commit: vi.fn(),
			getPromptById: vi.fn(),
			getPromptCommitCount: vi.fn(),
			getProductiveCommit: vi.fn(),
			changePromptCommitStatus: vi.fn(),
		},
		placeholders: {
			getPlaceholdersByPromptID: vi.fn(),
		},
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkPromptAccess: vi.fn(async () => ({ id: 1, projectId: 7 })),
	checkPlaceholderAccess: vi.fn(),
}));

import { db } from "@/database/db";
import { PromptsController } from "./prompt.controller";

const PROJECT = 7;
const PROMPT = 1;
const COMMIT = 42;
const USER = 11;

const SNAPSHOT = [
	{ key: "tone", values: [{ name: "formal", content: "Write formally.", isDefault: true }] },
];

function makeReq() {
	return {
		body: {},
		params: { id: String(PROMPT), commitId: String(COMMIT) },
		genumMeta: { ids: { projID: PROJECT, orgID: 3, userID: USER } },
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

/**
 * Rollback restores an old commit's text, and the commit it then writes must carry that
 * SAME commit's placeholder snapshot -- not a fresh snapshot of today's live tables.
 * Pairing old text with today's definitions is the exact text/definition drift the
 * snapshot column exists to prevent: where a key has since been renamed or deleted, the
 * renderer leaves the hole verbatim and the literal `{{tone}}` is sent to the model.
 *
 * The repository's own tests pin `commit()`'s contract for the argument. Nothing pinned
 * that the CONTROLLER actually passes it, so deleting the argument left the whole suite
 * green while reintroducing the drift. That is what this file covers.
 */
describe("rollbackPrompt", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();

		vi.mocked(db.prompts.getPromptVersion).mockResolvedValue({
			id: COMMIT,
			commitHash: "abcdef1234567890",
			value: "You are {{tone}}.",
			audit: null,
			placeholders: SNAPSHOT,
		} as never);
		vi.mocked(db.prompts.rollbackPrompt).mockResolvedValue({
			id: PROMPT,
			value: "You are {{tone}}.",
			languageModelId: 4,
			languageModelConfig: null,
			commited: false,
		} as never);
		vi.mocked(db.prompts.commit).mockResolvedValue({ id: 99 } as never);
		vi.mocked(db.prompts.getPromptCommitCount).mockResolvedValue(2 as never);
		vi.mocked(db.prompts.getProductiveCommit).mockResolvedValue(null as never);
		vi.mocked(db.placeholders.getPlaceholdersByPromptID).mockResolvedValue([] as never);
	});

	it("carries the rolled-back version's own snapshot into the new commit", async () => {
		const { res, captured } = makeRes();

		await controller.rollbackPrompt(makeReq(), res);

		expect(db.prompts.commit).toHaveBeenCalledWith(
			PROMPT,
			expect.stringContaining("abcdef12"),
			USER,
			SNAPSHOT,
		);
		expect(captured.statusCode).toBe(200);
	});

	// A version committed before placeholders existed has a null snapshot. Null must
	// travel as null -- `commit()` distinguishes "no snapshot" from `undefined`, which
	// means "take a fresh one from the live tables". Passing nothing here would hand
	// that pre-placeholder commit today's definitions.
	it("passes a null snapshot through rather than dropping the argument", async () => {
		vi.mocked(db.prompts.getPromptVersion).mockResolvedValue({
			id: COMMIT,
			commitHash: "abcdef1234567890",
			value: "You are an assistant.",
			audit: null,
			placeholders: null,
		} as never);
		const { res } = makeRes();

		await controller.rollbackPrompt(makeReq(), res);

		expect(db.prompts.commit).toHaveBeenCalledWith(
			PROMPT,
			expect.any(String),
			USER,
			null,
		);
	});

	it("does not roll back to a commit that does not belong to this prompt", async () => {
		vi.mocked(db.prompts.getPromptVersion).mockResolvedValue(null as never);
		const { res, captured } = makeRes();

		await controller.rollbackPrompt(makeReq(), res);

		expect(captured.statusCode).toBe(404);
		expect(db.prompts.rollbackPrompt).not.toHaveBeenCalled();
		expect(db.prompts.commit).not.toHaveBeenCalled();
	});
});
