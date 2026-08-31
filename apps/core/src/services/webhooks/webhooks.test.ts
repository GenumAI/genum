import { describe, it, expect, vi, beforeEach } from "vitest";

const mockEnv = vi.hoisted(() => ({
	WEBHOOK_URL: "https://hooks.example.com/genum" as string,
	WEBHOOK_USERNAME: "hook-user",
	WEBHOOK_PASSWORD: "hook-secret",
}));
vi.mock("@/env", () => ({ env: mockEnv }));

const axiosMock = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("axios", () => ({ default: axiosMock }));

import { webhooks } from "./webhooks";

describe("accountClosureNotice", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockEnv.WEBHOOK_URL = "https://hooks.example.com/genum";
		axiosMock.post.mockResolvedValue({ data: {} });
	});

	// It rides the same wrapper and the same discriminated `type` as the org
	// invite, so the receiving side routes it the way it routes every other mail.
	it("posts the closure type through the shared sender", async () => {
		const sent = await webhooks.accountClosureNotice({
			to: "a.person@example.com",
			stage: "production",
		});

		expect(sent).toBe(true);
		const [url, payload, options] = axiosMock.post.mock.calls[0];
		expect(url).toBe("https://hooks.example.com/genum");
		expect(payload).toEqual({
			type: "accountClosureNotice",
			data: { to: "a.person@example.com", stage: "production" },
		});
		expect(options.auth).toEqual({ username: "hook-user", password: "hook-secret" });
	});

	// THE test of this file. The orchestrator mocks this module out entirely, so
	// nothing there can observe the swallow — and the whole "best-effort" claim
	// rests on it. A throw here would propagate into a closure that has already
	// passed both guards and strand a half-closed account.
	it("returns false instead of throwing when the webhook is down", async () => {
		axiosMock.post.mockRejectedValue(new Error("connect ECONNREFUSED"));

		await expect(
			webhooks.accountClosureNotice({ to: "a.person@example.com", stage: "production" }),
		).resolves.toBe(false);
	});

	// A self-hosted instance has no webhook consumer. Reporting "sent" there would
	// be a lie in the closure's own outcome.
	it("reports not-sent when no webhook is configured", async () => {
		mockEnv.WEBHOOK_URL = "";

		const sent = await webhooks.accountClosureNotice({
			to: "a.person@example.com",
			stage: "production",
		});

		expect(sent).toBe(false);
		expect(axiosMock.post).not.toHaveBeenCalled();
	});
});
