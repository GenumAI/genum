import { describe, it, expect, vi, beforeEach } from "vitest";
import { findDiff, type PromptState } from "./diff";

describe("diff utility", () => {
	const mockModelCallback = vi.fn().mockResolvedValue("GPT-4");

	beforeEach(() => {
		vi.clearAllMocks();
	});

	const oldState: PromptState = {
		value: "Old prompt content",
		languageModelConfig: { temperature: 0.5 },
		languageModelId: 1,
	};

	const newState: PromptState = {
		value: "New prompt content",
		languageModelConfig: { temperature: 0.7 },
		languageModelId: 2,
	};

	it("should find differences between prompt states", async () => {
		const result = await findDiff(oldState, newState, mockModelCallback);

		// Check if the XML structure contains expected changes
		expect(result).toContain("<promptChanges>");
		expect(result).toContain("- Old prompt content");
		expect(result).toContain("+ New prompt content");
		expect(result).toContain("</promptChanges>");

		expect(result).toContain("<languageModelConfigChanges>");
		expect(result).toContain('-   "temperature": 0.5');
		expect(result).toContain('+   "temperature": 0.7');
		expect(result).toContain("</languageModelConfigChanges>");

		expect(result).toContain("<languageModelChanges>");
		expect(result).toContain("Model changed to GPT-4");
		expect(result).toContain("</languageModelChanges>");
	});

	it("should return empty changes if states are identical", async () => {
		const result = await findDiff(oldState, oldState, mockModelCallback);

		expect(result).toContain("<promptChanges></promptChanges>");
		expect(result).toContain("<languageModelConfigChanges></languageModelConfigChanges>");
		expect(result).toContain("<languageModelChanges></languageModelChanges>");
	});

	it("should handle multiline diffs correctly", async () => {
		const multiLineOld: PromptState = {
			...oldState,
			value: "Line 1\nLine 2\nLine 3",
		};
		const multiLineNew: PromptState = {
			...newState,
			value: "Line 1\nLine 2.5\nLine 3\nLine 4",
		};

		const result = await findDiff(multiLineOld, multiLineNew, mockModelCallback);

		expect(result).toContain("+ Line 2.5");
		expect(result).toContain("+ Line 4");
		expect(result).toContain("- Line 2");
	});

	it("should not include model change message if IDs are the same", async () => {
		const sameModelNewState = { ...newState, languageModelId: 1 };
		const result = await findDiff(oldState, sameModelNewState, mockModelCallback);

		expect(result).toContain("<languageModelChanges></languageModelChanges>");
		expect(mockModelCallback).not.toHaveBeenCalled();
	});
});
