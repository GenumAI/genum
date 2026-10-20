import type { Request } from "express";
import { afterEach, describe, it, expect, vi } from "vitest";
import { redactSensitive, requestLog } from "./request-log";

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

describe("requestLog", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	function logLine(originalUrl: string, body: unknown): string {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		requestLog({
			headers: {},
			socket: { remoteAddress: "1.2.3.4" },
			method: "POST",
			originalUrl,
			body,
		} as unknown as Request);
		return log.mock.calls[0][0] as string;
	}

	it("shortens a base64 file to a prefix and its length", () => {
		// POST /api/v1/prompts/run takes files inline: one 300 KB PDF used to be a 400 KB line.
		const base64 = "JVBERi0xLjQK".padEnd(400_000, "A");
		const line = logLine("/api/v1/prompts/run", {
			id: 1,
			files: [{ fileName: "a.pdf", contentType: "application/pdf", base64 }],
		});

		expect(line).not.toContain(base64);
		expect(line).toContain('"base64":"JVBERi0xLjQK');
		expect(line).toContain("[400000 chars]");
		expect(line.length).toBeLessThan(1_000);
	});

	it("keeps short values readable", () => {
		const line = logLine("/prompts/1/run", { question: "What is the capital of France?" });

		expect(line).toContain('{"question":"What is the capital of France?"}');
	});

	it("still redacts sensitive fields", () => {
		const line = logLine("/auth/local/login", { email: "a@b.c", password: "hunter2" });

		expect(line).not.toContain("hunter2");
	});

	it("caps the body of one line however many short values it holds", () => {
		const body = { testcases: Array.from({ length: 1_000 }, (_, i) => `testcase ${i}`) };
		const line = logLine("/testcases/bulk", body);

		expect(line.length).toBeLessThan(2_500);
		expect(line).toMatch(/\[\d+ chars\]$/);
	});

	it("leaves out the body of an OTLP trace batch", () => {
		// An exporter posts a batch every few seconds, and every span in it carries a
		// traceId, spanId and parentSpanId: the line was a wall of hex.
		const line = logLine("/api/public/otel/v1/traces", {
			resourceSpans: [{ scopeSpans: [{ spans: [{ traceId: "87a2dd07bee5338d" }] }] }],
		});

		expect(line).toMatch(/\[1\.2\.3\.4\] POST \/api\/public\/otel\/v1\/traces$/);
	});
});
