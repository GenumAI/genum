import type { Request } from "express";

/**
 * Body fields whose values must never reach the logs. Compared after stripping
 * separators and lowercasing, so `apiKey`, `api_key` and `API-KEY` all match.
 *
 * This deliberately over-matches: a bare `key` also covers memory keys, which are
 * not secret. Losing that detail from a log line is a far cheaper mistake than
 * printing an organization's OpenAI key.
 */
const SENSITIVE_FIELDS = new Set([
	"password",
	"currentpassword",
	"newpassword",
	"passwordconfirmation",
	"key",
	"apikey",
	"secretkey",
	"privatekey",
	"token",
	"accesstoken",
	"refreshtoken",
	"idtoken",
	"secret",
	"clientsecret",
	"authorization",
	"credentials",
]);

const REDACTED = "[REDACTED]";

function isSensitive(fieldName: string): boolean {
	return SENSITIVE_FIELDS.has(fieldName.replace(/[-_\s]/g, "").toLowerCase());
}

/**
 * Returns a copy of `body` with the value of every sensitive field replaced.
 * The input is never mutated, and self-referencing objects are handled.
 */
export function redactSensitive(body: unknown, seen = new WeakSet<object>()): unknown {
	if (body === null || typeof body !== "object") {
		return body;
	}

	if (seen.has(body)) {
		return "[CIRCULAR]";
	}
	seen.add(body);

	if (Array.isArray(body)) {
		return body.map((item) => redactSensitive(item, seen));
	}

	const result: Record<string, unknown> = {};
	for (const [fieldName, value] of Object.entries(body as Record<string, unknown>)) {
		result[fieldName] = isSensitive(fieldName) ? REDACTED : redactSensitive(value, seen);
	}
	return result;
}

export function requestLog(req: Request): void {
	const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
	const originalUrl = req.originalUrl;
	const bodyLog = req.body === undefined ? "" : ` ${JSON.stringify(redactSensitive(req.body))}`;

	console.log(`${new Date().toISOString()}: [${ip}] ${req.method} ${originalUrl}${bodyLog}`);
}
