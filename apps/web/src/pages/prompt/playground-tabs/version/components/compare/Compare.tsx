import { ChevronLeft } from "lucide-react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";

import { Button } from "@/components/ui/button";
import { CommitDropdowns } from "@/pages/prompt/playground-tabs/version/components/compare/components/CommitDropdowns";
import { useTheme } from "@/components/theme/theme-provider";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";

import { useCompareData } from "./hooks/useCompareData";
import { CompareSection } from "./components/CompareSection";
import {
	AccordionKeys,
	getByPath,
	formatCompareValue,
	getChangedLinesStats,
} from "./utils";

const Compare = () => {
	const { id, orgId, projectId } = useParams();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	const commitA = searchParams.get("commitA") || "";
	const commitB = searchParams.get("commitB") || "";

	const {
		dataA,
		dataB,
		branchesLoading,
		sortedVersions,
		versions,
	} = useCompareData(id, commitA, commitB);

	const initialOpenState = useMemo(() => {
		const entries = Object.entries(AccordionKeys).map(([, value], index) => [value, index === 0]);
		return Object.fromEntries(entries);
	}, []);

	const [open, setOpen] = useState<Record<string, boolean>>(initialOpenState);

	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

	const getInfo = (cid: string) => {
		if (cid === "current") {
			return { name: "Current prompt", author: "Not", date: "", branch: "current" };
		}
		const ver = versions.find((v) => v.id.toString() === cid);
		if (!ver) return null;
		return {
			name: ver.commitMsg,
			author: ver.author.name,
			date: formatUserLocalDateTime(ver.createdAt),
			branch: ver.branchName,
		};
	};

	if (branchesLoading) return <p className="p-6">Loading...</p>;

	const renderCompareSections = () => {
		if (!dataA || !dataB) return null;

		return (
			<div className="border rounded-lg px-6 py-3 flex-1 overflow-y-auto mb-20">
				{Object.entries(AccordionKeys).map(([title, key]) => {
					const leftRaw = getByPath(
						!commitA || commitA === "current"
							? dataA?.prompt || dataA
							: dataA?.version || dataA,
						key,
					);
					const rightRaw = getByPath(
						commitB === "current" ? dataB?.prompt || dataB : dataB?.version || dataB,
						key,
					);

					if (!leftRaw && !rightRaw) return null;

					// Special check for empty tools
					if (key === AccordionKeys.Tools) {
						if (
							Array.isArray(leftRaw) &&
							leftRaw.length === 0 &&
							Array.isArray(rightRaw) &&
							rightRaw.length === 0
						) {
							return null;
						}
					}

					const leftStr = formatCompareValue(key, leftRaw);
					const rightStr = formatCompareValue(key, rightRaw);
					const changed = leftStr !== rightStr;

					const { added, removed } = changed
						? getChangedLinesStats(leftStr, rightStr)
						: { added: 0, removed: 0 };

					const diffLanguage = key === AccordionKeys.Prompt ? "markdown" : "json";

					return (
						<CompareSection
							key={key}
							title={title}
							isOpen={!!open[key]}
							onOpenChange={(isOpen) =>
								setOpen((prev) => ({ ...prev, [key]: isOpen }))
							}
							added={added}
							removed={removed}
							changed={changed}
							originalValue={leftStr}
							modifiedValue={rightStr}
							language={diffLanguage}
							theme={monacoTheme}
						/>
					);
				})}
			</div>
		);
	};

	return (
		<div className="mx-auto w-full max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] p-6 h-full flex flex-col">
			<div className="md:p-6 flex flex-col flex-1 min-h-0">
				<div className="flex items-center gap-2 mb-6">
					<Button
						variant="outline"
						size="sm"
						className="w-[81px] h-9 border-[#18181B] text-[14px]"
						onClick={() => navigate(`/${orgId}/${projectId}/prompt/${id}/versions`)}
					>
						<ChevronLeft className="h-4 w-4" />
						Back
					</Button>
				</div>
				<CommitDropdowns
					firstAuthor={getInfo(commitA || "current")}
					secondAuthor={getInfo(commitB)}
					sortedVersions={sortedVersions}
				/>

				{renderCompareSections()}

				{!commitA && !commitB && (
					<p className="text-muted-foreground">Select two commits to compare</p>
				)}
			</div>
		</div>
	);
};

export default Compare;
