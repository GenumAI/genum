import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		placeholders: {
			getPlaceholdersByPromptID: vi.fn(),
			getPlaceholderByIDAndPromptId: vi.fn(),
			getPlaceholderByKeyAndPromptId: vi.fn(),
			createPlaceholder: vi.fn(),
			updatePlaceholderByID: vi.fn(),
			deletePlaceholderByID: vi.fn(),
			createValue: vi.fn(),
			updateValueByID: vi.fn(),
			deleteValueByID: vi.fn(),
			getValueByIDAndPlaceholderId: vi.fn(),
		},
		prompts: {
			getPromptById: vi.fn(),
			updatePromptById: vi.fn(),
			getPromptCommitCount: vi.fn(),
			getProductiveCommit: vi.fn(),
			changePromptCommitStatus: vi.fn(),
		},
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkPromptAccess: vi.fn(async () => ({ id: 1, projectId: 7, value: "You are {{role}}." })),
	checkPlaceholderAccess: vi.fn(async () => ({ id: 5, promptId: 1, key: "role" })),
}));

import { db } from "@/database/db";
import { checkPlaceholderAccess, checkPromptAccess } from "@/services/access/AccessService";
import { PromptsController } from "./prompt.controller";

const PROJECT = 7;
const PROMPT = 1;
const PLACEHOLDER = 5;

