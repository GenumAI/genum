import { describe, expect, it } from "vitest";

import { shapeInstruction } from "./instruction";

describe("shapeInstruction", () => {
	it("shapes markdown into the XML form a run has always sent", () => {
		expect(shapeInstruction("# Role\nBe helpful", "XML")).toBe(
			"<instructions> <role>\nBe helpful\n</role> </instructions>",
		);
	});

	it("sends RAW text exactly as written", () => {
		// Including the blank lines and `---` rules the XML form drops, and the markdown
		// headers it would turn into tags.
		const text = "# Role\n\nBe helpful\n\n---\n\n<not-a-tag>";
		expect(shapeInstruction(text, "RAW")).toBe(text);
	});

	it("does not wrap RAW text in a tag it did not ask for", () => {
		// A caller asking for the text as written, and getting it inside `<instructions>`,
		// is back where it started.
		expect(shapeInstruction("plain", "RAW")).not.toContain("<instructions>");
	});

	it("wraps a system prompt, in either format", () => {
		expect(shapeInstruction("hi", "RAW", { systemPrompt: true })).toBe(
			"<system_prompt>hi</system_prompt>",
		);
		expect(shapeInstruction("hi", "XML", { systemPrompt: true })).toBe(
			"<system_prompt><instructions> hi </instructions></system_prompt>",
		);
	});

	it("leaves a plain prompt unwrapped", () => {
		expect(shapeInstruction("hi", "RAW")).toBe("hi");
	});
});
