import type { Request, Response } from "express";
import { TestCaseStatus } from "@/prisma";
import {
	type TestcasesCreateType,
	TestcasesCreateWithoutNameSchema,
	TestcasesUpdateSchema,
	TestcaseRunSchema,
	numberSchema,
} from "@/services/validate";
import { testcaseAssertionFormat, testcaseNamerFormat } from "@/ai/runner/formatter";
import { checkPromptAccess, checkTestcaseAccess } from "@/services/access/AccessService";
import { db } from "@/database/db";
import { runPrompt } from "@/ai/runner/run";
import { system_prompt } from "@/ai/runner/system";
import { SourceType } from "@/services/logger";
import { type FileInput, fileService } from "@/services/file.service";

export class TestcasesController {
	async getAllTestcases(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const testcases = await db.testcases.getProjectTestcases(metadata.projID);
		res.status(200).json({ testcases });
	}

	async getTestcaseById(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);

		const testcase = await checkTestcaseAccess(id, metadata.projID);

		res.status(200).json({ testcase });
	}

	async createTestcase(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = TestcasesCreateWithoutNameSchema.parse(req.body);

		const prompt = await checkPromptAccess(data.promptId, metadata.projID);

		// Validate files if provided
		if (data.files && data.files.length > 0) {
			// Verify all files belong to the project
			for (const fileId of data.files) {
				const file = await db.file.getFileById(fileId, metadata.projID);
				if (!file) {
					throw new Error(`File ${fileId} not found or does not belong to project`);
				}
			}
		}

		// Resolved before naming (not just before persisting) so the namer gets the same
		// extra context `memory?.value` used to supply -- the content of whatever the
		// caller pinned, e.g. a client name a generic input alone wouldn't surface.
		const { rows, unresolved } = await db.placeholders.resolveSelection(
			prompt.id,
			data.placeholders ?? {},
		);
		const extraContext = rows.map((row) => row.content).join("\n\n") || undefined;

		const payload = testcaseNamerFormat({
			do_not_execute_user_draft: prompt.value,
			do_not_execute_user_draft_extraContext: extraContext,
			do_not_execute_input: data.input,
		});

		const { answer: name } = await system_prompt.testcaseNamer(
			payload,
			metadata.orgID,
			metadata.projID,
		);

		const testcaseData: TestcasesCreateType & { files?: string[] } = {
			...data,
			name: data.name ?? `Testcase: ${name}`.slice(0, 230),
			files: data.files,
		};

		const testcase = await db.testcases.newTestcase(testcaseData);

		await db.testcases.setPlaceholderSelection(testcase.id, rows);

		res.status(200).json({ testcase, unresolvedPlaceholders: unresolved });
	}

	async updateTestcase(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);
		const data = TestcasesUpdateSchema.parse(req.body);

		const existing = await checkTestcaseAccess(id, metadata.projID);

		// `placeholders` follows the same convention the retired memory selector used:
		// absent means leave it alone, an explicit `{}` means clear it. Resolving unconditionally would
		// wipe a testcase's pinned selection on every unrelated partial update (e.g. a
		// rename), since `data.placeholders ?? {}` can't tell "not sent" from "sent empty".
		//
		// This must run BEFORE updateTestcaseByID: that call's response carries the
		// placeholderValues include, so writing the new pin after building the response
		// would answer a PUT with the pre-update selection.
		let unresolved: string[] = [];
		if (data.placeholders !== undefined) {
			const resolved = await db.placeholders.resolveSelection(
				existing.promptId,
				data.placeholders,
			);
			unresolved = resolved.unresolved;
			await db.testcases.setPlaceholderSelection(id, resolved.rows);
		}

		const testcase = await db.testcases.updateTestcaseByID(id, data);

		res.status(200).json({ testcase, unresolvedPlaceholders: unresolved });
	}

	async deleteTestcase(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);

		await checkTestcaseAccess(id, metadata.projID);

		await db.testcases.deleteTestcaseByID(id);
		res.status(200).json({ id });
	}

	async runTestcase(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;

		const id = numberSchema.parse(req.params.id);
		const { placeholders: requestPlaceholders } = TestcaseRunSchema.parse(req.body ?? {});

		const testcase = await checkTestcaseAccess(id, metadata.projID);

		// Get files from testcase or use files from request
		let filesToUse: string[] | undefined;
		if (testcase.files && testcase.files.length > 0) {
			// Use files from testcase
			filesToUse = testcase.files.map((tf) => tf.fileId);
		}

		// Get file objects if files are provided
		let fileObjects: FileInput[] | undefined;
		if (filesToUse && filesToUse.length > 0) {
			fileObjects = await fileService.getFileObjectsByIds(filesToUse, metadata.projID);
		}

		// The testcase's pinned selection (Task 8) is what a run uses by default; an
		// explicit selection in the request body (e.g. the playground chips) overrides
		// it wholesale rather than merging key by key, since that's a deliberate,
		// in-the-moment choice against a stored default.
		const pinnedPlaceholders: Record<string, string> = {};
		for (const pinned of testcase.placeholderValues) {
			pinnedPlaceholders[pinned.placeholderValue.placeholder.key] =
				pinned.placeholderValue.name;
		}
		const placeholders = requestPlaceholders ?? pinnedPlaceholders;

		const run = await runPrompt({
			prompt: testcase.prompt,
			question: testcase.input,
			source: SourceType.testcase,
			userProjectId: metadata.projID,
			userOrgId: metadata.orgID,
			user_id: metadata.userID,
			testcase_id: testcase.id,
			files: fileObjects,
			placeholders,
		});

		const assertionType = testcase.prompt.assertionType;
		const assertionValue = testcase.prompt.assertionValue;

		const updateData: Record<string, unknown> = {
			lastOutput: run.answer,
			lastChainOfThoughts: run.chainOfThoughts,
			assertionThoughts: "",
		};

		if (assertionType === "MANUAL") {
			updateData.status = TestCaseStatus.NEED_RUN;
		} else if (assertionType === "AI") {
			const assertionInput = testcaseAssertionFormat({
				assertion_instruction: assertionValue || "",
				last_output: run.answer,
				expected_output: testcase.expectedOutput,
			});
			const assertion = await system_prompt.testcaseAssertionV2(
				assertionInput,
				metadata.orgID,
				metadata.projID,
			);

			updateData.status =
				assertion.assertionStatus === TestCaseStatus.OK
					? TestCaseStatus.OK
					: TestCaseStatus.NOK;
			updateData.assertionThoughts = assertion.assertionThoughts;
		} else if (assertionType === "STRICT") {
			updateData.status = getTestcaseStatus(run.answer, testcase.expectedOutput);
		}

		const return_testcase = await db.testcases.updateTestcaseByID(id, updateData);

		res.status(200).json({
			...run,
			testcase: { ...return_testcase, assertionType, assertionValue },
		});
	}

	async addFileToTestcase(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const testcaseId = numberSchema.parse(req.params.id);
		const { fileId } = req.body as { fileId: string };

		await checkTestcaseAccess(testcaseId, metadata.projID);

		// Verify file belongs to project
		const file = await db.file.getFileById(fileId, metadata.projID);
		if (!file) {
			throw new Error("File not found or does not belong to project");
		}

		const testcaseFile = await db.testcases.addFileToTestcase(testcaseId, fileId);
		res.status(200).json({ testcaseFile });
	}

	async removeFileFromTestcase(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const testcaseId = numberSchema.parse(req.params.id);
		const fileId = req.params.fileId as string;

		await checkTestcaseAccess(testcaseId, metadata.projID);

		await db.testcases.removeFileFromTestcase(testcaseId, fileId);
		res.status(200).json({ success: true });
	}
}

function getTestcaseStatus(lastOutput: string, expectedOutput: string) {
	try {
		const normalizedAnswer = normalize(lastOutput);
		const normalizedExpected = normalize(expectedOutput);
		return normalizedAnswer === normalizedExpected ? TestCaseStatus.OK : TestCaseStatus.NOK;
	} catch (e) {
		console.error(e);
		return TestCaseStatus.NOK;
	}
}

function sortKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(sortKeys);
	} else if (value !== null && typeof value === "object") {
		return Object.keys(value as Record<string, unknown>)
			.filter((key) => key !== "chainOfThoughts") // exclude chainOfThought
			.sort()
			.reduce((acc: Record<string, unknown>, key) => {
				acc[key] = sortKeys((value as Record<string, unknown>)[key]);
				return acc;
			}, {});
	}
	return value;
}

function normalize(input: unknown): string {
	try {
		const parsed = JSON.parse(String(input));
		// convert object to standard view, sorting keys (without chainOfThought)
		return JSON.stringify(sortKeys(parsed));
	} catch {
		// if not JSON, simply convert string to one view
		return String(input).trim().toLowerCase();
	}
}
