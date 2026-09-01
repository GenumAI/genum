import { describe, expect, it } from "vitest";
import { mergePlaceholderInput } from "./merge-input";

describe("mergePlaceholderInput", () => {
	it("folds the deprecated memoryKey into the memory_key placeholder", () => {
		expect(mergePlaceholderInput({ memoryKey: "client_bmw" })).toEqual({
			memory_key: "client_bmw",
		});
	});

	it("lets an explicit placeholders entry win over the deprecated field", () => {
		expect(
			mergePlaceholderInput({
				placeholders: { memory_key: "explicit" },
				memoryKey: "legacy",
			}),
		).toEqual({ memory_key: "explicit" });
	});

	it("passes other keys through untouched", () => {
		expect(
			mergePlaceholderInput({ placeholders: { admin_role: "true" }, memoryKey: "legacy" }),
		).toEqual({ admin_role: "true", memory_key: "legacy" });
	});

	it("returns an empty selection when neither field is given", () => {
		expect(mergePlaceholderInput({})).toEqual({});
	});
});
