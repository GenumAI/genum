import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { runtimeConfig } from "@/lib/runtime-config";
import { otelEnvSnippet, otelExporterBase, otelTracesUrl } from "@/lib/otelSnippet";

export const useApiEndpoint = () => {
	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;

	const [copiedId, setCopiedId] = useState(false);
	const [copiedURL, setCopiedURL] = useState(false);
	const [copiedOtelURL, setCopiedOtelURL] = useState(false);
	const [copiedOtelEnv, setCopiedOtelEnv] = useState(false);

	const apiUrl = `${runtimeConfig.API_URL}/api/v1/prompts/run`;
	// The base an exporter takes, and the full path for a caller posting JSON by hand.
	// Both are shown because configuring one with the other's value is the usual mistake.
	const otelUrl = otelExporterBase(runtimeConfig.API_URL);
	const otelPostUrl = otelTracesUrl(runtimeConfig.API_URL);
	const otelEnv = otelEnvSnippet(runtimeConfig.API_URL);

	const copy = useCallback(async (value: string, mark: (copied: boolean) => void) => {
		if (!value) return;
		try {
			await navigator.clipboard.writeText(value);
			mark(true);
			setTimeout(() => mark(false), 3000);
		} catch (e) {
			console.error("Clipboard error", e);
		}
	}, []);

	const handleCopyId = useCallback(
		() => copy(promptId?.toString() ?? "", setCopiedId),
		[copy, promptId],
	);
	const handleCopyURL = useCallback(() => copy(apiUrl, setCopiedURL), [copy, apiUrl]);
	const handleCopyOtelURL = useCallback(() => copy(otelUrl, setCopiedOtelURL), [copy, otelUrl]);
	const handleCopyOtelEnv = useCallback(() => copy(otelEnv, setCopiedOtelEnv), [copy, otelEnv]);

	return {
		promptId,
		apiUrl,
		otelUrl,
		otelPostUrl,
		otelEnv,
		copiedId,
		copiedURL,
		copiedOtelURL,
		copiedOtelEnv,
		handleCopyId,
		handleCopyURL,
		handleCopyOtelURL,
		handleCopyOtelEnv,
	};
};
