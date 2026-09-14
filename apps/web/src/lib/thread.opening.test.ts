import { describe, expect, it } from "vitest";

import { type ThreadMessage, withOpening } from "./thread";

const answer: ThreadMessage = { step: { kind: "final", text: "Hi!" }, index: 0 };
const reply: ThreadMessage = { step: { kind: "user", text: "and then?" }, index: 1 };

describe("withOpening", () => {
	it("puts the opening question first, as a message that is not a step", () => {
		expect(withOpening([answer, reply], "hello")).toEqual([
			{ step: { kind: "user", text: "hello" }, index: -1, opening: true },
			answer,
			reply,
		]);
	});

	it("keeps the flat indices of the steps it precedes", () => {
		// Every save, mismatch and toggle addresses a step by its flat index.
		const [, ...steps] = withOpening([answer, reply], "hello");
		expect(steps.map((message) => message.index)).toEqual([0, 1]);
	});

	it("adds nothing when there is no question to show", () => {
		expect(withOpening([answer], undefined)).toEqual([answer]);
		expect(withOpening([answer], "  ")).toEqual([answer]);
	});

	it("adds nothing to a thread that already opens with a message of its own", () => {
		expect(withOpening([reply, answer], "hello")).toEqual([reply, answer]);
	});

	it("adds nothing to an empty thread", () => {
		// No conversation has started; an empty frame with a question in it would say one had.
		expect(withOpening([], "hello")).toEqual([]);
	});
});
