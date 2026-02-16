export function getLogTypeDescription(logType: string | undefined) {
	switch (logType) {
		case "prs":
			return "Prompt run successfully";
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
	};
	
	return vendorMap[vendor.toUpperCase()] || vendor;
}

export function formatResponseTime(ms: number | undefined): string {
	if (ms === undefined || ms === null) return "-";
	
	const seconds = ms / 1000;
	
	if (seconds < 1) {
		return `${seconds.toFixed(3)} s`;
	}
	
	if (seconds < 10) {
		return `${seconds.toFixed(2)} s`;
	}
	
	return `${seconds.toFixed(1)} s`;
}
