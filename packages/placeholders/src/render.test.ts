import { describe, expect, it } from "vitest";
import { renderPlaceholders } from "./render";
import type { PlaceholderDefinition } from "./types";

const adminRole: PlaceholderDefinition = {
	key: "admin_role",
	values: [
		{ name: "false", content: "", isDefault: true },
		{ name: "true", content: "You may use the tag tools.", isDefault: false },
	],
};

describe("renderPlaceholders", () => {
	it("substitutes the selected value", () => {
		const result = renderPlaceholders("A {{admin_role}} B", [adminRole], {
			admin_role: "true",
		});

		expect(result.text).toBe("A You may use the tag tools. B");
		expect(result.resolved).toEqual({ admin_role: "true" });
	});

	it("replaces every occurrence, not just the first", () => {
		const result = renderPlaceholders("{{admin_role}}|{{admin_role}}", [adminRole], {
			admin_role: "true",
		});

		expect(result.text).toBe("You may use the tag tools.|You may use the tag tools.");
	});

	it("falls back to the default value when nothing is selected", () => {
		const result = renderPlaceholders("A {{admin_role}} B", [adminRole], {});

		expect(result.text).toBe("A  B");
		expect(result.resolved).toEqual({ admin_role: "false" });
	});

	it("renders nothing and resolves to null when there is no default", () => {
		const noDefault: PlaceholderDefinition = {
			key: "memory_key",
			values: [{ name: "client_bmw", content: "BMW refs start with WB.", isDefault: false }],
		};

		const result = renderPlaceholders("A {{memory_key}} B", [noDefault], {});

		expect(result.text).toBe("A  B");
		expect(result.resolved).toEqual({ memory_key: null });
	});

	it("ignores a selected value whose key is not in the text", () => {
		const result = renderPlaceholders("no holes here", [adminRole], { admin_role: "true" });

		expect(result.text).toBe("no holes here");
		expect(result.ignored).toEqual(["admin_role"]);
		expect(result.resolved).toEqual({});
	});

	it("ignores a selected value naming a value that does not exist", () => {
		// An unknown name must not silently behave like the default: it is caller error.
		const result = renderPlaceholders("A {{admin_role}} B", [adminRole], {
			admin_role: "maybe",
		});

		expect(result.text).toBe("A  B");
		expect(result.resolved).toEqual({ admin_role: "false" });
		expect(result.ignored).toEqual(["admin_role"]);
	});

	it("leaves an undefined key verbatim and reports it", () => {
		const result = renderPlaceholders("A {{tone}} B", [adminRole], {});

		expect(result.text).toBe("A {{tone}} B");
		expect(result.undefinedKeys).toEqual(["tone"]);
	});

	it("reproduces the old memory behaviour when the key sits at the end", () => {
		// The migration appends `\n\n{{memory_key}}` to the draft, and this is the
		// proof that doing so is faithful to `instruction += memory.value`.
		const instruction = "# Role\nYou extract orders.";
		const memoryValue = "BMW refs start with WB.";
		const definitions: PlaceholderDefinition[] = [
			{
				key: "memory_key",
				values: [{ name: "client_bmw", content: memoryValue, isDefault: false }],
			},
		];

		const result = renderPlaceholders(`${instruction}\n\n{{memory_key}}`, definitions, {
			memory_key: "client_bmw",
		});

		expect(result.text).toBe(`${instruction}\n\n${memoryValue}`);
	});
});
