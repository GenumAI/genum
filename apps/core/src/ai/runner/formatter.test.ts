import { describe, it, expect } from "vitest";
import {
	testcaseNamerFormat,
	formatToXml,
	canvasAgentFormat,
	testcaseSummaryFormatter,
	testcaseContextFormatter,
} from "./formatter";
import type { Prompt, PromptVersion, TestCase } from "@/prisma";

describe("AI Formatter", () => {
	describe("formatToXml", () => {
		it("should format simple object to XML tags", () => {
			const data = { key: "value", numeric: 123 };
			const result = formatToXml(data);
			expect(result).toContain("<key>value</key>");
			expect(result).toContain("<numeric>123</numeric>");
		});
	});

	describe("testcaseNamerFormat", () => {
		it("should format testcase namer data correctly", () => {
			const data = {
				do_not_execute_user_draft: "draft content",
				do_not_execute_input: "input content",
			};
			const result = testcaseNamerFormat(data);
			expect(result).toContain(
				"<do_not_execute_user_draft>draft content</do_not_execute_user_draft>",
			);
			expect(result).toContain("<do_not_execute_input>input content</do_not_execute_input>");
		});
	});

	describe("canvasAgentFormat", () => {
		it("should format complex canvas agent data including nested context", () => {
			const data = {
				do_not_execute_user_draft: "prompt value",
				do_not_execute_user_prompt_parameters: "model config",
				do_not_execute_user_prompt_testcase_context: "test context",
				user_query: "make it better",
				do_not_execute_user_prompt_context: {
					input: "user input",
					last_output: "ai output",
				},
			};
			const result = canvasAgentFormat(data);
			expect(result).toContain(
				"<do_not_execute_user_draft>prompt value</do_not_execute_user_draft>",
			);
			expect(result).toContain("<input>user input</input>");
			expect(result).toContain("<last_output>ai output</last_output>");
		});
	});

	describe("testcaseSummaryFormatter", () => {
		it("should format multiple testcases into a summary string", () => {
			const testcases = [
				{ name: "Test1", status: "SUCCESS" },
				{ name: "Test2", status: "FAILED" },
			] as TestCase[];

			const result = testcaseSummaryFormatter(testcases);
			expect(result).toContain("<testcase__Test1>SUCCESS</testcase__Test1>");
			expect(result).toContain("<testcase__Test2>FAILED</testcase__Test2>");
			expect(result.split("\n")).toHaveLength(2);
		});
	});

	describe("testcaseContextFormatter", () => {
		it("should format multiple testcases context", () => {
			const testcases = [
				{
					input: "input1",
					lastOutput: "output1",
					expectedOutput: "expected1",
				},
			] as TestCase[];

			const result = testcaseContextFormatter(testcases);
			expect(result).toContain("<testcase_input>input1</testcase_input>");
			expect(result).toContain("<testcase_last_output>output1</testcase_last_output>");
			expect(result).toContain(
				"<testcase_expected_output>expected1</testcase_expected_output>",
			);
		});
	});
});
