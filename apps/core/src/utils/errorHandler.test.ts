import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";

vi.mock("@/env", () => ({ env: { NODE_ENV: "production" } }));

vi.mock("@/services/sentry/init", () => ({
	captureSentryException: vi.fn(),
	captureSentryMessage: vi.fn(),
}));

import { captureSentryException } from "@/services/sentry/init";
import { HttpError } from "./errors";
import { errorHandler } from "./errorHandler";

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

function handle(err: unknown) {
	const { res, captured } = makeRes();
	errorHandler(err, {} as Request, res, (() => {}) as NextFunction);
	return captured;
}

describe("errorHandler", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "error").mockImplementation(() => {});
	});

	it("uses the status code carried by an HttpError", () => {
		expect(handle(new HttpError(404, "Prompt is not found"))).toMatchObject({
			statusCode: 404,
			body: { statusCode: 404, message: "Prompt is not found" },
		});
	});

	it("does not report client errors to Sentry", () => {
		// A probe for someone else's prompt id is not a server fault; reporting it
		// buries real incidents in noise.
		handle(new HttpError(404, "Prompt is not found"));
		handle(new HttpError(401, "Invalid API key"));

		expect(captureSentryException).not.toHaveBeenCalled();
	});

	it("still reports server errors to Sentry", () => {
		handle(new Error("database is on fire"));

		expect(captureSentryException).toHaveBeenCalledTimes(1);
	});

	it("falls back to 500 for an error with no status code", () => {
		expect(handle(new Error("boom"))).toMatchObject({ statusCode: 500 });
	});

	it("maps a ZodError to 400 and hides the details in production", () => {
		const err = new ZodError(z.object({ a: z.string() }).safeParse({}).error!.issues);

		const captured = handle(err);

		expect(captured.statusCode).toBe(400);
		expect(captured.body).not.toHaveProperty("errors");
	});
});
