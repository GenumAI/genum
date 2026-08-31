import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

const mockEnv = vi.hoisted(() => ({ INSTANCE_TYPE: "cloud" as "cloud" | "local" }));
vi.mock("@/env", () => ({ env: mockEnv }));
vi.mock("@/utils/env", () => ({ isLocalInstance: () => mockEnv.INSTANCE_TYPE === "local" }));

vi.mock("@/database/db", () => ({
	db: { users: { getUserCredential: vi.fn() } },
}));

const verifyPassword = vi.hoisted(() => vi.fn());
vi.mock("@/auth/local/password", () => ({ verifyPassword }));

import { db } from "@/database/db";
import { STEP_UP_CLAIM } from "./step-up";
import { requireReauthentication } from "./reauthenticate";

const USER_ID = 42;

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

function makeReq(over: { payload?: Record<string, unknown>; body?: unknown } = {}): Request {
	return {
		auth: over.payload ? { payload: over.payload } : undefined,
		body: over.body ?? {},
		genumMeta: { ids: { userID: USER_ID, orgID: -1, projID: -1 } },
	} as unknown as Request;
}

const fresh = () => ({ [STEP_UP_CLAIM]: Math.floor(Date.now() / 1000) });

describe("requireReauthentication on a cloud instance", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.INSTANCE_TYPE = "cloud";
	});

	it("accepts a freshly authenticated token", async () => {
		const next = vi.fn();
		const { res } = makeRes();

		await requireReauthentication(makeReq({ payload: fresh() }), res, next);

		expect(next).toHaveBeenCalledTimes(1);
	});

	it("REFUSES a password, even a correct one, and never consults the credential", async () => {
		// The dispatch is exclusive, never a fallback. If a password were accepted
		// here, anyone in cloud mode could skip the step-up entirely by supplying
		// one, turning the strongest check in this feature into the weakest.
		// Auth0 owns credentials in cloud mode; UserCredential has no business
		// being read at all.
		vi.mocked(verifyPassword).mockResolvedValue(true as never);
		const next = vi.fn();
		const { res, captured } = makeRes();

		await requireReauthentication(
			makeReq({ payload: { sub: "auth0|aaa" }, body: { password: "correct horse" } }),
			res,
			next,
		);

		expect(next).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(401);
		expect(captured.body).toMatchObject({ error: "step_up_required" });
		expect(db.users.getUserCredential).not.toHaveBeenCalled();
		expect(verifyPassword).not.toHaveBeenCalled();
	});

	it("refuses a stale authentication", async () => {
		const next = vi.fn();
		const { res, captured } = makeRes();
		const stale = { [STEP_UP_CLAIM]: Math.floor(Date.now() / 1000) - 86_400 };

		await requireReauthentication(makeReq({ payload: stale }), res, next);

		expect(next).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(401);
	});
});

describe("requireReauthentication on a local instance", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.INSTANCE_TYPE = "local";
		vi.mocked(db.users.getUserCredential).mockResolvedValue({
			userId: USER_ID,
			passwordHash: "$2b$10$hash",
		} as never);
	});

	it("accepts the caller's own password", async () => {
		vi.mocked(verifyPassword).mockResolvedValue(true as never);
		const next = vi.fn();
		const { res } = makeRes();

		await requireReauthentication(makeReq({ body: { password: "s3cret" } }), res, next);

		expect(db.users.getUserCredential).toHaveBeenCalledWith(USER_ID);
		expect(next).toHaveBeenCalledTimes(1);
	});

	it("ignores a missing auth_time claim entirely", async () => {
		// There is no identity provider here and no such token, so the cloud
		// guard's refusal must not leak into this branch.
		vi.mocked(verifyPassword).mockResolvedValue(true as never);
		const next = vi.fn();
		const { res } = makeRes();

		await requireReauthentication(makeReq({ body: { password: "s3cret" } }), res, next);

		expect(next).toHaveBeenCalledTimes(1);
	});

	it("refuses a wrong password", async () => {
		vi.mocked(verifyPassword).mockResolvedValue(false as never);
		const next = vi.fn();
		const { res, captured } = makeRes();

		await requireReauthentication(makeReq({ body: { password: "wrong" } }), res, next);

		expect(next).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(401);
	});

	it("does not distinguish a wrong password from no credential at all", async () => {
		// This endpoint destroys the account, so the response must not tell an
		// attacker which half they got right.
		vi.mocked(verifyPassword).mockResolvedValue(false as never);
		const wrong = makeRes();
		await requireReauthentication(makeReq({ body: { password: "wrong" } }), wrong.res, vi.fn());

		vi.mocked(db.users.getUserCredential).mockResolvedValue(null as never);
		const absent = makeRes();
		await requireReauthentication(makeReq({ body: { password: "wrong" } }), absent.res, vi.fn());

		expect(absent.captured.statusCode).toBe(wrong.captured.statusCode);
		expect(absent.captured.body).toEqual(wrong.captured.body);
	});

	it("refuses a missing or non-string password without reaching bcrypt", async () => {
		for (const body of [{}, { password: 123 }, { password: "" }]) {
			const next = vi.fn();
			const { res, captured } = makeRes();

			await requireReauthentication(makeReq({ body }), res, next);

			expect(next).not.toHaveBeenCalled();
			expect(captured.statusCode).toBe(401);
		}
		expect(verifyPassword).not.toHaveBeenCalled();
	});

	it("never echoes the password back in the response", async () => {
		vi.mocked(verifyPassword).mockResolvedValue(false as never);
		const { res, captured } = makeRes();

		await requireReauthentication(makeReq({ body: { password: "s3cret-value" } }), res, vi.fn());

		expect(JSON.stringify(captured.body)).not.toContain("s3cret-value");
	});
});
