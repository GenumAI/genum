import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({
	env: { FRONTEND_URL: "https://lab.genum.ai", INSTANCE_TYPE: "local" },
}));

vi.mock("@/database/db", () => ({
	db: {
		project: {
			deleteProjectApiKeyById: vi.fn(),
			getMemberByUserId: vi.fn(),
			addMember: vi.fn(),
		},
		users: {
			getUserByID: vi.fn(),
		},
		organization: {
			getMemberByUserId: vi.fn(),
		},
	},
}));

import { db } from "@/database/db";
import { ProjectController } from "./project.controller";

const CALLER_ORG = 1;
const CALLER_PROJECT = 10;

function makeReq(overrides: Record<string, unknown> = {}): Request {
	return {
		params: {},
		body: {},
		genumMeta: {
			ids: { userID: 5, orgID: CALLER_ORG, projID: CALLER_PROJECT },
		},
		...overrides,
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

describe("ProjectController.deleteProjectApiKey", () => {
	let controller: ProjectController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new ProjectController();
	});

	it("deletes a key that belongs to the caller's project", async () => {
		vi.mocked(db.project.deleteProjectApiKeyById).mockResolvedValue({ count: 1 } as never);
		const { res, captured } = makeRes();

		await controller.deleteProjectApiKey(makeReq({ params: { apiKeyId: "3" } }), res);

		expect(captured.statusCode).toBe(200);
	});

	it("scopes the delete to the caller's project", async () => {
		// The bug: the query was `where: { id }` alone, so any key id in the
		// instance could be deleted from any project.
		vi.mocked(db.project.deleteProjectApiKeyById).mockResolvedValue({ count: 1 } as never);
		const { res } = makeRes();

		await controller.deleteProjectApiKey(makeReq({ params: { apiKeyId: "3" } }), res);

		expect(db.project.deleteProjectApiKeyById).toHaveBeenCalledWith(3, CALLER_PROJECT);
	});

	it("404s instead of reporting success when the key belongs to another project", async () => {
		vi.mocked(db.project.deleteProjectApiKeyById).mockResolvedValue({ count: 0 } as never);
		const { res, captured } = makeRes();

		await controller.deleteProjectApiKey(makeReq({ params: { apiKeyId: "999" } }), res);

		expect(captured.statusCode).toBe(404);
	});
});

describe("ProjectController.addProjectMember", () => {
	let controller: ProjectController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new ProjectController();
		vi.mocked(db.users.getUserByID).mockResolvedValue({ id: 42, email: "u@e.c" } as never);
		vi.mocked(db.project.getMemberByUserId).mockResolvedValue(null as never);
		vi.mocked(db.project.addMember).mockResolvedValue({ id: 1 } as never);
	});

	it("adds a user who belongs to the caller's organization", async () => {
		vi.mocked(db.organization.getMemberByUserId).mockResolvedValue({ id: 9 } as never);
		const { res, captured } = makeRes();

		await controller.addProjectMember(makeReq({ body: { userId: 42, role: "MEMBER" } }), res);

		expect(captured.statusCode).toBe(201);
		expect(db.project.addMember).toHaveBeenCalledWith(CALLER_PROJECT, 42, "MEMBER");
	});

	it("refuses a user from another organization", async () => {
		// The bug: getUserByID is a global lookup, so any user id in the database
		// could be attached to the caller's project.
		vi.mocked(db.organization.getMemberByUserId).mockResolvedValue(null as never);
		const { res, captured } = makeRes();

		await controller.addProjectMember(makeReq({ body: { userId: 42, role: "MEMBER" } }), res);

		expect(captured.statusCode).toBe(404);
		expect(db.project.addMember).not.toHaveBeenCalled();
	});
});