function makeReq(body: unknown, params: Record<string, string>) {
	return {
		body,
		params,
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

describe("placeholder endpoints", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();
		// vi.clearAllMocks() clears calls but keeps implementations, so a mockResolvedValue
		// set by one test leaks into every later one. Re-stating the defaults here keeps
		// the tests order-independent -- without it, a guard mocked without `key` in an
		// earlier test silently turns a rename into a no-op here.
		vi.mocked(checkPromptAccess).mockResolvedValue({
			id: PROMPT,
			projectId: PROJECT,
			value: "You are {{role}}.",
		} as never);
		vi.mocked(checkPlaceholderAccess).mockResolvedValue({
			id: PLACEHOLDER,
			promptId: PROMPT,
			key: "role",
		} as never);
		// Every placeholder mutation now re-evaluates the commit status, which reads the
		// prompt back. Default these so each test only has to state what it is about.
		vi.mocked(db.prompts.getPromptById).mockResolvedValue({
			id: PROMPT,
			value: "You are {{role}}.",
			languageModelId: 4,
			languageModelConfig: null,
			commited: true,
		} as never);
		vi.mocked(db.prompts.getPromptCommitCount).mockResolvedValue(1 as never);
		vi.mocked(db.prompts.getProductiveCommit).mockResolvedValue(null as never);
		vi.mocked(db.placeholders.getPlaceholdersByPromptID).mockResolvedValue([] as never);
	});

	describe("createPlaceholder", () => {
		it("refuses a duplicate key on the same prompt", async () => {
			vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue({
				id: 5,
				key: "admin_role",
			} as never);
			const { res, captured } = makeRes();

			await controller.createPlaceholder(
				makeReq({ key: "admin_role" }, { id: String(PROMPT) }),
				res,
			);

			expect(captured.statusCode).toBe(400);
			expect(db.placeholders.createPlaceholder).not.toHaveBeenCalled();
		});

		it("rejects a key the renderer could never find", async () => {
			vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue(
				null as never,
			);
			const { res } = makeRes();

			// "th-ree" is not [a-zA-Z0-9_]+, so {{th-ree}} is not a placeholder at all.
			await expect(
				controller.createPlaceholder(makeReq({ key: "th-ree" }, { id: String(PROMPT) }), res),
			).rejects.toThrow();

			expect(db.placeholders.createPlaceholder).not.toHaveBeenCalled();
		});
	});

	describe("getPlaceholdersByPromptId", () => {
		it("checks prompt access and lists this prompt's placeholders", async () => {
			vi.mocked(db.placeholders.getPlaceholdersByPromptID).mockResolvedValue([
				{ id: PLACEHOLDER },
			] as never);
			const { res, captured } = makeRes();

			await controller.getPlaceholdersByPromptId(makeReq(undefined, { id: String(PROMPT) }), res);

			expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
			expect(db.placeholders.getPlaceholdersByPromptID).toHaveBeenCalledWith(PROMPT);
			expect(captured.statusCode).toBe(200);
			expect(captured.body).toEqual({ placeholders: [{ id: PLACEHOLDER }] });
		});
	});

	describe("getPlaceholderById", () => {
		it("resolves the placeholder scoped to this prompt through the layered guards", async () => {
			vi.mocked(checkPlaceholderAccess).mockResolvedValue({
				id: PLACEHOLDER,
				promptId: PROMPT,
			} as never);
			const { res, captured } = makeRes();

			await controller.getPlaceholderById(
				makeReq(undefined, { id: String(PROMPT), placeholderId: String(PLACEHOLDER) }),
				res,
			);

			expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
			expect(checkPlaceholderAccess).toHaveBeenCalledWith(PLACEHOLDER, PROMPT);
			expect(captured.statusCode).toBe(200);
			expect(captured.body).toEqual({ placeholder: { id: PLACEHOLDER, promptId: PROMPT } });
		});
	});

	describe("updatePlaceholder", () => {
		it("rewrites the prompt text when the key is renamed", async () => {
			vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue(
				null as never,
			);
			vi.mocked(db.placeholders.updatePlaceholderByID).mockResolvedValue({
				id: PLACEHOLDER,
			} as never);
			const { res, captured } = makeRes();

			await controller.updatePlaceholder(
				makeReq(
					{ key: "admin_role" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER) },
				),
				res,
			);

			// Without this the draft keeps saying {{role}} while the definition is called
			// admin_role, so the hole renders verbatim and the chip calls a placeholder the
			// author only renamed "not defined".
			expect(db.prompts.updatePromptById).toHaveBeenCalledWith(PROMPT, {
				value: "You are {{admin_role}}.",
			});
			expect((captured.body as { renamedOccurrences: number }).renamedOccurrences).toBe(1);
		});

		it("does not write the prompt when the key does not occur in the text", async () => {
			vi.mocked(checkPromptAccess).mockResolvedValue({
				id: PROMPT,
				projectId: PROJECT,
				value: "no holes here",
			} as never);
			vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue(
				null as never,
			);
			vi.mocked(db.placeholders.updatePlaceholderByID).mockResolvedValue({
				id: PLACEHOLDER,
			} as never);
			const { res, captured } = makeRes();

			await controller.updatePlaceholder(
				makeReq(
					{ key: "admin_role" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER) },
				),
				res,
			);

			expect(db.prompts.updatePromptById).not.toHaveBeenCalled();
			expect((captured.body as { renamedOccurrences: number }).renamedOccurrences).toBe(0);
		});

		it("leaves the text alone when only the description changes", async () => {
			vi.mocked(db.placeholders.updatePlaceholderByID).mockResolvedValue({
				id: PLACEHOLDER,
			} as never);
			const { res } = makeRes();

			await controller.updatePlaceholder(
				makeReq(
					{ description: "who the model is" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER) },
				),
				res,
			);

			expect(db.prompts.updatePromptById).not.toHaveBeenCalled();
		});

		it("checks both guards in order and delegates the write to the repository", async () => {
			vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue(
				null as never,
			);
			vi.mocked(db.placeholders.updatePlaceholderByID).mockResolvedValue({
				id: PLACEHOLDER,
			} as never);
			const { res, captured } = makeRes();

			await controller.updatePlaceholder(
				makeReq(
					{ description: "renamed" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER) },
				),
				res,
			);

			expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
			expect(checkPlaceholderAccess).toHaveBeenCalledWith(PLACEHOLDER, PROMPT);
			expect(db.placeholders.updatePlaceholderByID).toHaveBeenCalledWith(PLACEHOLDER, {
				description: "renamed",
			});
			expect(captured.statusCode).toBe(200);
		});

		it("does not reject a key collision against the placeholder's own row", async () => {
			// getPlaceholderByKeyAndPromptId finds the row being updated itself (same key,
			// no actual change) — that must not read as "key already exists".
			vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue({
				id: PLACEHOLDER,
				key: "admin_role",
			} as never);
			vi.mocked(db.placeholders.updatePlaceholderByID).mockResolvedValue({
				id: PLACEHOLDER,
			} as never);
			const { res, captured } = makeRes();

			await controller.updatePlaceholder(
				makeReq(
					{ key: "admin_role" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER) },
				),
				res,
			);

			expect(captured.statusCode).toBe(200);
			expect(db.placeholders.updatePlaceholderByID).toHaveBeenCalledWith(PLACEHOLDER, {
				key: "admin_role",
			});
		});

		it("refuses a key collision against a different placeholder on the same prompt", async () => {
			vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue({
				id: 999,
				key: "admin_role",
			} as never);
			const { res, captured } = makeRes();

			await controller.updatePlaceholder(
				makeReq(
					{ key: "admin_role" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER) },
				),
				res,
			);

			expect(captured.statusCode).toBe(400);
			expect(db.placeholders.updatePlaceholderByID).not.toHaveBeenCalled();
		});
	});

	describe("deletePlaceholder", () => {
		it("checks both guards in order and deletes by id", async () => {
			const { res, captured } = makeRes();

			await controller.deletePlaceholder(
				makeReq(undefined, { id: String(PROMPT), placeholderId: String(PLACEHOLDER) }),
				res,
			);

			expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
			expect(checkPlaceholderAccess).toHaveBeenCalledWith(PLACEHOLDER, PROMPT);
			expect(db.placeholders.deletePlaceholderByID).toHaveBeenCalledWith(PLACEHOLDER);
			expect(captured.statusCode).toBe(200);
		});
	});

	describe("createPlaceholderValue", () => {
		it("creates a value against the placeholder resolved for this prompt", async () => {
			vi.mocked(db.placeholders.createValue).mockResolvedValue({ id: 9 } as never);
			const { res, captured } = makeRes();

			await controller.createPlaceholderValue(
				makeReq(
					{ name: "true", content: "block", isDefault: true },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER) },
				),
				res,
			);

			expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
			expect(checkPlaceholderAccess).toHaveBeenCalledWith(PLACEHOLDER, PROMPT);
			expect(captured.statusCode).toBe(200);
			expect(db.placeholders.createValue).toHaveBeenCalledWith(PLACEHOLDER, {
				name: "true",
				content: "block",
				isDefault: true,
			});
		});
	});

	describe("updatePlaceholderValue", () => {
		it("refuses a value that does not belong to the placeholder in the URL", async () => {
			// This is the guard that stops a value from being reached through a
			// placeholder that does not own it, even once checkPlaceholderAccess has
			// already confirmed the placeholder itself belongs to the prompt.
			vi.mocked(db.placeholders.getValueByIDAndPlaceholderId).mockResolvedValue(null as never);
			const { res, captured } = makeRes();

			await controller.updatePlaceholderValue(
				makeReq(
					{ content: "new block" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER), valueId: "9001" },
				),
				res,
			);

			expect(db.placeholders.getValueByIDAndPlaceholderId).toHaveBeenCalledWith(
				9001,
				PLACEHOLDER,
			);
			expect(captured.statusCode).toBe(404);
			expect(db.placeholders.updateValueByID).not.toHaveBeenCalled();
		});

		it("updates a value that belongs to the placeholder in the URL", async () => {
			vi.mocked(db.placeholders.getValueByIDAndPlaceholderId).mockResolvedValue({
				id: 9,
				placeholderId: PLACEHOLDER,
			} as never);
			vi.mocked(db.placeholders.updateValueByID).mockResolvedValue({ id: 9 } as never);
			const { res, captured } = makeRes();

			await controller.updatePlaceholderValue(
				makeReq(
					{ content: "new block" },
					{ id: String(PROMPT), placeholderId: String(PLACEHOLDER), valueId: "9" },
				),
				res,
			);

			expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
			expect(checkPlaceholderAccess).toHaveBeenCalledWith(PLACEHOLDER, PROMPT);
			expect(db.placeholders.updateValueByID).toHaveBeenCalledWith(9, {
				content: "new block",
			});
			expect(captured.statusCode).toBe(200);
		});
	});

	describe("deletePlaceholderValue", () => {
		it("refuses a value that does not belong to the placeholder in the URL", async () => {
			vi.mocked(db.placeholders.getValueByIDAndPlaceholderId).mockResolvedValue(null as never);
			const { res, captured } = makeRes();

			await controller.deletePlaceholderValue(
				makeReq(undefined, {
					id: String(PROMPT),
					placeholderId: String(PLACEHOLDER),
					valueId: "9001",
				}),
				res,
			);

			expect(db.placeholders.getValueByIDAndPlaceholderId).toHaveBeenCalledWith(
				9001,
				PLACEHOLDER,
			);
			expect(captured.statusCode).toBe(404);
			expect(db.placeholders.deleteValueByID).not.toHaveBeenCalled();
		});

		it("deletes a value that belongs to the placeholder in the URL", async () => {
			vi.mocked(db.placeholders.getValueByIDAndPlaceholderId).mockResolvedValue({
				id: 9,
				placeholderId: PLACEHOLDER,
			} as never);
			const { res, captured } = makeRes();

			await controller.deletePlaceholderValue(
				makeReq(undefined, {
					id: String(PROMPT),
					placeholderId: String(PLACEHOLDER),
					valueId: "9",
				}),
				res,
			);

			expect(checkPromptAccess).toHaveBeenCalledWith(PROMPT, PROJECT);
			expect(checkPlaceholderAccess).toHaveBeenCalledWith(PLACEHOLDER, PROMPT);
			expect(db.placeholders.deleteValueByID).toHaveBeenCalledWith(9);
			expect(captured.statusCode).toBe(200);
		});
	});
});

