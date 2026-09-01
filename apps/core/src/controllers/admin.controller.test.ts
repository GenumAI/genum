import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { NODE_ENV: "test", INSTANCE_TYPE: "cloud" },
}));

vi.mock("@/database/db", () => ({
	db: {
		users: {
			getUserByEmail: vi.fn(),
			createUser: vi.fn(),
		},
		organization: {
			createPersonalOrganization: vi.fn(),
		},
	},
}));

vi.mock("@/services/logger", () => ({ countRunsByDate: vi.fn() }));

vi.mock("@/services/webhooks/webhooks", () => ({
	webhooks: { postRegister: vi.fn() },
}));

import { db } from "@/database/db";
import { webhooks } from "@/services/webhooks/webhooks";
import { AdminController } from "./admin.controller";

const EMAIL = "a.person@example.com";

function makeReq(over: Record<string, unknown> = {}): Request {
	return {
		body: {
			user: {
				email: EMAIL,
				name: "A Person",
				authID: "auth0|aaa",
				created_at: "2026-08-31T00:00:00.000Z",
				...over,
			},
		},
	} as unknown as Request;
}

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

describe("AdminController.createNewUser", () => {
	let controller: AdminController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new AdminController();
		vi.mocked(db.users.createUser).mockResolvedValue({ id: 7, email: EMAIL } as never);
		vi.mocked(db.organization.createPersonalOrganization).mockResolvedValue(undefined as never);
	});

	it("creates the account when no row holds that address", async () => {
		vi.mocked(db.users.getUserByEmail).mockResolvedValue(null as never);
		const { res, captured } = makeRes();

		await controller.createNewUser(makeReq(), res);

		expect(db.users.createUser).toHaveBeenCalledWith(EMAIL, "A Person", "auth0|aaa", undefined);
		expect(db.organization.createPersonalOrganization).toHaveBeenCalledTimes(1);
		expect(webhooks.postRegister).toHaveBeenCalledTimes(1);
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ id: 7 });
	});

	it("returns the existing id instead of hitting the unique constraint", async () => {
		// The bug this fixes: any divergence between the identity provider's
		// app_metadata and our User table used to reach an unconditional
		// createUser, break on User_email_key, answer 500, and hard-fail the
		// Post-Login Action — locking that person out with no way back.
		vi.mocked(db.users.getUserByEmail).mockResolvedValue({ id: 3, email: EMAIL } as never);
		const { res, captured } = makeRes();

		await controller.createNewUser(makeReq(), res);

		expect(db.users.createUser).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(200);
		expect(captured.body).toEqual({ id: 3 });
	});

	it("does not re-run the once-per-account side effects for an existing account", async () => {
		// Creating a second personal organization and re-firing the registration
		// webhook on every login attempt would be a worse bug than the 500.
		vi.mocked(db.users.getUserByEmail).mockResolvedValue({ id: 3, email: EMAIL } as never);
		const { res } = makeRes();

		await controller.createNewUser(makeReq(), res);

		expect(db.organization.createPersonalOrganization).not.toHaveBeenCalled();
		expect(webhooks.postRegister).not.toHaveBeenCalled();
	});

	it("gives a returning person a fresh account rather than resurrecting their tombstone", async () => {
		// A closed account's address is rewritten to erased-<id>@erased.invalid,
		// so the lookup by the real address finds nothing. This is the one case
		// where find-or-create could silently hand someone a closed account back,
		// with its memberships and history still attached.
		vi.mocked(db.users.getUserByEmail).mockResolvedValue(null as never);
		vi.mocked(db.users.createUser).mockResolvedValue({ id: 9, email: EMAIL } as never);
		const { res, captured } = makeRes();

		await controller.createNewUser(makeReq(), res);

		expect(db.users.getUserByEmail).toHaveBeenCalledWith(EMAIL);
		expect(db.users.createUser).toHaveBeenCalled();
		expect(captured.body).toEqual({ id: 9 });
		expect(db.organization.createPersonalOrganization).toHaveBeenCalledTimes(1);
	});
});
