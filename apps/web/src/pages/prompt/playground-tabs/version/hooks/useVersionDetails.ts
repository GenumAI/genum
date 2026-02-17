import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { promptApi } from "@/api/prompt";
import type { AuditData } from "../utils/types";

export const VERSION_DETAILS_QUERY_KEY = ["version-details"] as const;

export const useVersionDetails = (id: string | undefined, versionId: string | undefined) => {
	const query = useQuery({
		queryKey: [...VERSION_DETAILS_QUERY_KEY, id, versionId],
		queryFn: async () => {
			if (!id || !versionId) throw new Error("Missing id or versionId");
			return promptApi.getVersion(id, versionId);
		},
		enabled: Boolean(id && versionId),
	});

	const data = query.data ?? null;

	const parsedSchema = useMemo(() => {
		try {
			const jsonSchema = data?.version?.languageModelConfig?.json_schema;
			if (!jsonSchema) return null;
			if (typeof jsonSchema === "string") {
				return JSON.parse(jsonSchema);
			}
			return jsonSchema;
		} catch (e) {
			console.error("Failed to parse JSON schema:", e);
			return null;
		}
	}, [data]);

	const parsedTools = useMemo(() => {
		const tools = data?.version?.languageModelConfig?.tools;
		if (!tools || !Array.isArray(tools) || tools.length === 0) {
			return null;
		}
		return tools;
	}, [data]);

	const auditData: AuditData | null = useMemo(() => {
		return data?.version?.audit || null;
	}, [data?.version?.audit]);

	const modelConfigParams = useMemo(() => {
		if (!data?.version?.languageModelConfig) return [];

		const config = data.version.languageModelConfig;
		return Object.entries(config)
			.filter(([key, value]) => {
				if (value === undefined || value === null) return false;
				if (key === "tools" || key === "json_schema") return false;
				return true;
			})
			.map(([key, value]) => {
				let displayValue: string;
				if (Array.isArray(value)) {
					displayValue = JSON.stringify(value);
				} else if (typeof value === "object" && value !== null) {
					displayValue = JSON.stringify(value);
				} else {
					displayValue = String(value);
				}
				return [key, displayValue] as [string, string];
			});
	}, [data?.version?.languageModelConfig]);

	return {
		data,
		isLoading: query.isLoading,
		parsedSchema,
		parsedTools,
		auditData,
		modelConfigParams,
		refresh: query.refetch,
	};
};
