import { describe, expect, it } from "vitest";

import { sessionSelections } from "./sessionSelections";
import type { SpanRow } from "@/types/spans";

function row(overrides: Partial<SpanRow>): SpanRow {
	return {
		trace_id: "turn-0",
		span_id: "span-1",
		parent_span_id: null,
		span_index: 0,
		span_type: "chat",
		orgId: 1,
		project_id: 2,
		prompt_id: 3,
		name: "gpt-4o",
		input: "",
		output: "",
		tool_args: "",
		tool_result: "",
		tool_error: null,
		vendor: "openai",
		model: "gpt-4o",
		tokens_in: 0,
		tokens_out: 0,
		cost: 0,
		duration_ms: 0,
		status: "OK",
		...overrides,
	};
}

describe("sessionSelections", () => {
	it("takes what turn 0 was run with", () => {
		const selections = sessionSelections([
			row({
				trace_id: "turn-0",
				placeholders: { admin_role: "true" },
				tools_offered: ["search_mail"],
				prompt_version: "c0ffee1",
			}),
			row({ trace_id: "turn-1", placeholders: { admin_role: "true" } }),
		]);

		expect(selections).toEqual({
			placeholders: { admin_role: "true" },
			offeredTools: ["search_mail"],
			promptVersion: "c0ffee1",
			drifted: false,
		});
	});

	it("reads the turn's attributes off whichever of its rows carries them", () => {
		// A turn's first row can be a tool span, which carries no selection at all.
		const selections = sessionSelections([
			row({ trace_id: "turn-0", span_type: "execute_tool", span_index: 0 }),
			row({
				trace_id: "turn-0",
				span_index: 1,
				placeholders: { tone: "formal" },
				tools_offered: ["search_mail"],
			}),
		]);

		expect(selections.placeholders).toEqual({ tone: "formal" });
		expect(selections.offeredTools).toEqual(["search_mail"]);
	});

	it("keeps turn 0 and reports drift when a later turn disagrees", () => {
		// Merging would invent a combination no turn ever ran, and taking the last turn
		// would re-key the testcase on whichever turn happened to be delivered last.
		const selection = sessionSelections([
			row({ trace_id: "turn-0", placeholders: { admin_role: "true" } }),
			row({ trace_id: "turn-1", placeholders: { admin_role: "false" } }),
		]);
		expect(selection.placeholders).toEqual({ admin_role: "true" });
		expect(selection.drifted).toBe(true);

		const tools = sessionSelections([
			row({ trace_id: "turn-0", tools_offered: ["search_mail"] }),
			row({ trace_id: "turn-1", tools_offered: ["search_mail", "send_mail"] }),
		]);
		expect(tools.offeredTools).toEqual(["search_mail"]);
		expect(tools.drifted).toBe(true);
	});

	it("does not call a reordered tool list drift", () => {
		// Order is the sender's, not a meaning: the same set is the same subset.
		const selections = sessionSelections([
			row({ trace_id: "turn-0", tools_offered: ["search_mail", "send_mail"] }),
			row({ trace_id: "turn-1", tools_offered: ["send_mail", "search_mail"] }),
		]);

		expect(selections.drifted).toBe(false);
	});

	it("reads a session that recorded nothing as recording nothing", () => {
		// Not as "no tools were offered". Every row written before these columns existed
		// reads back empty, and reading that as an empty subset would stop each of those
		// replays at its first tool call.
		const selections = sessionSelections([row({}), row({ trace_id: "turn-1" })]);

		expect(selections).toEqual({
			placeholders: {},
			offeredTools: null,
			promptVersion: "",
			drifted: false,
		});
	});

	it("takes turn 0's answer even when an earlier turn recorded nothing", () => {
		// A turn that says nothing is not a turn that disagrees.
		const selections = sessionSelections([
			row({ trace_id: "turn-0" }),
			row({ trace_id: "turn-1", tools_offered: ["send_mail"] }),
		]);

		expect(selections.offeredTools).toEqual(["send_mail"]);
		expect(selections.drifted).toBe(false);
	});
});
