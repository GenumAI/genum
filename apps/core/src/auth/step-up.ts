import type { NextFunction, Request, Response } from "express";

/**
 * Step-up verification: proof that the caller authenticated JUST NOW, not merely
 * that they hold a valid token.
 *
 * Core is a stateless API. It validates an access token and has no browser
 * session and no OIDC redirect of its own, so it cannot perform a step-up — it
 * can only insist on evidence that one happened. The SPA drives the redirect
 * with `max_age: 0`; the identity provider's Post-Login Action puts the
 * resulting `auth_time` on the access token as a custom claim, and this guard
 * reads it off the already-verified payload.
 *
 * `auth_time` is not on an access token by default, which is exactly why the
 * absent case below is a refusal.
 */

/** Same namespace as the existing user-id claim. */
export const STEP_UP_CLAIM = "https://auth.genum.ai/auth_time";

/**
 * How recent the authentication must be. Long enough to read a confirmation
 * dialog and think about it, short enough that a token left open in a tab is not
 * a standing authorisation to destroy the account.
 */
export const STEP_UP_MAX_AGE_SECONDS = 5 * 60;

/**
 * Allowed in BOTH directions. The identity provider's clock is not ours, so a
 * timestamp slightly outside the window is a skew rather than a stale login —
 * and one implausibly in the FUTURE is a wrong clock, not a fresher login.
 * Accepting the future case would turn a skewed issuer into a permanent pass.
 */
export const STEP_UP_CLOCK_SKEW_SECONDS = 60;

export type StepUpVerdict =
	| { fresh: true }
	/**
	 * `absent` is deliberately not a pass. A missing claim means the token came
	 * from a flow that never asked for a fresh login; treating that as "fine"
	 * would mean an identity provider that quietly stopped emitting the claim
	 * silently turns every step-up into a pass.
	 */
	| { fresh: false; reason: "absent" | "stale" | "implausible"; detail: string };

/** Pure, so the window and the skew are testable without a clock or a request. */
export function evaluateStepUp(claim: unknown, nowSeconds: number): StepUpVerdict {
	if (typeof claim !== "number" || !Number.isFinite(claim)) {
		return {
			fresh: false,
			reason: "absent",
			detail: "This action needs a fresh sign-in, and the token carries no authentication time.",
		};
	}

	const age = nowSeconds - claim;

	if (age > STEP_UP_MAX_AGE_SECONDS + STEP_UP_CLOCK_SKEW_SECONDS) {
		return {
			fresh: false,
			reason: "stale",
			detail: "This action needs a fresh sign-in. Sign in again and retry.",
		};
	}

	if (age < -STEP_UP_CLOCK_SKEW_SECONDS) {
		return {
			fresh: false,
			reason: "implausible",
			detail: "The token reports an authentication time in the future; check the server clock.",
		};
	}

	return { fresh: true };
}

/**
 * Guard for actions that must not run on a token the caller merely still holds.
 * Answers 401 with a machine-readable `step_up_required` so the SPA can start a
 * `max_age: 0` redirect rather than showing a generic failure.
 */
export function requireRecentAuthentication(req: Request, res: Response, next: NextFunction): void {
	const verdict = evaluateStepUp(
		req.auth?.payload?.[STEP_UP_CLAIM],
		Math.floor(Date.now() / 1000),
	);

	if (!verdict.fresh) {
		res.status(401).json({
			error: "step_up_required",
			reason: verdict.reason,
			detail: verdict.detail,
		});
		return;
	}

	next();
}
