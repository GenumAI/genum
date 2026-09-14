import { describe, expect, it } from "vitest";

import {
	ANSWER_MAX_HEIGHT,
	ANSWER_MIN_HEIGHT,
	answerLanguage,
	clampAnswerHeight,
} from "@/lib/answerView";

describe("answerLanguage", () => {
	it("highlights an object as json", () => {
		expect(answerLanguage('{"city":"Paris","country":"France"}')).toBe("json");
	});

	it("highlights an array as json", () => {
		expect(answerLanguage("[1, 2, 3]")).toBe("json");
	});

	it("leaves prose as plaintext", () => {
		expect(answerLanguage("Paris is the capital of France.")).toBe("plaintext");
	});

	it("leaves a bare JSON scalar as plaintext", () => {
		// Each of these parses as valid JSON. Colouring a one-word answer as a JSON
		// literal claims a structure the answer does not have.
		expect(answerLanguage("42")).toBe("plaintext");
		expect(answerLanguage('"Paris"')).toBe("plaintext");
		expect(answerLanguage("true")).toBe("plaintext");
	});

	it("leaves null as plaintext", () => {
		// `typeof null === "object"`, so this is the case a naive check gets wrong.
		expect(answerLanguage("null")).toBe("plaintext");
	});

	it("leaves an empty answer as plaintext", () => {
		expect(answerLanguage("")).toBe("plaintext");
	});
});

describe("clampAnswerHeight", () => {
	it("keeps a height that already fits", () => {
		expect(clampAnswerHeight(120)).toBe(120);
	});

	it("raises a short answer to the floor", () => {
		expect(clampAnswerHeight(18)).toBe(ANSWER_MIN_HEIGHT);
	});

	it("caps a long answer at the ceiling", () => {
		expect(clampAnswerHeight(5000)).toBe(ANSWER_MAX_HEIGHT);
	});

	it("treats an unmeasured editor as the floor", () => {
		expect(clampAnswerHeight(0)).toBe(ANSWER_MIN_HEIGHT);
		expect(clampAnswerHeight(Number.NaN)).toBe(ANSWER_MIN_HEIGHT);
	});
});
