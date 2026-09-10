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

vi.mock("../services/logger/logger", () => ({
	getSessionSpans: vi.fn(),
}));

import { db } from "@/database/db";
import { getSessionSpans } from "../services/logger/logger";
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

const TRACE_ID = "11111111-2222-4333-8444-555555555555";

describe("ProjectController.getTraceSpans", () => {
	let controller: ProjectController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new ProjectController();
		vi.mocked(getSessionSpans).mockResolvedValue([]);
	});

	it("scopes the read to the caller's org and project, not the request body or query", async () => {
		// A trace_id from another org's run must never be readable by spoofing org/project
		// through the request instead of req.genumMeta.ids.
		const { res } = makeRes();
		const req = makeReq({
			params: { traceId: TRACE_ID },
			body: { orgId: 999, project_id: 999 },
			query: { orgId: 999, project_id: 999 },
		});

		await controller.getTraceSpans(req, res);

		expect(getSessionSpans).toHaveBeenCalledWith(TRACE_ID, CALLER_ORG, CALLER_PROJECT);
	});

	// This route reads a SESSION, and a session id is not a uuid. Our own are, but an
	// ingested session is identified by the sender's `gen_ai.conversation.id` -- which the
	// GenAI conventions constrain in no way -- or by a 32-hex OTLP trace id. Guarded as a
	// uuid, as it was, every ingested session 400s while its rows sit in the table
	// unreadable, and the table is append-only.
	it("reads a session whose id came from a customer's collector", async () => {
		for (const sessionId of ["conv-1", "4bf92f3577b34da6a3ce929d0e0e4736"]) {
			vi.mocked(getSessionSpans).mockClear();
			const { res } = makeRes();

			await controller.getTraceSpans(makeReq({ params: { traceId: sessionId } }), res);

			expect(getSessionSpans).toHaveBeenCalledWith(sessionId, CALLER_ORG, CALLER_PROJECT);
		}
	});

	it("still refuses an id that is empty or carries control characters", async () => {
		const { res } = makeRes();

		await expect(
			controller.getTraceSpans(makeReq({ params: { traceId: "" } }), res),
		).rejects.toThrow();
		expect(getSessionSpans).not.toHaveBeenCalled();
	});
});
