import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		organization: {
			getInvitationByToken: vi.fn(),
			deleteInvitation: vi.fn(),
		},
	},
}));

import { db } from "@/database/db";
import { UserController } from "./user.controller";

const INVITED_EMAIL = "invited@example.com";
const OTHER_EMAIL = "stranger@example.com";

function makeReq(email: string, userID = 42): Request {
	return {
		params: { token: "invite-token" },
		genumMeta: {
			ids: { userID, orgID: 1, projID: 1 },
			user: { id: userID, email },
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

function invitation(overrides: Record<string, unknown> = {}) {
	return {
		email: INVITED_EMAIL,
		organizationId: 7,
		role: "OWNER",
		expiresAt: new Date(Date.now() + 86_400_000), // tomorrow
		...overrides,
	};
}

describe("UserController.acceptInvitation", () => {
	let controller: UserController;
	let addOrganizationMember: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new UserController();
		addOrganizationMember = vi.fn().mockResolvedValue({ id: 1 });
		// The controller builds its own service; swap in a spy so we can assert the
		// membership grant never happens on a rejected invite.
		(
			controller as unknown as {
				organizationService: { addOrganizationMember: unknown };
			}
		).organizationService = { addOrganizationMember };
	});

	it("accepts a fresh invitation addressed to the caller", async () => {
		vi.mocked(db.organization.getInvitationByToken).mockResolvedValue(invitation() as never);
		const { res, captured } = makeRes();

		await controller.acceptInvitation(makeReq(INVITED_EMAIL), res);

		expect(captured.statusCode).toBe(200);
		expect(addOrganizationMember).toHaveBeenCalledWith(7, 42, "OWNER");
	});

	it("rejects an invitation addressed to somebody else, even while it is still valid", async () => {
		// The bug: `email mismatch && expired` accepted a forwarded invite outright.
		vi.mocked(db.organization.getInvitationByToken).mockResolvedValue(invitation() as never);
		const { res, captured } = makeRes();

		await controller.acceptInvitation(makeReq(OTHER_EMAIL), res);

		expect(captured.statusCode).toBe(400);
		expect(addOrganizationMember).not.toHaveBeenCalled();
		expect(db.organization.deleteInvitation).not.toHaveBeenCalled();
	});

	it("rejects an expired invitation, even when the email matches", async () => {
		vi.mocked(db.organization.getInvitationByToken).mockResolvedValue(
			invitation({ expiresAt: new Date(Date.now() - 1000) }) as never,
		);
		const { res, captured } = makeRes();

		await controller.acceptInvitation(makeReq(INVITED_EMAIL), res);

		expect(captured.statusCode).toBe(400);
		expect(addOrganizationMember).not.toHaveBeenCalled();
	});

	it("rejects when the email mismatches and the invite is expired", async () => {
		vi.mocked(db.organization.getInvitationByToken).mockResolvedValue(
			invitation({ expiresAt: new Date(Date.now() - 1000) }) as never,
		);
		const { res, captured } = makeRes();

		await controller.acceptInvitation(makeReq(OTHER_EMAIL), res);

		expect(captured.statusCode).toBe(400);
		expect(addOrganizationMember).not.toHaveBeenCalled();
	});

	it("404s on an unknown token", async () => {
		vi.mocked(db.organization.getInvitationByToken).mockResolvedValue(null as never);
		const { res, captured } = makeRes();

		await controller.acceptInvitation(makeReq(INVITED_EMAIL), res);

		expect(captured.statusCode).toBe(404);
		expect(addOrganizationMember).not.toHaveBeenCalled();
	});
});
