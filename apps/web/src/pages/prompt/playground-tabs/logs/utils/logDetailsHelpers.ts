export function getLogTypeDescription(logType: string | undefined) {
	switch (logType) {
		case "prs":
			return "Prompt run successfully";
		// A continuation turn of one agentic run, and a turn of a session ingested over
		// OTLP. Both are written by the server today; without these cases every such row's
		// detail dialog reads "Unknown log type", which is most rows of any agentic session.
		case "prt":
			return "Prompt run (follow-up)";
		case "oti":
			return "OpenTelemetry trace";
		case "pre":
			return "Prompt run error";
		case "ae":
			return "AI Error";
		case "te":
			return "Technical Error";
		default:
			return "Unknown log type";
	}
}

export function getSourceLabel(source: string | undefined) {
	switch (source) {
		case "ui":
			return "UI";
		case "testcase":
			return "Testcase";
		case "api":
			return "API";
		case "otlp":
			return "OpenTelemetry";
		default:
			return source ? source.charAt(0).toUpperCase() + source.slice(1) : "-";
	}
}

export function normalizeVendorName(vendor: string | undefined): string {
	if (!vendor) return "-";

	const vendorMap: Record<string, string> = {
		OPENAI: "OpenAI",
		GOOGLE: "Google",
		ANTHROPIC: "Anthropic",
		DEEPSEEK: "DeepSeek",
	};

	return vendorMap[vendor.toUpperCase()] || vendor;
}

export function formatResponseTime(ms: number | undefined): string {
	if (ms === undefined || ms === null) return "-";

	const seconds = ms / 1000;

	if (seconds === 0) {
		return "0s";
	}
	if (seconds < 1) {
		return `${seconds.toFixed(3)}s`;
	}
	if (seconds < 10) {
		return `${seconds.toFixed(2)}s`;
	}
	return `${seconds.toFixed(1)}s`;
}
