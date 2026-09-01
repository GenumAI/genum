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
	},
}));

vi.mock("@/ai/runner/run", () => ({
	runPrompt: vi.fn(),
}));

import { db } from "@/database/db";
import { checkTestcaseAccess, checkPromptAccess } from "@/services/access/AccessService";
import { system_prompt } from "@/ai/runner/system";
import { runPrompt } from "@/ai/runner/run";
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
