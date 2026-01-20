import type { TestCase } from "@/prisma";
import { objToXml } from "@/utils/xml";
import type { InputGeneratorParams, JsonSchemaEditorParams, ToolEditorParams } from "./types";

export type TestcaseNamerFormatParams = {
	do_not_execute_user_draft: string;
	do_not_execute_user_draft_extraContext?: string;
	do_not_execute_input: string;
};
export function testcaseNamerFormat(data: TestcaseNamerFormatParams) {
	return formatToXml(data);
}

export type TestcaseAssertionFormatParams = {
	assertion_instruction: string;
	last_output: string;
	expected_output: string;
};
export function testcaseAssertionFormat(data: TestcaseAssertionFormatParams) {
	return formatToXml(data);
}

export type PromptEditorFormatParams = {
	do_not_execute_user_draft: string;
	do_not_execute_user_prompt_parameters: string;
	user_query: string;
};
export function promptEditorFormat(data: PromptEditorFormatParams) {
	return formatToXml(data);
}

export type PromptAuditorFormatParams = {
	do_not_execute_user_draft: string;
	do_not_execute_user_prompt_parameters: string;
	do_not_execute_user_prompt_testcase_context: string;
};
export function promptAuditorFormat(data: PromptAuditorFormatParams) {
	return formatToXml(data);
}

export type AssertionEditorFormatParams = {
	do_not_execute_user_draft: string;
	do_not_execute_user_prompt_parameters: string;
	do_not_execute_user_prompt_testcase_context: string;
	do_not_execute_assertion_instruction: string;
	user_query: string;
};
export function assertionEditorFormat(data: AssertionEditorFormatParams) {
	return formatToXml(data);
}

// generic function to format data to XML
export function formatToXml<T extends Record<string, unknown>>(data: T): string {
	return objToXml(data);
}

// leave functions for backward compatibility and type safety // todo
export function jsonSchemaEditorFormat(data: JsonSchemaEditorParams) {
	return formatToXml(data);
}

export function toolEditorFormat(data: ToolEditorParams) {
	return formatToXml(data);
}

export function inputGeneratorFormat(data: InputGeneratorParams) {
	return formatToXml(data);
}

export type CanvasAgentFormatParams = {
	do_not_execute_user_draft: string;
	do_not_execute_user_prompt_parameters: string;
	do_not_execute_user_prompt_context?: {
		input?: string;
		last_output?: string;
		last_thoughts?: string;
		expected_output?: string;
		expected_thoughts?: string;
	};
	do_not_execute_user_prompt_testcase_context: string;
	user_query: string;
};
export function canvasAgentFormat(data: CanvasAgentFormatParams) {
	return formatToXml(data);
}

export function testcaseSummaryFormatter(testcases: TestCase[]) {
	const testcaseSummary: string[] = testcases.map((testcase) => {
		return formatToXml({
			[`testcase__${testcase.name}`]: testcase.status,
		});
	});

	return testcaseSummary.join("\n");
}

export function testcaseContextFormatter(testcases: TestCase[]) {
	const testcaseContext: string[] = testcases.map((testcase) => {
		return formatToXml({
			testcase_input: testcase.input,
			testcase_last_output: testcase.lastOutput,
			testcase_expected_output: testcase.expectedOutput,
		});
	});

	return testcaseContext.join("\n");
}
