import { describe, expect, it } from "vitest";

import { getLogTypeDescription, getSourceLabel } from "./logDetailsHelpers";

describe("getLogTypeDescription", () => {
	it("names every log type the server writes", () => {
		// `prt` and `oti` were missing while the server wrote both, so a multi-turn agentic
		// session showed "Unknown log type" on every row but its first, and an ingested
		// trace on all of them. The list here must stay in step with `LogType` in
		// apps/core/src/services/logger/types.ts.
		expect(getLogTypeDescription("prs")).toBe("Prompt run successfully");
		expect(getLogTypeDescription("prt")).toBe("Agentic run turn");
		expect(getLogTypeDescription("oti")).toBe("Ingested trace");
		expect(getLogTypeDescription("pre")).toBe("Prompt run error");
		expect(getLogTypeDescription("ae")).toBe("AI Error");
		expect(getLogTypeDescription("te")).toBe("Technical Error");
	});

	it("still falls back for a type it has never seen", () => {
		expect(getLogTypeDescription("zz")).toBe("Unknown log type");
		expect(getLogTypeDescription(undefined)).toBe("Unknown log type");
	});
});

describe("getSourceLabel", () => {
	it("names the OTLP source rather than title-casing it", () => {
		// The fallback would render "Otlp", which is not what the protocol is called.
		expect(getSourceLabel("otlp")).toBe("OpenTelemetry");
	});

	it("keeps the existing sources", () => {
		expect(getSourceLabel("ui")).toBe("UI");
		expect(getSourceLabel("testcase")).toBe("Testcase");
		expect(getSourceLabel("api")).toBe("API");
		expect(getSourceLabel(undefined)).toBe("-");
	});
});
