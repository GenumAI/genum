import { describe, it, expect } from "vitest";
import { mdToXml, objToXml, xmlToObj } from "./xml";

describe("mdToXml", () => {
	it("should convert simple header to XML tag", () => {
		const markdown = "# Hello World";
		const result = mdToXml(markdown);
		expect(result).toContain("<hello-world>");
		expect(result).toContain("</hello-world>");
		expect(result).toContain("<instructions>");
		expect(result).toContain("</instructions>");
	});

	it("should handle multiple headers at same level", () => {
		const markdown = "# First\n# Second";
		const result = mdToXml(markdown);
		expect(result).toContain("<first>");
		expect(result).toContain("</first>");
		expect(result).toContain("<second>");
		expect(result).toContain("</second>");
	});

	it("should nest headers correctly by level", () => {
		const markdown = "# Parent\n## Child\n## Another Child\n# New Parent";
		const result = mdToXml(markdown);

		// Parent should open first
		const parentIndex = result.indexOf("<parent>");
		const childIndex = result.indexOf("<child>");
		const newParentIndex = result.indexOf("<new-parent>");

		expect(parentIndex).toBeLessThan(childIndex);
		expect(childIndex).toBeLessThan(newParentIndex);
		// Child should close before new parent
		expect(result.indexOf("</child>")).toBeLessThan(newParentIndex);
	});

	it("should close sections when higher level header appears", () => {
		const markdown = "# Level 1\n## Level 2\n## Level 2 Again\n# New Level 1";
		const result = mdToXml(markdown);

		// Both level 2 sections should close before new level 1
		const firstLevel2Close = result.indexOf("</level-2>");
		const secondLevel2Close = result.lastIndexOf("</level-2>");
		const newLevel1Index = result.indexOf("<new-level-1>");

		expect(firstLevel2Close).toBeLessThan(newLevel1Index);
		expect(secondLevel2Close).toBeLessThan(newLevel1Index);
	});

	it("should handle empty lines and separators", () => {
		const markdown = "# Header\n\n---\n\nContent";
		const result = mdToXml(markdown);

		expect(result).toContain("<header>");
		expect(result).toContain("Content");
		// Empty lines and separators should be filtered out
		expect(result.split("\n").filter((line) => line.trim() === "---").length).toBe(0);
	});

	it("should handle multiple levels of nesting", () => {
		const markdown = "# A\n## B\n### C\n## D\n# E";
		const result = mdToXml(markdown);

		expect(result).toContain("<a>");
		expect(result).toContain("<b>");
		expect(result).toContain("<c>");
		expect(result).toContain("<d>");
		expect(result).toContain("<e>");

		// C should be nested inside B
		const bOpen = result.indexOf("<b>");
		const cOpen = result.indexOf("<c>");
		const cClose = result.indexOf("</c>");
		const bClose = result.indexOf("</b>");

		expect(bOpen).toBeLessThan(cOpen);
		expect(cClose).toBeLessThan(bClose);
	});

	it("should slugify header text correctly", () => {
		const markdown = "# Hello World 123!\n## Test@Special#Chars";
		const result = mdToXml(markdown);

		expect(result).toContain("<hello-world-123>");
		expect(result).toContain("<test-special-chars>");
		expect(result).not.toContain("Hello World");
		expect(result).not.toContain("@");
	});

	it("should handle empty markdown", () => {
		const result = mdToXml("");
		expect(result).toBe("<instructions>  </instructions>");
	});

	it("should handle markdown with only content (no headers)", () => {
		const markdown = "Just some content here";
		const result = mdToXml(markdown);

		expect(result).toContain("Just some content here");
		expect(result).toContain("<instructions>");
		expect(result).toContain("</instructions>");
	});
});

