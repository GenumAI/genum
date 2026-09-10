import { describe, expect, it } from "vitest";

import { assignTurnIndices } from "./turnIndex";

describe("assignTurnIndices", () => {
	it("numbers a batch's traces by earliest timestamp, ascending", () => {
		const indices = assignTurnIndices(
			[
				{ traceId: "later", earliestTimestamp: "1757500900000000000" },
				{ traceId: "earlier", earliestTimestamp: "1757500001000000000" },
			],
			[],
		);

		expect([...indices]).toEqual([
			["earlier", 0],
			["later", 1],
		]);
	});

	it("breaks a tie on trace id, so a redelivery numbers the batch identically", () => {
		// Not incidental. `turn_index` is written into an append-only table and can never
		// be renumbered, so two deliveries that disagreed would leave one turn recorded
		// twice under two different ordinals.
		const same = "1757500001000000000";
		const forwards = assignTurnIndices(
			[
				{ traceId: "bbb", earliestTimestamp: same },
				{ traceId: "aaa", earliestTimestamp: same },
			],
			[],
		);
		const backwards = assignTurnIndices(
			[
				{ traceId: "aaa", earliestTimestamp: same },
				{ traceId: "bbb", earliestTimestamp: same },
			],
			[],
		);

		expect(forwards.get("aaa")).toBe(0);
		expect(forwards.get("bbb")).toBe(1);
		expect([...forwards]).toEqual([...backwards]);
	});

	it("starts after the turns already stored for the session", () => {
		const indices = assignTurnIndices(
			[{ traceId: "new", earliestTimestamp: "1757500900000000000" }],
			["turn0", "turn1"],
		);

		expect(indices.get("new")).toBe(2);
	});

	it("gives a trace already stored the place it already has", () => {
		// A collector's retry re-delivers a trace we have. Numbering it afresh would store
		// the same turn a second time under a new ordinal -- the duplicate dedup cannot
		// collapse, because a different `turn_index` is a genuinely different row.
		const indices = assignTurnIndices(
			[
				{ traceId: "turn1", earliestTimestamp: "1757500900000000000" },
				{ traceId: "fresh", earliestTimestamp: "1757501900000000000" },
			],
			["turn0", "turn1"],
		);

		expect(indices.get("turn1")).toBe(1);
		expect(indices.get("fresh")).toBe(2);
	});

	it("assigns nothing new when every trace in the batch is already stored", () => {
		const indices = assignTurnIndices(
			[{ traceId: "turn0", earliestTimestamp: "1757500001000000000" }],
			["turn0"],
		);

		expect(indices.get("turn0")).toBe(0);
		expect(indices.size).toBe(1);
	});

	it("gives a single trace with no session at all index 0", () => {
		const indices = assignTurnIndices([{ traceId: "solo", earliestTimestamp: "" }], []);

		expect(indices.get("solo")).toBe(0);
	});

	it("compares nanosecond instants as integers, not as numbers", () => {
		// 1.75e18 is past Number.MAX_SAFE_INTEGER: through Number(), two turns a
		// millisecond apart round to the same instant and the tie-break decides the
		// conversation's order instead of time.
		const indices = assignTurnIndices(
			[
				{ traceId: "aaa-second", earliestTimestamp: "1757500000001000000" },
				{ traceId: "zzz-first", earliestTimestamp: "1757500000000000000" },
			],
			[],
		);

		expect(indices.get("zzz-first")).toBe(0);
		expect(indices.get("aaa-second")).toBe(1);
	});
});
