import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({ env: { INSTANCE_TYPE: "cloud" } }));

import {
	STEP_UP_CLAIM,
	STEP_UP_CLOCK_SKEW_SECONDS,
	STEP_UP_MAX_AGE_SECONDS,
	evaluateStepUp,
	requireRecentAuthentication,
} from "./step-up";

const NOW = 1_800_000_000; // seconds since epoch

describe("evaluateStepUp", () => {
	it("accepts an authentication that just happened", () => {
		expect(evaluateStepUp(NOW, NOW)).toEqual({ fresh: true });
	});

	it("accepts one inside the window", () => {
		expect(evaluateStepUp(NOW - STEP_UP_MAX_AGE_SECONDS + 1, NOW)).toEqual({ fresh: true });
	});

	it("refuses one past the window and the skew", () => {
		const authTime = NOW - STEP_UP_MAX_AGE_SECONDS - STEP_UP_CLOCK_SKEW_SECONDS - 1;

		expect(evaluateStepUp(authTime, NOW)).toMatchObject({ fresh: false, reason: "stale" });
	});

	it("tolerates a clock that is behind, up to the skew", () => {
		// The identity provider's clock and ours are not the same clock. A
		// timestamp a little older than the window is a skew, not a stale login.
		const authTime = NOW - STEP_UP_MAX_AGE_SECONDS - STEP_UP_CLOCK_SKEW_SECONDS + 1;

		expect(evaluateStepUp(authTime, NOW)).toEqual({ fresh: true });
	});

	it("tolerates a clock that is ahead, up to the skew", () => {
		expect(evaluateStepUp(NOW + STEP_UP_CLOCK_SKEW_SECONDS - 1, NOW)).toEqual({ fresh: true });
	});

	it("refuses a timestamp implausibly in the future", () => {
		// A login cannot have happened later than now. That is a wrong clock, and
		// treating it as extra-fresh would make a skewed issuer a permanent pass.
		const authTime = NOW + STEP_UP_CLOCK_SKEW_SECONDS + 1;

		expect(evaluateStepUp(authTime, NOW)).toMatchObject({ fresh: false, reason: "implausible" });
	});

	it.each([
		["missing", undefined],
		["null", null],
		["a string", "1800000000"],
		["not a number", "recently"],
		["NaN", Number.NaN],
		["infinite", Number.POSITIVE_INFINITY],
	])("refuses a claim that is %s", (_label, value) => {
		// Absent means the token came from a flow that never asked. Defaulting to
		// a pass would mean an identity provider that quietly stopped emitting the
		// claim turns every step-up into a pass, silently.
		expect(evaluateStepUp(value, NOW)).toMatchObject({ fresh: false, reason: "absent" });
	});
});

function makeRes() {
	const captured: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
	const res = {
		status(code: number) {
			captured.statusCode = code;
			return this;
		},
		json(payload: unknown) {
			captured.body = payload;
			return this;
		},
	};
	return { res: res as unknown as Response, captured };
}

function makeReq(payload: Record<string, unknown> | undefined): Request {
	return (payload ? { auth: { payload } } : {}) as unknown as Request;
}

describe("requireRecentAuthentication", () => {
	it("passes a fresh token through", () => {
		const next = vi.fn();
		const { res } = makeRes();

		requireRecentAuthentication(
			makeReq({ [STEP_UP_CLAIM]: Math.floor(Date.now() / 1000) }),
			res,
			next,
		);

		expect(next).toHaveBeenCalledTimes(1);
	});

	it("refuses a token carrying no claim, and does not call next", () => {
		const next = vi.fn();
		const { res, captured } = makeRes();

		requireRecentAuthentication(makeReq({ sub: "auth0|aaa" }), res, next);

		expect(next).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toMatchObject({ error: "step_up_required" });
	});

	it("refuses when there is no verified token at all", () => {
		const next = vi.fn();
		const { res, captured } = makeRes();

		requireRecentAuthentication(makeReq(undefined), res, next);

		expect(next).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(401);
	});

	it("refuses a stale authentication", () => {
		const next = vi.fn();
		const { res, captured } = makeRes();
		const longAgo = Math.floor(Date.now() / 1000) - STEP_UP_MAX_AGE_SECONDS - 3600;

		requireRecentAuthentication(makeReq({ [STEP_UP_CLAIM]: longAgo }), res, next);

		expect(next).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toMatchObject({ error: "step_up_required" });
	});
});
