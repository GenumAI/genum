import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnv = vi.hoisted(() => ({
	MAIL_SERVICE_URL: "https://mail.example.com" as string | undefined,
	MAIL_ERASURE_APIKEY: "s3cret-key" as string | undefined,
}));
vi.mock("@/env", () => ({ env: mockEnv }));

const axiosMock = vi.hoisted(() => {
	const post = vi.fn();
	// Declared with its config parameter: without one the mock's call tuple has
	// length zero, so reading calls[0][0] to inspect the axios config below is a
	// type error rather than a lookup.
	const create = vi.fn((_config?: unknown) => ({ post }));
	const isAxiosError = vi.fn(() => false);
	return { post, create, isAxiosError };
});
vi.mock("axios", () => ({
	default: {
		create: axiosMock.create,
		isAxiosError: axiosMock.isAxiosError,
	},
}));

import { MailErasureClient } from "./mail-erasure-client";

/** The client resolves every status itself, so a mocked post always resolves. */
function answers(status: number, data: unknown) {
	axiosMock.post.mockResolvedValue({ status, data });
}

describe("MailErasureClient configuration", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.MAIL_SERVICE_URL = "https://mail.example.com";
		mockEnv.MAIL_ERASURE_APIKEY = "s3cret-key";
	});

	it("is unconfigured when either half is missing, and never calls out", async () => {
		mockEnv.MAIL_ERASURE_APIKEY = undefined;
		const client = new MailErasureClient();

		expect(client.isConfigured()).toBe(false);
		const result = await client.erasability({ labUserId: 42, email: "a.person@example.com" });

		expect(result).toMatchObject({ ok: false, kind: "not_configured" });
		expect(axiosMock.post).not.toHaveBeenCalled();
	});

	it("presents the key as a bearer token in the exact form the other side parses", () => {
		new MailErasureClient();

		// The receiving side splits on whitespace, requires exactly two parts, and
		// compares the scheme case-sensitively.
		expect(axiosMock.create).toHaveBeenCalledWith(
			expect.objectContaining({
				baseURL: "https://mail.example.com",
				headers: expect.objectContaining({ Authorization: "Bearer s3cret-key" }),
			}),
		);
	});

	it("accepts every status itself, so a 409 is an answer rather than a throw", () => {
		new MailErasureClient();

		const config = axiosMock.create.mock.calls[0]?.[0] as { validateStatus: (s: number) => boolean };
		expect(config.validateStatus(409)).toBe(true);
		expect(config.validateStatus(500)).toBe(true);
	});
});

describe("MailErasureClient status mapping", () => {
	let client: MailErasureClient;
	const ref = { labUserId: 42, email: "a.person@example.com" };

	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.MAIL_SERVICE_URL = "https://mail.example.com";
		mockEnv.MAIL_ERASURE_APIKEY = "s3cret-key";
		client = new MailErasureClient();
	});

	it("reads a 404 as the feature being switched off there, not as a missing user", async () => {
		// Those endpoints answer 404 rather than 401 when their inbound key is
		// unset, so a deployment that never opted in does not advertise that an
		// erasure endpoint exists. Confusing this with "no such user" would make a
		// closure silently skip a system that is simply unconfigured.
		answers(404, {});

		expect(await client.erasability(ref)).toMatchObject({ ok: false, kind: "service_disabled" });
	});

	it("reads a 409 as their refusal and carries the reason verbatim", async () => {
		answers(409, { reason: "sole_workspace_owner", detail: "Transfer ownership first." });

		expect(await client.erase(ref)).toEqual({
			ok: false,
			kind: "refused",
			reason: "sole_workspace_owner",
			detail: "Transfer ownership first.",
		});
	});

	it("falls back to a usable reason when a refusal body is malformed", async () => {
		answers(409, {});

		const result = await client.erase(ref);

		expect(result).toMatchObject({ ok: false, kind: "refused", reason: "refused" });
	});

	it("treats a 5xx as unreachable so the caller stops", async () => {
		answers(503, {});

		expect(await client.erasability(ref)).toMatchObject({ ok: false, kind: "unreachable" });
	});

	it("treats a transport failure as unreachable without leaking the key", async () => {
		axiosMock.post.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.1:443"));

		const result = await client.lockout("a.person@example.com");

		expect(result).toMatchObject({ ok: false, kind: "unreachable" });
		// The axios config carries the Authorization header; nothing derived from
		// it may reach a caller that will log this.
		expect(JSON.stringify(result)).not.toContain("s3cret-key");
	});

	it("does not throw on a success body it cannot read", async () => {
		answers(200, null);

		const result = await client.erasability(ref);

		expect(result).toMatchObject({ ok: true });
	});
});

describe("MailErasureClient requests and readers", () => {
	let client: MailErasureClient;
	const ref = { labUserId: 42, email: "a.person@example.com" };

	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.MAIL_SERVICE_URL = "https://mail.example.com";
		mockEnv.MAIL_ERASURE_APIKEY = "s3cret-key";
		client = new MailErasureClient();
	});

	it("reads an erasable answer", async () => {
		answers(200, { erasable: true });

		expect(await client.erasability(ref)).toEqual({
			ok: true,
			value: { erasable: true, notFound: false, reason: null, detail: null },
		});
	});

	it("reads their not_found as an answer, not an error", async () => {
		// A person can hold an account here and never have used the mail product.
		answers(200, { status: "not_found" });

		const result = await client.erasability(ref);

		expect(result).toMatchObject({ ok: true, value: { notFound: true } });
	});

	it("parses the identity list and drops entries it cannot use", async () => {
		answers(200, {
			identities: [
				{ userId: "auth0|aaa", email: "a.person@example.com" },
				{ email: "no-user-id@example.com" },
				null,
				{ userId: "google-oauth2|bbb" },
			],
		});

		const result = await client.lockout("a.person@example.com");

		expect(result).toEqual({
			ok: true,
			value: {
				identities: [
					{ userId: "auth0|aaa", email: "a.person@example.com" },
					{ userId: "google-oauth2|bbb", email: "" },
				],
			},
		});
	});

	it("returns an empty identity list rather than throwing on a missing field", async () => {
		answers(200, {});

		expect(await client.lockout("a.person@example.com")).toEqual({
			ok: true,
			value: { identities: [] },
		});
	});

	it("sends the confirmation token on the two destructive calls", async () => {
		answers(200, {});
		await client.erase(ref);
		expect(axiosMock.post.mock.calls[0]?.[1]).toMatchObject({ confirm: "erase" });

		vi.clearAllMocks();
		answers(200, { deleted: ["auth0|aaa"], alreadyGone: [] });
		await client.auth0Delete(["auth0|aaa"]);
		expect(axiosMock.post.mock.calls[0]?.[1]).toMatchObject({ confirm: "erase" });
	});

	it("succeeds without a call when there are no identities to delete", async () => {
		// A resumed closure can legitimately reach this step with an empty list.
		const result = await client.auth0Delete([]);

		expect(result).toEqual({ ok: true, value: { deleted: [], alreadyGone: [] } });
		expect(axiosMock.post).not.toHaveBeenCalled();
	});

	it("keeps only strings out of the delete result", async () => {
		answers(200, { deleted: ["auth0|aaa", 7, null], alreadyGone: "nope" });

		expect(await client.auth0Delete(["auth0|aaa"])).toEqual({
			ok: true,
			value: { deleted: ["auth0|aaa"], alreadyGone: [] },
		});
	});
});
