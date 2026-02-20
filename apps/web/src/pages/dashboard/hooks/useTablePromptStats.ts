import { useCallback, useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { SortingState } from "@tanstack/react-table";
import { getOrgId, getProjectId } from "@/api/client";
import {
	buildPromptLogsPath,
	getPromptDisplayName,
	isPromptDeleted as isPromptDeletedUtil,
} from "@/pages/dashboard/utils/promptStatsTable";
import type { PromptName } from "@/types/logs";

export function useTablePromptStats(promptNames: PromptName[]) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [showAll, setShowAll] = useState(false);
	const navigate = useNavigate();

	const orgId = getOrgId();
	const projectId = getProjectId();

	const getPromptName = useCallback(
		(promptId: number) => getPromptDisplayName(promptId, promptNames),
		[promptNames],
	);

	const isPromptDeleted = useCallback(
		(promptId: number) => isPromptDeletedUtil(promptId, promptNames),
		[promptNames],
	);

	const openPromptLogs = useCallback(
		(event: Pick<MouseEvent | KeyboardEvent, "metaKey" | "ctrlKey">, promptId: number) => {
			const path = buildPromptLogsPath(orgId, projectId, promptId);
			if (!path) return;

			if (event.metaKey || event.ctrlKey) {
				window.open(path, "_blank");
				return;
			}

			navigate(path);
		},
		[navigate, orgId, projectId],
	);

	const toggleShowAll = useCallback(() => {
		setShowAll((prev) => !prev);
	}, []);

	return {
		sorting,
		setSorting,
		showAll,
		toggleShowAll,
		getPromptName,
		isPromptDeleted,
		openPromptLogs,
	};
}
