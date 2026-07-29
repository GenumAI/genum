import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({ env: { MAIL_SERVICE_APIKEY: undefined, FRONTEND_URL: "https://lab.genum.ai" } }));

import { env } from "@/env";
import { checkMailServiceKey } from "./MailServiceRouter";

function makeRes() {
	const res = { statusCode: 0, body: undefined as unknown };
	return {
		status(code: number) {
			res.statusCode = code;
			return this;
		},
		json(payload: unknown) {
			res.body = payload;
			return this;
		},
		captured: res,
	} as unknown as Response & { captured: { statusCode: number; body: unknown } };
}

describe("checkMailServiceKey", () => {
	beforeEach(() => {
		(env as { MAIL_SERVICE_APIKEY?: string }).MAIL_SERVICE_APIKEY = undefined;
	});

	it("rejects when the env key is unset (router disabled)", () => {
		const res = makeRes();
		const next = vi.fn();
		checkMailServiceKey(
			{ headers: { authorization: "Bearer anything" } } as unknown as Request,
			res,
			next,
		);
		expect(res.captured.statusCode).toBe(401);
		expect(next).not.toHaveBeenCalled();
	});

	it("rejects a wrong bearer", () => {
		(env as { MAIL_SERVICE_APIKEY?: string }).MAIL_SERVICE_APIKEY = "secret";
		const res = makeRes();
		const next = vi.fn();
		checkMailServiceKey(
			{ headers: { authorization: "Bearer nope" } } as unknown as Request,
			res,
			next,
		);
		expect(res.captured.statusCode).toBe(401);
		expect(next).not.toHaveBeenCalled();
	});

	it("passes a matching bearer through", () => {
		(env as { MAIL_SERVICE_APIKEY?: string }).MAIL_SERVICE_APIKEY = "secret";
		const res = makeRes();
		const next = vi.fn();
		checkMailServiceKey(
			{ headers: { authorization: "Bearer secret" } } as unknown as Request,
			res,
			next,
		);
		expect(next).toHaveBeenCalled();
	});
});
