import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		testcases: {
			updateTestcaseByID: vi.fn(),
		},
		memories: {
			getMemoryByIDAndPromptId: vi.fn(),
		},
	},
}));

vi.mock("@/services/access/AccessService", () => ({
	checkTestcaseAccess: vi.fn(),
}));

import { db } from "@/database/db";
import { checkTestcaseAccess } from "@/services/access/AccessService";
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
	});

	it("updates a testcase that carries no memory reference", async () => {
		const { res, captured } = makeRes();

		await controller.updateTestcase(makeReq({ name: "renamed" }), res);

		expect(captured.statusCode).toBe(200);
		expect(db.testcases.updateTestcaseByID).toHaveBeenCalled();
	});

	it("accepts a memory that belongs to the same prompt", async () => {
		vi.mocked(db.memories.getMemoryByIDAndPromptId).mockResolvedValue({ id: 9 } as never);
		const { res, captured } = makeRes();

		await controller.updateTestcase(makeReq({ memoryId: 9 }), res);

		expect(captured.statusCode).toBe(200);
		expect(db.memories.getMemoryByIDAndPromptId).toHaveBeenCalledWith(9, PROMPT);
	});

	it("refuses a memory belonging to another prompt", async () => {
		// The bug: memoryId was writable through TestcasesUpdateSchema and never
		// validated here, unlike createTestcase, so another tenant's memory key
		// could be pulled into the caller's testcase listing.
		vi.mocked(db.memories.getMemoryByIDAndPromptId).mockResolvedValue(null as never);
		const { res } = makeRes();

		await expect(controller.updateTestcase(makeReq({ memoryId: 9001 }), res)).rejects.toThrow(
			"Memory not found",
		);

		expect(db.testcases.updateTestcaseByID).not.toHaveBeenCalled();
	});
});
