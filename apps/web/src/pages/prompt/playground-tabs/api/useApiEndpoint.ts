import { useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { runtimeConfig } from "@/lib/runtime-config";

export const useApiEndpoint = () => {
	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;

	const [copiedId, setCopiedId] = useState(false);
	const [copiedURL, setCopiedURL] = useState(false);

	const apiUrl = `${runtimeConfig.API_URL}/api/v1/prompts/run`;

	const handleCopyId = useCallback(async () => {
		if (!promptId) return;
		try {
			await navigator.clipboard.writeText(promptId.toString());
			setCopiedId(true);
			setTimeout(() => setCopiedId(false), 3000);
		} catch (e) {
			console.error("Clipboard error", e);
		}
	}, [promptId]);

	const handleCopyURL = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(apiUrl);
			setCopiedURL(true);
			setTimeout(() => setCopiedURL(false), 3000);
		} catch (e) {
			console.error("Clipboard error", e);
		}
	}, [apiUrl]);

	return {
		promptId,
		apiUrl,
		copiedId,
		copiedURL,
		handleCopyId,
		handleCopyURL,
	};
};
