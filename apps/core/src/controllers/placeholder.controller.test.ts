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
			createValue: vi.fn(),
		},
		prompts: { getPromptById: vi.fn() },
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkPromptAccess: vi.fn(async () => ({ id: 1, projectId: 7 })),
	checkPlaceholderAccess: vi.fn(async () => ({ id: 5, promptId: 1 })),
}));

import { db } from "@/database/db";
import { PromptsController } from "./prompt.controller";

const PROMPT = 1;

function makeReq(body: unknown, params: Record<string, string>) {
	return {
		body,
		params,
		genumMeta: { ids: { projID: 7, orgID: 3, userID: 11 } },
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
		vi.mocked(db.placeholders.getPlaceholderByKeyAndPromptId).mockResolvedValue(null as never);
		const { res } = makeRes();

		// "th-ree" is not [a-zA-Z0-9_]+, so {{th-ree}} is not a placeholder at all.
		await expect(
			controller.createPlaceholder(makeReq({ key: "th-ree" }, { id: String(PROMPT) }), res),
		).rejects.toThrow();

		expect(db.placeholders.createPlaceholder).not.toHaveBeenCalled();
	});

	it("creates a value against the placeholder resolved for this prompt", async () => {
		vi.mocked(db.placeholders.createValue).mockResolvedValue({ id: 9 } as never);
		const { res, captured } = makeRes();

		await controller.createPlaceholderValue(
			makeReq(
				{ name: "true", content: "block", isDefault: true },
				{ id: String(PROMPT), placeholderId: "5" },
			),
			res,
		);

		expect(captured.statusCode).toBe(200);
		expect(db.placeholders.createValue).toHaveBeenCalledWith(5, {
			name: "true",
			content: "block",
			isDefault: true,
		});
	});
});