describe("objToXml", () => {
	it("should convert simple object to XML", () => {
		const obj = { name: "John", age: 30 };
		const result = objToXml(obj);

		expect(result).toContain("<name>John</name>");
		expect(result).toContain("<age>30</age>");
	});

	it("should handle nested objects", () => {
		const obj = {
			user: {
				name: "John",
				age: 30,
			},
		};
		const result = objToXml(obj);

		expect(result).toContain("<user>");
		expect(result).toContain("</user>");
		expect(result).toContain("<name>John</name>");
		expect(result).toContain("<age>30</age>");
	});

	it("should filter out undefined values", () => {
		const obj = {
			name: "John",
			age: undefined,
			city: "NYC",
		};
		const result = objToXml(obj);

		expect(result).toContain("<name>John</name>");
		expect(result).toContain("<city>NYC</city>");
		expect(result).not.toContain("age");
	});

	it("should handle different value types", () => {
		const obj = {
			string: "text",
			number: 42,
			boolean: true,
			null: null,
		};
		const result = objToXml(obj);

		expect(result).toContain("<string>text</string>");
		expect(result).toContain("<number>42</number>");
		expect(result).toContain("<boolean>true</boolean>");
		expect(result).toContain("<null>null</null>");
	});

	it("should handle deeply nested objects", () => {
		const obj = {
			level1: {
				level2: {
					level3: {
						value: "deep",
					},
				},
			},
		};
		const result = objToXml(obj);

		expect(result).toContain("<level1>");
		expect(result).toContain("<level2>");
		expect(result).toContain("<level3>");
		expect(result).toContain("<value>deep</value>");
	});

	it("should handle empty object", () => {
		const result = objToXml({});
		expect(result).toBe("");
	});

	it("should convert arrays to strings", () => {
		const obj = {
			tags: ["a", "b", "c"],
		};
		const result = objToXml(obj);

		// Arrays should be converted to string representation
		expect(result).toContain("<tags>");
		expect(result).toContain("</tags>");
	});

	it("should handle special characters in values", () => {
		const obj = {
			text: "Hello & World <test>",
		};
		const result = objToXml(obj);

		// Note: objToXml doesn't escape, it just converts to string
		expect(result).toContain("Hello & World <test>");
	});
});

describe("xmlToObj", () => {
	it("should parse simple XML to object", () => {
		const xml = "<name>John</name><age>30</age>";
		const result = xmlToObj(xml);

		expect(result).toEqual({
			name: "John",
			age: "30",
		});
	});

	it("should handle nested XML tags", () => {
		const xml = "<user><name>John</name><age>30</age></user>";
		const result = xmlToObj(xml);

		expect(result).toEqual({
			user: {
				name: "John",
				age: "30",
			},
		});
	});

	it("should handle multiple nested levels", () => {
		const xml = "<level1><level2><level3>deep</level3></level2></level1>";
		const result = xmlToObj(xml);

		expect(result).toEqual({
			level1: {
				level2: {
					level3: "deep",
				},
			},
		});
	});

	it("should handle multiple siblings", () => {
		const xml = "<a>1</a><b>2</b><c>3</c>";
		const result = xmlToObj(xml);

		expect(result).toEqual({
			a: "1",
			b: "2",
			c: "3",
		});
	});

	it("should trim whitespace in content", () => {
		const xml = "<name>  John Doe  </name>";
		const result = xmlToObj(xml);

		expect(result).toEqual({
			name: "John Doe",
		});
	});

	it("should handle empty tags", () => {
		const xml = "<empty></empty><filled>content</filled>";
		const result = xmlToObj(xml);

		expect(result).toEqual({
			empty: "",
			filled: "content",
		});
	});

	it("should handle invalid XML gracefully", () => {
		const xml = "not valid xml at all";
		const result = xmlToObj(xml);

		// Should return empty object on error
		expect(result).toEqual({});
	});

	it("should handle malformed XML", () => {
		const xml = "<unclosed><tag>content</tag>";
		const result = xmlToObj(xml);

		// Should handle gracefully, might return partial or empty
		expect(typeof result).toBe("object");
	});

	it("should normalize whitespace", () => {
		const xml = "<a>   test   </a>   <b>   another   </b>";
		const result = xmlToObj(xml);

		expect(result.a).toBe("test");
		expect(result.b).toBe("another");
	});

	it("should handle complex nested structure", () => {
		const xml =
			"<root><child1><grandchild>value1</grandchild></child1><child2>value2</child2></root>";
		const result = xmlToObj(xml);

		expect(result).toEqual({
			root: {
				child1: {
					grandchild: "value1",
				},
				child2: "value2",
			},
		});
	});
});

describe("Round-trip tests", () => {
	it("should convert object to XML and back", () => {
		const original = {
			name: "John",
			age: "30",
			address: {
				city: "NYC",
				zip: "10001",
			},
		};

		const xml = objToXml(original);
		const result = xmlToObj(xml);

		// Note: Numbers become strings in XML, so we need to adjust expectations
		expect(result.name).toBe("John");
		expect(result.age).toBe("30");
		expect(result.address).toEqual({
			city: "NYC",
			zip: "10001",
		});
	});

	it("should handle simple round-trip", () => {
		const original = { test: "value" };
		const xml = objToXml(original);
		const result = xmlToObj(xml);

		expect(result).toEqual(original);
	});
});
