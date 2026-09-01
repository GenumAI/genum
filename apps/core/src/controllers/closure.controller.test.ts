import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

vi.mock("@/env", () => ({ env: { INSTANCE_TYPE: "cloud" } }));
vi.mock("@/database/db", () => ({ db: {} }));

const previewClosure = vi.hoisted(() => vi.fn());
const closeAccount = vi.hoisted(() => vi.fn());
vi.mock("@/services/account-closure.service", () => ({
	AccountClosureService: class {
		previewClosure = previewClosure;
		closeAccount = closeAccount;
	},
}));
vi.mock("@/services/mail-erasure-client", () => ({ MailErasureClient: class {} }));

import { ClosureController } from "./closure.controller";

const CALLER = 42;
const SOMEONE_ELSE = 99;

function makeReq(body: unknown = {}): Request {
	return {
		body,
		genumMeta: { ids: { userID: CALLER, orgID: -1, projID: -1 } },
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

describe("ClosureController", () => {
	let controller: ClosureController;

	beforeEach(() => {
		vi.clearAllMocks();
		controller = new ClosureController();
	});

	it("previews the CALLER's account and writes nothing", async () => {
		previewClosure.mockResolvedValue({ status: "erasable", alreadyErased: false, labOnly: false });
		const { res, captured } = makeRes();

		await controller.preview(makeReq(), res);

		expect(previewClosure).toHaveBeenCalledWith(CALLER);
		expect(closeAccount).not.toHaveBeenCalled();
		expect(captured.statusCode).toBe(200);
	});

	it("closes the CALLER's account", async () => {
		closeAccount.mockResolvedValue({
			status: "closed",
			completed: [],
			identitiesDeleted: 0,
			alreadyErased: false,
			labOnly: true,
		});
		const { res, captured } = makeRes();

		await controller.close(makeReq(), res);

		expect(closeAccount).toHaveBeenCalledWith(CALLER);
		expect(captured.statusCode).toBe(200);
	});

	it("takes the subject from the token, never from the body", async () => {
		// A body-supplied id would let any signed-in person close anyone's account.
		closeAccount.mockResolvedValue({
			status: "closed",
			completed: [],
			identitiesDeleted: 0,
			alreadyErased: false,
			labOnly: true,
		});
		const { res } = makeRes();

		await controller.close(makeReq({ userId: SOMEONE_ELSE, id: SOMEONE_ELSE }), res);

		expect(closeAccount).toHaveBeenCalledWith(CALLER);
		expect(closeAccount).not.toHaveBeenCalledWith(SOMEONE_ELSE);
	});

	it("does the same for the preview", async () => {
		previewClosure.mockResolvedValue({ status: "erasable", alreadyErased: false, labOnly: false });
		const { res } = makeRes();

		await controller.preview(makeReq({ userId: SOMEONE_ELSE }), res);

		expect(previewClosure).toHaveBeenCalledWith(CALLER);
	});

	it("passes a refusal through as 409 with the reason the service gave", async () => {
		// "transfer ownership of <org> first" is actionable; a generic error is not.
		closeAccount.mockResolvedValue({
			status: "refused",
			step: "lab_guard",
			reason: "sole_owner_of_shared_organization",
			detail: "Transfer ownership of Acme first.",
		});
		const { res, captured } = makeRes();

		await controller.close(makeReq(), res);

		expect(captured.statusCode).toBe(409);
		expect(captured.body).toMatchObject({
			status: "refused",
			reason: "sole_owner_of_shared_organization",
			detail: "Transfer ownership of Acme first.",
		});
	});

	it("reports a refusal on the preview too, so the UI never offers a button that cannot work", async () => {
		previewClosure.mockResolvedValue({
			status: "refused",
			step: "mail_guard",
			reason: "sole_workspace_owner",
			detail: "Transfer first.",
		});
		const { res, captured } = makeRes();

		await controller.preview(makeReq(), res);

		expect(captured.statusCode).toBe(409);
		expect(captured.body).toMatchObject({ reason: "sole_workspace_owner" });
	});

	it("answers 500 when a step failed, carrying the step that stopped it", async () => {
		closeAccount.mockResolvedValue({
			status: "failed",
			step: "mail_erase",
			completed: ["lab_guard", "mail_guard", "auth0_lockout"],
			detail: "ECONNREFUSED",
		});
		const { res, captured } = makeRes();

		await controller.close(makeReq(), res);

		expect(captured.statusCode).toBe(500);
		expect(captured.body).toMatchObject({ status: "failed", step: "mail_erase" });
	});

	it("answers 404 when the caller's row is gone", async () => {
		previewClosure.mockResolvedValue({ status: "not_found" });
		const { res, captured } = makeRes();

		await controller.preview(makeReq(), res);

		expect(captured.statusCode).toBe(404);
	});
});
