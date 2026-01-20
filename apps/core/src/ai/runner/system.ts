import { SourceType } from "@/services/logger/types";
import { getSystemOrganization, runPrompt } from "./run";
import {
	assertionEditorFormat,
	inputGeneratorFormat,
	jsonSchemaEditorFormat,
	promptAuditorFormat,
	testcaseContextFormatter,
	testcaseSummaryFormatter,
	toolEditorFormat,
} from "./formatter";
import type {
	AssertionEditorParams,
	InputGeneratorParams,
	JsonSchemaEditorParams,
	PromptAuditResponse,
	testcaseAssertion,
	ToolEditorParams,
} from "./types";
import { db } from "@/database/db";
import { xmlToObj } from "@/utils/xml";
import { PromptService } from "@/services/prompt.service";

const promptService = new PromptService(db);

export enum SYSTEM_PROMPTS {
	TESTCASE_NAMER = "TESTCASE_NAMER",
	TESTCASE_ASSERTION_V2 = "TESTCASE_ASSERTION_V2",

	PROMPT_EDITOR = "PROMPT_EDITOR",
	PROMPT_AUDITOR = "PROMPT_AUDITOR",

	CONTENT_PRETTIFY = "CONTENT_PRETTIFY",

	JSON_SCHEMA_EDITOR = "JSON_SCHEMA_EDITOR",
	TOOL_EDITOR = "TOOL_EDITOR",

	INPUT_GENERATOR = "INPUT_GENERATOR",

	CANVAS_AGENT = "CANVAS_AGENT",

	GENERIC_RULES = "GENERIC_RULES",

	SPEECH_TO_TEXT = "SPEECH_TO_TEXT",

	ASSERTION_EDITOR = "ASSERTION_EDITOR",

	COMMIT_MESSAGE_GENERATOR = "COMMIT_MESSAGE_GENERATOR",
}

async function runSystemPrompt(
	systemPromptName: SYSTEM_PROMPTS,
	question: string,
	userOrgId: number,
	userProjectId: number,
) {
	const { prompt: systemPrompt } = await getSystemPrompt(systemPromptName, userOrgId);

	const result = await runPrompt({
		prompt: systemPrompt,
		question: question,
		source: SourceType.ui,
		userProjectId: userProjectId,
		userOrgId: userOrgId,
		system_instructions: systemPrompt.value,
		systemPrompt: true,
	});

	return { answer: result.answer, chainOfThoughts: result.chainOfThoughts };
}

export async function getSystemPrompt(name: string, userOrgId: number) {
	const systemPrompt = await db.prompts.getSystemPromptByName(name);
	if (systemPrompt === null) {
		throw new Error(`System prompt ${name} not found`);
	}

	const prompt = await promptService.getPromptWithProductiveCommit(systemPrompt, {
		requireCommit: true,
	});
	if (!prompt) {
		throw new Error(`Productive commit for system prompt ${name} not found`);
	}

	const model = await db.prompts.getModelById(prompt.languageModelId);
	if (model === null) {
		throw new Error(`Model with id ${prompt.languageModelId} not found`);
	}

	const system_org = await getSystemOrganization(model.vendor, userOrgId);

	return { prompt, system_org, model };
}

async function testcaseNamer(input: string, userOrgId: number, userProjectId: number) {
	return await runSystemPrompt(SYSTEM_PROMPTS.TESTCASE_NAMER, input, userOrgId, userProjectId);
}

async function promptEditor(query: string, userOrgId: number, userProjectId: number) {
	return await runSystemPrompt(SYSTEM_PROMPTS.PROMPT_EDITOR, query, userOrgId, userProjectId);
}

async function commitMessageGenerator(diff: string, userOrgId: number, userProjectId: number) {
	return await runSystemPrompt(
		SYSTEM_PROMPTS.COMMIT_MESSAGE_GENERATOR,
		diff,
		userOrgId,
		userProjectId,
	);
}

async function testcaseAssertionV2(
	input: string,
	userOrgId: number,
	userProjectId: number,
): Promise<testcaseAssertion> {
	const result = await runSystemPrompt(
		SYSTEM_PROMPTS.TESTCASE_ASSERTION_V2,
		input,
		userOrgId,
		userProjectId,
	);

	const obj = xmlToObj(result.answer);

	const assertionStatus: testcaseAssertion = {
		assertionStatus: (obj.assertion as { status: "OK" | "NOK" }).status === "OK" ? "OK" : "NOK",
		assertionThoughts: (obj.assertion as { assertionThoughts: string }).assertionThoughts,
	};

	return assertionStatus;
}

async function promptAuditor(
	promptId: number,
	userOrgId: number,
	userProjectId: number,
): Promise<PromptAuditResponse> {
	const prompt = await db.prompts.getPromptById(promptId);
	if (prompt === null) {
		throw new Error(`Prompt with id ${promptId} not found`);
	}

	const promptTestcases = await db.testcases.getTestcasesByPromptId(prompt.id);
	const testcaseContext = testcaseSummaryFormatter(promptTestcases);

	const result = await runSystemPrompt(
		SYSTEM_PROMPTS.PROMPT_AUDITOR,
		promptAuditorFormat({
			do_not_execute_user_draft: prompt.value,
			do_not_execute_user_prompt_parameters: JSON.stringify(prompt.languageModelConfig),
			do_not_execute_user_prompt_testcase_context: testcaseContext,
		}),
		userOrgId,
		userProjectId,
	);

	return JSON.parse(result.answer) as PromptAuditResponse;
}

async function assertionEditor(data: AssertionEditorParams) {
	const prompt = data.prompt;
	const promptTestcases = await db.testcases.getTestcasesByPromptId(data.prompt.id);
	const testcaseContext = testcaseContextFormatter(promptTestcases);

	return await runSystemPrompt(
		SYSTEM_PROMPTS.ASSERTION_EDITOR,
		assertionEditorFormat({
			do_not_execute_user_draft: prompt.value,
			do_not_execute_user_prompt_parameters: JSON.stringify(prompt.languageModelConfig),
			do_not_execute_user_prompt_testcase_context: testcaseContext,
			do_not_execute_assertion_instruction: prompt.assertionValue ?? "",
			user_query: data.user_query,
		}),
		data.userOrgId,
		data.userProjectId,
	);
}

async function jsonSchemaEditor(data: JsonSchemaEditorParams) {
	return await runSystemPrompt(
		SYSTEM_PROMPTS.JSON_SCHEMA_EDITOR,
		jsonSchemaEditorFormat(data),
		data.userOrgId,
		data.userProjectId,
	);
}

async function toolEditor(data: ToolEditorParams) {
	return await runSystemPrompt(
		SYSTEM_PROMPTS.TOOL_EDITOR,
		toolEditorFormat(data),
		data.userOrgId,
		data.userProjectId,
	);
}

async function inputGenerator(data: InputGeneratorParams) {
	return await runSystemPrompt(
		SYSTEM_PROMPTS.INPUT_GENERATOR,
		inputGeneratorFormat(data),
		data.userOrgId,
		data.userProjectId,
	);
}

async function contentPrettify(text: string, userOrgId: number, userProjectId: number) {
	return await runSystemPrompt(SYSTEM_PROMPTS.CONTENT_PRETTIFY, text, userOrgId, userProjectId);
}

export const system_prompt = {
	testcaseNamer,
	promptEditor,
	commitMessageGenerator,
	testcaseAssertionV2,
	promptAuditor,
	assertionEditor,
	jsonSchemaEditor,
	toolEditor,
	inputGenerator,
	contentPrettify,
};
