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
import { callPromptModel, runPrompt } from "@/ai/runner/run";
import { compareSteps } from "@/ai/steps/compare";
import { replayTrajectory } from "@/ai/steps/replay";
import { StepsSchema, StepsConfigSchema } from "@/ai/steps/schema";
import {
	DEFAULT_STEPS_CONFIG,
	type Step,
	type StepsConfig,
	type ToolCallStep,
} from "@/ai/steps/types";
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

		const runParams = {
			prompt: testcase.prompt,
			question: testcase.input,
			source: SourceType.testcase,
			userProjectId: metadata.projID,
			userOrgId: metadata.orgID,
			user_id: metadata.userID,
			testcase_id: testcase.id,
			files: fileObjects,
			placeholders,
		};

		// A trajectory testcase carries the steps it pinned; `null` is the plain text
		// testcase this endpoint has always run, and takes exactly the path it always did.
		const expectedSteps = readExpectedSteps(testcase.expectedSteps);

		let run: Awaited<ReturnType<typeof runPrompt>> | undefined;
		let replay: Awaited<ReturnType<typeof replayTrajectory>> | undefined;

		if (expectedSteps) {
			// The replay's first turn IS the run -- calling `runPrompt` separately first
			// would bill and log an extra, identical call to the provider on every run of
			// every trajectory testcase. `run` ends up holding the last turn, which is the
			// one whose answer the testcase records.
			replay = await replayTrajectory({
				callModel: async (messages) => {
					run = await callPromptModel(runParams, messages);
					return run;
				},
				recorded: expectedSteps.filter(
					(step): step is ToolCallStep => step.kind === "tool_call",
				),
			});
		} else {
			run = await runPrompt(runParams);
		}

		if (!run) {
			// replayTrajectory always calls the model at least once, so this is
			// unreachable; it is here because the type cannot say so.
			throw new Error("The run produced no model turn");
		}

		const assertionType = testcase.prompt.assertionType;
		const assertionValue = testcase.prompt.assertionValue;

		const updateData: Record<string, unknown> = {
			lastOutput: run.answer,
			lastChainOfThoughts: run.chainOfThoughts,
			assertionThoughts: "",
		};

		if (expectedSteps && replay) {
			// Written on every run, asserted or not, so the UI can diff the trajectory
			// without running the prompt again.
			updateData.lastSteps = replay.steps;

			if (replay.stopped) {
				// A tool the recording does not cover is a result, not an error: it is
				// what a changed trajectory looks like.
				updateData.status = TestCaseStatus.NOK;
				updateData.assertionThoughts = replay.stopped.message;
			} else if (assertionType === "MANUAL") {
				updateData.status = TestCaseStatus.NEED_RUN;
			} else if (assertionType === "AI") {
				const assertion = await system_prompt.testcaseAssertionV2(
					testcaseAssertionFormat({
						assertion_instruction: assertionValue || "",
						last_output: JSON.stringify(replay.steps),
						expected_output: JSON.stringify(expectedSteps),
					}),
					metadata.orgID,
					metadata.projID,
				);
				updateData.status =
					assertion.assertionStatus === TestCaseStatus.OK
						? TestCaseStatus.OK
						: TestCaseStatus.NOK;
				updateData.assertionThoughts = assertion.assertionThoughts;
			} else {
				const result = assertTrajectory(
					expectedSteps,
					replay.steps,
					readStepsConfig(testcase.stepsConfig),
				);
				updateData.status = result.status;
				updateData.assertionThoughts = result.thoughts;
			}
		} else if (assertionType === "MANUAL") {
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

/**
 * STRICT assertion over a trajectory. Only steps the author enabled are compared;
 * see `ai/steps/compare.ts` for the argument-matching modes.
 */
export function assertTrajectory(
	expected: Step[],
	actual: Step[],
	stepsConfig: StepsConfig | null,
): { status: TestCaseStatus; thoughts: string } {
	const mismatches = compareSteps(expected, actual, stepsConfig ?? DEFAULT_STEPS_CONFIG);

	if (mismatches.length === 0) {
		return { status: TestCaseStatus.OK, thoughts: "" };
	}

	return {
		status: TestCaseStatus.NOK,
		thoughts: mismatches.map((mismatch) => mismatch.reason).join("; "),
	};
}

/**
 * `expectedSteps` is a `Json?` column, so what comes back out is only as trustworthy as
 * what went in. The create/update schemas validate it on the way in; this re-checks on
 * the way out so a row written before that guard, or by hand, fails loudly instead of
 * quietly asserting nothing at all.
 */
function readExpectedSteps(value: unknown): Step[] | null {
	if (value === null || value === undefined) {
		return null;
	}
	const parsed = StepsSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error("Testcase expectedSteps is not a valid trajectory");
	}
	return parsed.data;
}

function readStepsConfig(value: unknown): StepsConfig | null {
	if (value === null || value === undefined) {
		return null;
	}
	const parsed = StepsConfigSchema.safeParse(value);
	// An unreadable config is not worth failing a run over: fall back to the default,
	// which is the config every testcase gets when the author never touched it.
	return parsed.success ? parsed.data : null;
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
