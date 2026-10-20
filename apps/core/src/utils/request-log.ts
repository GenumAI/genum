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

/**
 * A string longer than this is a base64 file, an audio clip or a pasted document, not
 * something anyone reads in a log line. It is cut to its first characters and its length.
 */
const MAX_STRING_LENGTH = 256;
const KEPT_PREFIX_LENGTH = 64;

/** However many short values a body holds, its part of the line stops here. */
const MAX_BODY_LENGTH = 2_000;

/**
 * Routes whose bodies are left out of the line. An OTLP exporter posts a batch every few
 * seconds, every span in it carries a traceId, spanId and parentSpanId, and all of it is a
 * customer's own traces. `requestTiming` still records that the request happened.
 */
const UNLOGGED_BODY_PREFIXES = ["/api/public/otel"];

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

function shortenLongString(_key: string, value: unknown): unknown {
	if (typeof value !== "string" || value.length <= MAX_STRING_LENGTH) {
		return value;
	}
	return `${value.slice(0, KEPT_PREFIX_LENGTH)}… [${value.length} chars]`;
}

function formatBody(body: unknown): string {
	const json = JSON.stringify(redactSensitive(body), shortenLongString);
	if (json.length <= MAX_BODY_LENGTH) {
		return json;
	}
	return `${json.slice(0, MAX_BODY_LENGTH)}… [${json.length} chars]`;
}

export function requestLog(req: Request): void {
	const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
	const originalUrl = req.originalUrl;
	const bodyLogged =
		req.body !== undefined &&
		!UNLOGGED_BODY_PREFIXES.some((prefix) => originalUrl.startsWith(prefix));
	const bodyLog = bodyLogged ? ` ${formatBody(req.body)}` : "";

	console.log(`${new Date().toISOString()}: [${ip}] ${req.method} ${originalUrl}${bodyLog}`);
}
