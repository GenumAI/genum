import { describe, expect, it } from "vitest";

import type { FunctionCall, ModelConfigParameters } from "@/ai/models/types";
import { readOfferedTools, restrictTools } from "./tools";

function tool(name: string): FunctionCall {
	return { name, parameters: { type: "object", properties: {} } };
}

const PARAMETERS: ModelConfigParameters = {
	temperature: 0.2,
	tools: [tool("search_mail"), tool("send_mail"), tool("delete_mail")],
};

describe("restrictTools", () => {
	it("offers only the tools the recording says were on the table", () => {
		const restricted = restrictTools(PARAMETERS, ["search_mail"]);

		expect(restricted?.tools?.map((entry) => entry.name)).toEqual(["search_mail"]);
		// Everything else about the config is the prompt's and must survive untouched.
		expect(restricted?.temperature).toBe(0.2);
	});

	it("keeps the whole list when the session never recorded a subset", () => {
		// Null is "not recorded", which is every testcase pinned before this existed. They
		// must keep running the way they ran, not suddenly run with no tools.
		expect(restrictTools(PARAMETERS, null)?.tools).toHaveLength(3);
		expect(restrictTools(PARAMETERS, undefined)?.tools).toHaveLength(3);
	});

	it("honours a recorded empty subset by sending no tools at all", () => {
		// An empty array is an answer, not a missing one: the model was offered nothing.
		// The key is dropped rather than sent as `[]`, which some providers reject.
		const restricted = restrictTools(PARAMETERS, []);

		expect(restricted).not.toHaveProperty("tools");
		expect(restricted?.temperature).toBe(0.2);
	});

	it("ignores a recorded tool the prompt no longer defines", () => {
		// A renamed or deleted tool must not make every older testcase unrunnable.
		const restricted = restrictTools(PARAMETERS, ["search_mail", "archive_mail"]);

		expect(restricted?.tools?.map((entry) => entry.name)).toEqual(["search_mail"]);
	});

	it("leaves a prompt with no configuration alone", () => {
		expect(restrictTools(undefined, ["search_mail"])).toBeUndefined();
	});
});

describe("readOfferedTools", () => {
	it("reads a recorded subset, empty included", () => {
		expect(readOfferedTools(["a", "b"])).toEqual(["a", "b"]);
		expect(readOfferedTools([])).toEqual([]);
	});

	it("reads anything else as not recorded", () => {
		// The column is `Json?`, so this is the boundary. A lenient read that produced
		// `[]` from a malformed value would offer the model nothing and stop every replay
		// at its first tool call -- the loudest possible failure from the quietest cause.
		expect(readOfferedTools(null)).toBeNull();
		expect(readOfferedTools(undefined)).toBeNull();
		expect(readOfferedTools("search_mail")).toBeNull();
		expect(readOfferedTools({ tools: ["search_mail"] })).toBeNull();
		expect(readOfferedTools(["search_mail", 7])).toBeNull();
	});
});
