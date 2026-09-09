import { describe, expect, it } from "vitest";

import { canAddMessage, liveThread, testcaseThread } from "./thread";
import type { Step } from "@/types/steps";

const TWO_TURNS: Step[] = [
	{ kind: "final", text: "expected one" },
	{ kind: "user", text: "and then?" },
	{ kind: "final", text: "expected two" },
];

describe("testcaseThread", () => {
	it("pairs each turn's produced answer with THAT turn's expected answer", () => {
		// The discriminating case for D4. The actual run below has an extra tool call in
		// turn 1, so flat indices no longer line up with the expectation's: pairing by
		// flat index reads turn 1's tool call and turn 2's user reply as the answers,
		// and only turn-ordinal pairing -- what `compareSteps` itself does -- gets it
		// right.
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [
				{ kind: "tool_call", name: "lookup", args: {} },
				{ kind: "final", text: "produced one" },
				{ kind: "user", text: "and then?" },
				{ kind: "final", text: "produced two" },
			],
			mismatches: new Map(),
			comparisonRecorded: true,
		});

		const finals = messages.filter((message) => message.step.kind === "final");
		expect(finals.map((message) => message.produced)).toEqual(["produced one", "produced two"]);
	});

	it("carries no metrics at all, never zeros", () => {
		// D5. A recorded trajectory's spans store zeros as placeholders keeping the
		// OTel-shaped schema intact. Rendering them would state that the turn cost
		// nothing and took no time.
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: false,
		});
		expect(messages.every((message) => message.metrics === undefined)).toBe(true);
	});

	it("reports no outcome when no comparison was recorded", () => {
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: false,
		});
		expect(messages.every((message) => message.outcome === undefined)).toBe(true);
	});

	it("marks steps after an unticked reply as not-reached, and the reply itself live", () => {
		const cut: Step[] = [
			{ kind: "final", text: "one" },
			{ kind: "user", text: "stop here", enabled: false },
			{ kind: "final", text: "two" },
		];
		const messages = testcaseThread({
			expectedSteps: cut,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: true,
		});
		// The unticked reply is the live control that made the cut -- it must not read as
		// dead, or there is no way to undo the cut from the thread.
		expect(messages[1].outcome).toBeUndefined();
		expect(messages[2].outcome).toBe("not-reached");
	});

	it("never reports an outcome for a user reply", () => {
		// `compareSteps` filters replies out of both sides, so no comparison outcome can
		// exist for one; without this it fell through to a green "matched".
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: TWO_TURNS,
			mismatches: new Map(),
			comparisonRecorded: true,
		});
		expect(messages[1].step.kind).toBe("user");
		expect(messages[1].outcome).toBeUndefined();
	});

	it("marks an unticked step not-asserted rather than matched", () => {
		const messages = testcaseThread({
			expectedSteps: [{ kind: "final", text: "one", enabled: false }],
			lastSteps: [{ kind: "final", text: "one" }],
			mismatches: new Map(),
			comparisonRecorded: true,
		});
		expect(messages[0].outcome).toBe("not-asserted");
	});

	it("addresses every message by its FLAT index, which mismatches are keyed by", () => {
		const messages = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: TWO_TURNS,
			mismatches: new Map([[2, "text differs"]]),
			comparisonRecorded: true,
		});
		expect(messages.map((message) => message.index)).toEqual([0, 1, 2]);
		expect(messages[2].outcome).toBe("mismatched");
		expect(messages[2].outcomeReason).toBe("text differs");
	});
});

describe("liveThread", () => {
	it("puts the run's metrics on the answer it measured", () => {
		// D5's other half: in the playground each turn HAS a response, so its metrics are
		// real and belong on that message.
		const messages = liveThread({
			steps: [{ kind: "final", text: "hi" }],
			metricsByTurn: [{ tokens: 98, cost: 0, responseTimeMs: 3218 }],
		});
		expect(messages[0].metrics).toEqual({ tokens: 98, cost: 0, responseTimeMs: 3218 });
	});

	it("produces the same message shape as a testcase thread", () => {
		// The two adapters exist so the thread component sees one shape. A field one
		// adapter sets and the other silently omits is how the two surfaces drift apart
		// again -- which is the whole defect this work removes.
		const live = liveThread({ steps: TWO_TURNS, metricsByTurn: [] });
		const saved = testcaseThread({
			expectedSteps: TWO_TURNS,
			lastSteps: [],
			mismatches: new Map(),
			comparisonRecorded: false,
		});
		expect(live.map((m) => m.index)).toEqual(saved.map((m) => m.index));
		expect(live.map((m) => m.step.kind)).toEqual(saved.map((m) => m.step.kind));
	});

	it("reports no outcome for a live run: nothing has been compared", () => {
		const messages = liveThread({ steps: TWO_TURNS, metricsByTurn: [] });
		expect(messages.every((message) => message.outcome === undefined)).toBe(true);
	});
});

describe("canAddMessage", () => {
	it("allows a follow-up once the model has answered", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "final", text: "done" }],
				pendingTool: null,
				isRunning: false,
			}),
		).toBe(true);
	});

	it("refuses while a tool is waiting for its result", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "final", text: "done" }],
				pendingTool: "get_weather",
				isRunning: false,
			}),
		).toBe(false);
	});

	it("refuses while a turn is in flight", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "final", text: "done" }],
				pendingTool: null,
				isRunning: true,
			}),
		).toBe(false);
	});

	it("refuses when the last step is not an answer", () => {
		expect(
			canAddMessage({
				steps: [{ kind: "tool_call", name: "t", args: {} }],
				pendingTool: null,
				isRunning: false,
			}),
		).toBe(false);
	});

	it("refuses on an empty thread", () => {
		expect(canAddMessage({ steps: [], pendingTool: null, isRunning: false })).toBe(false);
	});
});
