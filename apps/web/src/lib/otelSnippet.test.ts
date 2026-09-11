import { describe, expect, it } from "vitest";

import {
	otelEnvSnippet,
	otelExporterBase,
	otelTracesUrl,
	promptAttributeSnippet,
	PROMPT_ID_PLACEHOLDER,
} from "./otelSnippet";

describe("otelExporterBase", () => {
	it("stops at the base an exporter appends to", () => {
		// NOT `/v1/traces`. An exporter appends the signal's path itself, so a base that
		// already carries it becomes `/v1/traces/v1/traces` and 404s -- which reads like a
		// broken endpoint rather than a misconfigured one.
		expect(otelExporterBase("https://api.genum.ai")).toBe(
			"https://api.genum.ai/api/public/otel",
		);
		expect(otelExporterBase("https://api.genum.ai")).not.toContain("v1/traces");
	});

	it("does not double a slash when the API url has a trailing one", () => {
		expect(otelExporterBase("http://localhost:3010/")).toBe(
			"http://localhost:3010/api/public/otel",
		);
	});
});

describe("otelTracesUrl", () => {
	it("is the base plus the traces path, for a caller posting OTLP JSON directly", () => {
		expect(otelTracesUrl("http://localhost:3010")).toBe(
			"http://localhost:3010/api/public/otel/v1/traces",
		);
	});
});

describe("otelEnvSnippet", () => {
	it("pins the JSON protocol, which is not the SDK default", () => {
		// Left out, an exporter sends protobuf and every batch is refused -- there is no
		// protobuf decoder on this endpoint.
		expect(otelEnvSnippet("http://localhost:3010")).toContain(
			"OTEL_EXPORTER_OTLP_PROTOCOL=http/json",
		);
	});

	it("carries the endpoint and an auth header placeholder, never a real key", () => {
		const snippet = otelEnvSnippet("http://localhost:3010");

		expect(snippet).toContain("OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3010/api/public/otel");
		expect(snippet).toContain("Authorization=Bearer YOUR_API_KEY");
	});
});

describe("promptAttributeSnippet", () => {
	it("substitutes the prompt's own id", () => {
		expect(promptAttributeSnippet(42)).toContain('span.setAttribute("genum.prompt.id", 42);');
	});

	it("shows a placeholder, not a number, when the id is not known yet", () => {
		// A plausible-looking default would be copied and would send someone's traces to
		// whichever prompt happens to hold that id.
		expect(promptAttributeSnippet(undefined)).toContain(PROMPT_ID_PLACEHOLDER);
		expect(promptAttributeSnippet(undefined)).not.toMatch(/genum\.prompt\.id", \d/);
	});

	it("mentions the conversation id, which is what groups turns into a session", () => {
		expect(promptAttributeSnippet(1)).toContain("gen_ai.conversation.id");
	});
});
