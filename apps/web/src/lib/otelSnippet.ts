/**
 * The OpenTelemetry configuration shown in a prompt's API tab.
 *
 * Pure and here rather than inline in the component so the parts that can actually be
 * wrong are testable: the endpoint an exporter expects, and the attribute that binds a
 * span to THIS prompt. A reader copies these lines verbatim into their own service, so a
 * wrong path or a missing attribute becomes a 400 they cannot debug from our side.
 */

/** Placeholder shown until the prompt id is known -- never a plausible-looking number. */
export const PROMPT_ID_PLACEHOLDER = "YOUR_PROMPT_ID";

/**
 * What an exporter's `OTEL_EXPORTER_OTLP_ENDPOINT` takes: the BASE, without `/v1/traces`.
 *
 * Exporters append each signal's own path to this value, so a base that already ends in
 * `/v1/traces` becomes `/v1/traces/v1/traces` and 404s. That reads like a broken endpoint
 * rather than a misconfigured one, which is why the two are separate functions here.
 */
export function otelExporterBase(apiUrl: string): string {
	return `${trimSlash(apiUrl)}/api/public/otel`;
}

/** The full URL, for a caller posting OTLP JSON directly rather than through an exporter. */
export function otelTracesUrl(apiUrl: string): string {
	return `${otelExporterBase(apiUrl)}/v1/traces`;
}

/** The exporter's environment, the same three variables every OTEL SDK reads. */
export function otelEnvSnippet(apiUrl: string): string {
	return [
		`OTEL_EXPORTER_OTLP_ENDPOINT=${otelExporterBase(apiUrl)}`,
		// http/json, not the usual protobuf default: this endpoint has no protobuf decoder.
		// Left implicit, an exporter sends protobuf and the whole batch is refused.
		`OTEL_EXPORTER_OTLP_PROTOCOL=http/json`,
		`OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer YOUR_API_KEY"`,
	].join("\n");
}

/**
 * Setting the attribute that binds a span to this prompt.
 *
 * Per SPAN, not per request: a collector merges spans from several services into one
 * batch, so anything set on the request would claim all of them for one prompt. This is
 * also the only way we learn the prompt -- it is never inferred from the key's project or
 * the service name, because a guess puts one customer's traces on another's page.
 */
export function promptAttributeSnippet(promptId?: number): string {
	const value = promptId?.toString() ?? PROMPT_ID_PLACEHOLDER;

	return [
		`span.setAttribute("genum.prompt.id", ${value});`,
		"",
		"// Group a multi-turn conversation into one session (optional, but a session",
		"// without it is a single turn):",
		`span.setAttribute("gen_ai.conversation.id", conversationId);`,
	].join("\n");
}

function trimSlash(value: string): string {
	return value.replace(/\/+$/, "");
}