// Placeholders are committed logic. Before this, none of the six mutations touched the
// commit status, so a rename or a content edit left the prompt reading "committed" while
// the productive commit kept serving the old snapshot. Each handler is listed by hand:
// the point is that adding a seventh mutation and forgetting the call shows up here.
describe("placeholder mutations re-evaluate the commit status", () => {
	let controller: PromptsController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new PromptsController();
		vi.mocked(checkPromptAccess).mockResolvedValue({
			id: PROMPT,
			projectId: PROJECT,
			value: "You are {{role}}.",
		} as never);
		vi.mocked(checkPlaceholderAccess).mockResolvedValue({
			id: PLACEHOLDER,
			promptId: PROMPT,
			key: "role",
		} as never);
		vi.mocked(db.prompts.getPromptById).mockResolvedValue({
			id: PROMPT,
			value: "You are {{role}}.",
			languageModelId: 4,
			languageModelConfig: null,
			commited: true,
		} as never);
		vi.mocked(db.prompts.getPromptCommitCount).mockResolvedValue(1 as never);
		// A productive commit whose hash cannot match the live state, so a handler that
		// refreshes the status must flip the prompt to uncommitted.
		vi.mocked(db.prompts.getProductiveCommit).mockResolvedValue({
			commitHash: "a-hash-from-before-the-edit",
		} as never);
		vi.mocked(db.placeholders.getPlaceholdersByPromptID).mockResolvedValue([] as never);
		vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue(null as never);
		vi.mocked(db.placeholders.createPlaceholder).mockResolvedValue({
			id: PLACEHOLDER,
		} as never);
		vi.mocked(db.placeholders.updatePlaceholderByID).mockResolvedValue({
			id: PLACEHOLDER,
		} as never);
		vi.mocked(db.placeholders.createValue).mockResolvedValue({ id: 9 } as never);
		vi.mocked(db.placeholders.updateValueByID).mockResolvedValue({ id: 9 } as never);
		vi.mocked(db.placeholders.getValueByIDAndPlaceholderId).mockResolvedValue({
			id: 9,
			placeholderId: PLACEHOLDER,
		} as never);
	});

	const ids = { id: String(PROMPT), placeholderId: String(PLACEHOLDER), valueId: "9" };

	const mutations: [string, () => Promise<unknown>][] = [
		[
			"createPlaceholder",
			() => controller.createPlaceholder(makeReq({ key: "tone" }, ids), makeRes().res),
		],
		[
			"updatePlaceholder",
			() => controller.updatePlaceholder(makeReq({ description: "who" }, ids), makeRes().res),
		],
		[
			"deletePlaceholder",
			() => controller.deletePlaceholder(makeReq(undefined, ids), makeRes().res),
		],
		[
			"createPlaceholderValue",
			() =>
				controller.createPlaceholderValue(
					makeReq({ name: "admin", content: "x" }, ids),
					makeRes().res,
				),
		],
		[
			"updatePlaceholderValue",
			() => controller.updatePlaceholderValue(makeReq({ content: "y" }, ids), makeRes().res),
		],
		[
			"deletePlaceholderValue",
			() => controller.deletePlaceholderValue(makeReq(undefined, ids), makeRes().res),
		],
	];

	for (const [name, run] of mutations) {
		it(`${name} marks the prompt uncommitted`, async () => {
			await run();
			expect(db.prompts.changePromptCommitStatus).toHaveBeenCalledWith(PROMPT, false);
		});
	}
});
