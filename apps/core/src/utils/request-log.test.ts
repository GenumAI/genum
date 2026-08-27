import { describe, it, expect } from "vitest";
import { redactSensitive } from "./request-log";

describe("redactSensitive", () => {
	it("redacts a login password", () => {
		expect(redactSensitive({ email: "a@b.c", password: "hunter2" })).toEqual({
			email: "a@b.c",
			password: "[REDACTED]",
		});
	});

	it("redacts a provider API key", () => {
		// POST /organization/api-keys — the response deliberately returns only publicKey,
		// so the log must not undo that.
		expect(redactSensitive({ vendor: "OPENAI", key: "sk-live-abcdef" })).toEqual({
			vendor: "OPENAI",
			key: "[REDACTED]",
		});
	});

	it("matches key names case-insensitively and ignores separators", () => {
		expect(
			redactSensitive({
				apiKey: "a",
				api_key: "b",
				ACCESS_TOKEN: "c",
				refreshToken: "d",
				clientSecret: "e",
			}),
		).toEqual({
			apiKey: "[REDACTED]",
			api_key: "[REDACTED]",
			ACCESS_TOKEN: "[REDACTED]",
			refreshToken: "[REDACTED]",
			clientSecret: "[REDACTED]",
		});
	});

	it("redacts nested values", () => {
		expect(redactSensitive({ user: { name: "n", profile: { password: "p" } } })).toEqual({
			user: { name: "n", profile: { password: "[REDACTED]" } },
		});
	});

	it("redacts a whole object whose own field name is sensitive", () => {
		// Safer than recursing into it: whatever `credentials` holds, none of it
		// belongs in a log line.
		expect(redactSensitive({ credentials: { user: "u", password: "p" } })).toEqual({
			credentials: "[REDACTED]",
		});
	});

	it("redacts inside arrays", () => {
		expect(redactSensitive({ items: [{ token: "t1" }, { token: "t2" }] })).toEqual({
			items: [{ token: "[REDACTED]" }, { token: "[REDACTED]" }],
		});
	});

	it("leaves non-sensitive values untouched", () => {
		const body = { name: "prompt", value: "hello", count: 3, enabled: true, nothing: null };
		expect(redactSensitive(body)).toEqual(body);
	});

	it("does not mutate the request body it was given", () => {
		const body = { password: "hunter2" };
		redactSensitive(body);
		expect(body.password).toBe("hunter2");
	});

	it("passes through non-object bodies", () => {
		expect(redactSensitive(undefined)).toBeUndefined();
		expect(redactSensitive("raw string")).toBe("raw string");
		expect(redactSensitive(null)).toBeNull();
	});

	it("survives a cycle without recursing forever", () => {
		const body: Record<string, unknown> = { password: "p" };
		body.self = body;
		expect(() => redactSensitive(body)).not.toThrow();
	});
});
