import { ChevronLeft, ChevronDown } from "lucide-react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useMemo, useState, useEffect, useCallback } from "react";

import CompareDiffEditor from "@/components/ui/DiffEditor";
import { Button } from "@/components/ui/button";
import { promptApi } from "@/api/prompt";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { BranchesResponse } from "@/pages/prompt/playground-tabs/version/compare/types";
import { CommitDropdowns } from "@/pages/prompt/playground-tabs/version/compare/commit-select/CommitDropdowns";
import { parseJson } from "@/lib/jsonUtils";
import { diffLines } from "diff";
import { useTheme } from "@/components/theme/theme-provider";

const formatDate = (date: string) =>
	new Date(date).toLocaleString("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

function getByPath(obj: any, path: string): unknown {
	return path.split(".").reduce((acc: any, key: string) => {
		if (acc && typeof acc === "object") {
			return acc[key];
		}
		return undefined;
	}, obj);
}

const Accordion = {
	Prompt: "value",
	Model: "languageModel",
	Model_Config: "languageModelConfig",
	Json_Schema: "languageModelConfig.json_schema",
	Tools: "languageModelConfig.tools",
} as const;


const getChangedLinesStats = (a: string, b: string) => {
	const left = typeof a === "string" ? a : "";
	const right = typeof b === "string" ? b : "";
	const diff = diffLines(left, right);
	let added = 0;
	let removed = 0;
	diff.forEach((part) => {
		if (part.added) added += part.count || 0;
		if (part.removed) removed += part.count || 0;
	});
	return { added, removed };
};

const Compare = () => {
	const { id, orgId, projectId } = useParams();
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();

	const commitA = searchParams.get("commitA") || "";
	const commitB = searchParams.get("commitB") || "";
	const accordions = Object.entries(Accordion).map((it, ind) => [it[1], !ind]);
	const [open, setOpen] = useState<Record<string, boolean>>(Object.fromEntries(accordions));

	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

	const [branchesRes, setBranchesRes] = useState<BranchesResponse | undefined>(undefined);
	const [branchesLoading, setBranchesLoading] = useState(false);
	const [dataA, setDataA] = useState<any>(null);
	const [dataB, setDataB] = useState<any>(null);

	const fetchBranches = useCallback(async () => {
		if (!id) return;
		setBranchesLoading(true);
		try {
			const result = await promptApi.getBranches(id);
			const transformed: BranchesResponse = {
				branches: result.branches.map((branch: any) => ({
					...branch,
					promptVersions: branch.promptVersions.map((version: any) => ({
						...version,
						author: version.author || {
							id: 0,
							name: "Unknown",
							email: "",
							picture: "",
						},
					})),
				})),
			};
			setBranchesRes(transformed);
		} catch (err: any) {
			console.error("Failed to fetch branches", err);
		} finally {
			setBranchesLoading(false);
		}
	}, [id]);

	const fetchDataA = useCallback(async () => {
		if (!id) return;
		try {
			let result;
			if (!commitA || commitA === "current") {
				result = await promptApi.getPrompt(id);
			} else {
				result = await promptApi.getVersion(id, commitA);
			}
			setDataA(result);
		} catch (err: any) {
			console.error("Failed to fetch dataA", err);
		}
	}, [id, commitA]);

	const fetchDataB = useCallback(async () => {
		if (!id || !commitB) return;
		try {
			let result;
			if (commitB === "current") {
				result = await promptApi.getPrompt(id);
			} else {
				result = await promptApi.getVersion(id, commitB);
			}
			setDataB(result);
		} catch (err: any) {
			console.error("Failed to fetch dataB", err);
		}
	}, [id, commitB]);

	useEffect(() => {
		fetchBranches();
	}, [fetchBranches]);

	useEffect(() => {
		fetchDataA();
	}, [fetchDataA]);

	useEffect(() => {
		fetchDataB();
	}, [fetchDataB]);

	const versions = useMemo(
		() =>
			branchesRes?.branches.flatMap((b) =>
				b.promptVersions.map((v) => ({ ...v, branchName: b.name })),
			) ?? [],
		[branchesRes],
	);

	const sortedVersions = useMemo(
		() =>
			versions.sort(
				(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			),
		[versions],
	);

	const getInfo = (cid: string) => {
		if (cid === "current") {
			return { name: "Current prompt", author: "Not", date: "", branch: "current" };
		}
		const ver = versions.find((v) => v.id.toString() === cid);
		if (!ver) return null;
		return {
			name: ver.commitMsg,
			author: ver.author.name,
			date: formatDate(ver.createdAt),
			branch: ver.branchName,
		};
	};

	if (branchesLoading) return <p className="p-6">Loading...</p>;

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

				{!!dataA && !!dataB && (
					<div className="border rounded-lg px-6 py-3 flex-1 overflow-y-auto mb-20">
						{Object.entries(Accordion).map(([title, key]) => {
							const left = getByPath(
								!commitA || commitA === "current"
									? (dataA as any)?.prompt || dataA
									: (dataA as any)?.version || dataA,
								key,
							);
							const right = getByPath(
								commitB === "current"
									? (dataB as any)?.prompt || dataB
									: (dataB as any)?.version || dataB,
								key,
							);
							if (!left && !right) return null;

							if (key === "languageModelConfig.tools") {
								const isLeftEmpty = Array.isArray(left) && left.length === 0;
								const isRightEmpty = Array.isArray(right) && right.length === 0;
								if (isLeftEmpty && isRightEmpty) return null;
							}

							const changed =
								JSON.stringify(left, null, 2) !== JSON.stringify(right, null, 2);

							let leftValue = left;
							let rightValue = right;
							if (key === "languageModel") {
								const leftModel =
									left && typeof left === "object"
										? (left as {
												name?: string;
												vendor?: string;
												description?: string;
											})
										: undefined;
								const rightModel =
									right && typeof right === "object"
										? (right as {
												name?: string;
												vendor?: string;
												description?: string;
											})
										: undefined;
								leftValue = leftModel
									? JSON.stringify(
											{
												name: leftModel.name,
												vendor: leftModel.vendor,
											},
											null,
											2,
										)
									: left;
								rightValue = rightModel
									? JSON.stringify(
											{
												name: rightModel.name,
												vendor: rightModel.vendor,
											},
											null,
											2,
										)
									: right;
							}

							if (key === "languageModelConfig") {
								const stripJsonSchemaAndTools = (obj: any) => {
									if (!obj || typeof obj !== "object") return obj;
									const { ...rest } = obj
									return rest;
								};
								leftValue = stripJsonSchemaAndTools(leftValue);
								rightValue = stripJsonSchemaAndTools(rightValue);
							}

							if (key === "languageModelConfig.json_schema") {
								leftValue =
									typeof leftValue === "string"
										? parseJson(leftValue)
										: JSON.stringify(leftValue, null, 2);
								rightValue =
									typeof rightValue === "string"
										? parseJson(rightValue)
										: JSON.stringify(rightValue, null, 2);
							}

							const diffLanguage = key === "value" ? "markdown" : "json";

							const leftStr =
								typeof leftValue === "string"
									? leftValue
									: JSON.stringify(leftValue, null, 2);
							const rightStr =
								typeof rightValue === "string"
									? rightValue
									: JSON.stringify(rightValue, null, 2);
							const { added, removed } = changed
								? getChangedLinesStats(leftStr, rightStr)
								: { added: 0, removed: 0 };

							return (
								<Collapsible
									key={key}
									open={open[key]}
									onOpenChange={() =>
										setOpen((prev) => ({
											...prev,
											[key]: !prev[key],
										}))
									}
									className="rounded-lg"
								>
									<CollapsibleTrigger asChild>
										<div>
											<button type="button" className=" bg-transparent flex w-full items-center justify-between py-3 text-left">
												<span className="flex items-center gap-3 text-sm font-[500]">
													{title.replaceAll("_", " ")}
													{changed && (added > 0 || removed > 0) && (
														<span className="ml-2 flex items-center gap-3 text-xs">
															<span className="text-green-600">
																+{added}
															</span>
															<span className="text-red-500">
																-{removed}
															</span>
															<span className="text-muted-foreground">
																lines changed
															</span>
														</span>
													)}
												</span>
												<ChevronDown
													className={`h-4 w-4 transition-transform ${
														open[key] ? "rotate-180" : ""
													}`}
												/>
											</button>
										</div>
									</CollapsibleTrigger>
									<CollapsibleContent asChild>
										<div className="pb-3">
											<CompareDiffEditor
												className="DiffEditor border border-muted rounded-md"
												language={diffLanguage}
												theme={monacoTheme}
												maxHeight={600}
												options={{
													renderSideBySide: true,
													enableSplitViewResizing: false,
													readOnly: true,
													domReadOnly: true,
													originalEditable: false,
													useInlineViewWhenSpaceIsLimited: false,
													scrollBeyondLastLine: false,
													wordWrap: "on",
													automaticLayout: true,
													scrollbar: {
														vertical: "auto",
														horizontal: "auto",
														verticalScrollbarSize: 5,
													},
													glyphMargin: true,
													ignoreTrimWhitespace: false,
													lineNumbers: "on",
													contextmenu: false,
													lineNumbersMinChars: 1,
													lineDecorationsWidth: 10,
													renderOverviewRuler: true,
													renderIndicators: false,
													overviewRulerBorder: false,
													minimap: { enabled: false },
													folding: false,
													fontFamily: "Inter, sans-serif",
													fontSize: 14,
													renderGutterMenu: false,
													stickyScroll: {
														enabled: false,
													},
													padding: { top: 0, bottom: 0 },
													lineHeight: 18,
												}}
												original={leftStr}
												modified={rightStr}
											/>
										</div>
									</CollapsibleContent>
								</Collapsible>
							);
						})}
					</div>
				)}

				{!commitA && !commitB && (
					<p className="text-muted-foreground">Select two commits to compare</p>
				)}
			</div>
		</div>
	);
};

export default Compare;
