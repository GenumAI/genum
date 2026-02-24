import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getOrgId, getProjectId } from "@/api/client";
import useTestcasesGroupedByPrompt, {
	type PromptStats,
} from "@/pages/dashboard/hooks/useTestcasesGroupedByPrompt";
import { getTestcaseErrorRate, getTestcaseTotals } from "@/pages/dashboard/utils/testcaseStats";
import { useSkeletonVisibility } from "@/hooks/useSkeletonVisibility";

type BarDataKey = "passed" | "failed";

export function useTestcaseStats(prompts: PromptStats[]) {
	const [showAll, setShowAll] = useState(false);
	const [hoveredBar, setHoveredBar] = useState<{ promptId: number; dataKey: BarDataKey } | null>(
		null,
	);

	const navigate = useNavigate();
	const orgId = getOrgId();
	const projectId = getProjectId();

	const { chartData, isLoading, error } = useTestcasesGroupedByPrompt(prompts);
	const showSkeleton = useSkeletonVisibility(isLoading);
	const forceSkeletonOnError = Boolean(error) && chartData.length === 0;

	const dataToShow = useMemo(
		() => (showAll ? chartData : chartData.slice(0, 5)),
		[chartData, showAll],
	);
	const hasMoreData = chartData.length > 5;

	const totalStats = useMemo(() => getTestcaseTotals(chartData), [chartData]);
	const errorRate = useMemo(() => getTestcaseErrorRate(totalStats), [totalStats]);

	const toggleShowAll = useCallback(() => {
		setShowAll((prev) => !prev);
	}, []);

	const setHovered = useCallback((promptId: number, dataKey: BarDataKey) => {
		setHoveredBar({ promptId, dataKey });
	}, []);

	const clearHovered = useCallback(() => {
		setHoveredBar(null);
	}, []);

	const isHovered = useCallback(
		(promptId: number, dataKey: BarDataKey) => {
			return hoveredBar?.promptId === promptId && hoveredBar?.dataKey === dataKey;
		},
		[hoveredBar],
	);

	const navigateToPromptTestcases = useCallback(
		(promptId: number, status: BarDataKey) => {
			if (!orgId || !projectId) return;
			navigate(`/${orgId}/${projectId}/prompt/${promptId}/testcases?status=${status}`);
		},
		[navigate, orgId, projectId],
	);

	return {
		isLoading: showSkeleton || forceSkeletonOnError,
		error,
		chartData,
		dataToShow,
		hasMoreData,
		totalStats,
		errorRate,
		showAll,
		hoveredBar,
		toggleShowAll,
		setHovered,
		clearHovered,
		isHovered,
		navigateToPromptTestcases,
	};
}
