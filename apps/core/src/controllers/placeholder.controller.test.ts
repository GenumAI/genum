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
		prompts: { getPromptById: vi.fn() },
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkPromptAccess: vi.fn(async () => ({ id: 1, projectId: 7 })),
	checkPlaceholderAccess: vi.fn(async () => ({ id: 5, promptId: 1 })),
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
