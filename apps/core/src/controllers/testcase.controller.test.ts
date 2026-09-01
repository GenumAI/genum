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
		memories: {
			getMemoryByIDAndPromptId: vi.fn(),
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
	},
}));

import { db } from "@/database/db";
import { checkTestcaseAccess, checkPromptAccess } from "@/services/access/AccessService";
import { system_prompt } from "@/ai/runner/system";
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
		// The guard `memoryId` used to carry: resolution is scoped to this prompt, so a
		// value id from another tenant's prompt is simply not resolvable here.
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
});
