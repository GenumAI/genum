"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { promptApi } from "@/api/prompt";
import { useCreateTestcase } from "@/hooks/useCreateTestcase";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import type { LogsFilterState } from "@/pages/logs/LogsFilter";
import { LogsFilter } from "@/pages/logs/LogsFilter";
import { LogDetailsDialog } from "@/components/dialogs/LogDetailsDialog";
import { useQueryClient } from "@tanstack/react-query";

import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";

interface Log {
	log_lvl: string;
	timestamp: string;
	source: string;
	vendor: string;
	model: string;
	tokens_sum: number;
	cost: number;
	response_ms: number;
	description?: string;
	tokens_in?: number;
	tokens_out?: number;
	in?: string;
	out?: string;
	log_type?: string;
	user_name?: string;
	memory_key?: string;
	api?: string;
	prompt_id?: number;
}

interface LogsResponse {
	logs: Log[];
	total: number;
}

export default function LogsTable() {
	const [pageSize, setPageSize] = useState(10);
	const [page, setPage] = useState(1);

	const [selectedLog, setSelectedLog] = useState<Log | null>(null);
	const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);

	const [isInputExpanded, setIsInputExpanded] = useState(false);
	const [isOutputExpanded, setIsOutputExpanded] = useState(false);

	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;

	const today = new Date();
	const twoWeeksAgo = new Date();
	twoWeeksAgo.setDate(today.getDate() - 14);

	const [queryInput, setQueryInput] = useState<string>("");
	const [logsFilter, setLogsFilter] = useState<LogsFilterState>({
		dateRange: {
			from: twoWeeksAgo,
			to: today,
		},
		logLevel: undefined,
		model: undefined,
		source: undefined,
		query: undefined,
	});

	// Debounce query input
	useEffect(() => {
		const timer = setTimeout(() => {
			setLogsFilter((prev) => ({ ...prev, query: queryInput.trim() || undefined }));
		}, 250);

		return () => {
			clearTimeout(timer);
		};
	}, [queryInput]);

	const handleLogClick = (log: Log) => {
		setSelectedLog(log);
		setIsLogDetailsOpen(true);
	};

	const timeAgo = (s: string) => {
		const diff = Date.now() - new Date(s).getTime();
		const m = 60e3,
			h = 60 * m,
			d = 24 * h;
		if (diff >= d) return `${Math.floor(diff / d)} day(s) ago`;
		if (diff >= h) return `${Math.floor(diff / h)} hour(s) ago`;
		if (diff >= m) return `${Math.floor(diff / m)} minute(s) ago`;
		return "just now";
	};

	// Fetch Logs
	const [data, setData] = useState<LogsResponse | undefined>(undefined);
	const [isFetching, setIsFetching] = useState(false);
	const [isError, setIsError] = useState(false);

	const fetchLogs = useCallback(async () => {
		if (!promptId) return;
		setIsFetching(true);
		setIsError(false);
		try {
			const params: any = {
				page,
				pageSize,
			};
			if (logsFilter.dateRange?.from)
				params.fromDate = logsFilter.dateRange.from.toISOString();
			if (logsFilter.dateRange?.to) params.toDate = logsFilter.dateRange.to.toISOString();
			if (logsFilter.logLevel) params.logLevel = logsFilter.logLevel;
			if (logsFilter.model) params.model = logsFilter.model;
			if (logsFilter.source) params.source = logsFilter.source;
			if (logsFilter.query) params.query = logsFilter.query;

			const result = await promptApi.getLogs(promptId, params);
			setData(result);
		} catch (err) {
			setIsError(true);
			console.error("Failed to fetch logs", err);
		} finally {
			setIsFetching(false);
		}
	}, [promptId, page, pageSize, logsFilter]);

	// Fetch Memories
	const [memoriesData, setMemoriesData] = useState<
		| {
				memories: Array<{ id: number; key: string }>;
		  }
		| undefined
	>(undefined);

	const fetchMemories = useCallback(async () => {
		if (!promptId) return;
		try {
			const result = await promptApi.getMemories(promptId);
			setMemoriesData(result);
		} catch (err) {
			console.error("Failed to fetch memories", err);
		}
	}, [promptId]);

	useEffect(() => {
		fetchLogs();
	}, [fetchLogs]);

	useEffect(() => {
		fetchMemories();
	}, [fetchMemories]);

	useEffect(() => {
		if (logsFilter.query !== undefined) {
			setPage(1);
		}
	}, [logsFilter.query]);

	const handleQueryChange = (value: string) => {
		setQueryInput(value);
	};

	const logs = data?.logs ?? [];
	const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));

	const visiblePages = useMemo(() => {
		if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
		if (page <= 3) return [1, 2, 3, 4, 5];
		if (page >= totalPages - 2) return Array.from({ length: 5 }, (_, i) => totalPages - 4 + i);
		return [page - 2, page - 1, page, page + 1, page + 2];
	}, [page, totalPages]);

	const handlePrevPage = () => {
		if (page > 1) setPage((p) => p - 1);
	};

	const handleNextPage = () => {
		if (page < totalPages) setPage((p) => p + 1);
	};

	const handlePageSizeChange = (value: string) => {
		setPageSize(Number(value));
		setPage(1); // Reset to first page when changing page size
	};

	const { toast } = useToast();
	const { createTestcase, loading: creatingTestcase } = useCreateTestcase();
	const queryClient = useQueryClient();

	const handleAddTestcaseFromLog = async () => {
		if (!selectedLog || !promptId) return;

		try {
			// Find memoryId by memory_key if it exists
			let memoryId: number | null = null;
			if (selectedLog.memory_key && memoriesData?.memories) {
				const memory = memoriesData.memories.find((m) => m.key === selectedLog.memory_key);
				if (memory) {
					memoryId = memory.id;
				}
			}

			const ok = await createTestcase({
				promptId: Number(promptId),
				input: selectedLog.in || "",
				expectedOutput: selectedLog.out || "",
				lastOutput: selectedLog.out || "",
				memoryId: memoryId || null,
			});
			if (ok) {
				toast({
					title: "Testcase added",
					description: "Testcase was created from log.",
					variant: "default",
				});
				if (promptId) {
					queryClient.invalidateQueries({
						queryKey: ["prompt-testcases", Number(promptId)],
					});
					queryClient.invalidateQueries({
						queryKey: ["testcase-status-counts", promptId],
					});
				}
			} else {
				toast({
					title: "Failed to add testcase",
					description: "Could not create testcase from log.",
					variant: "destructive",
				});
			}
		} catch (err: any) {
			toast({
				title: "Error",
				description: err.message || "Unknown error",
				variant: "destructive",
			});
		}
	};

	return (
		<div className="max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full bg-background text-foreground py-8">
			<div className="pb-6">
				<LogsFilter
					filter={logsFilter}
					setFilter={setLogsFilter}
					promptNames={[]}
					showQueryField={true}
					queryInput={queryInput}
					onQueryChange={handleQueryChange}
				/>
			</div>

			<div className="w-full overflow-auto">
				{isError ? (
					<div className="p-6 text-center text-destructive">Can't find logs</div>
				) : isFetching && (data?.logs?.length === 0 || !data) ? (
					<div className="p-6 text-center text-muted-foreground">Loading...</div>
				) : (
					<TooltipProvider>
						<table className="w-full text-sm border border-border rounded-md overflow-hidden">
							<thead className="bg-muted text-muted-foreground">
								<tr>
									{[
										{ label: "Status", width: "50px" },
										{ label: "Timestamp", width: "auto" },
										{ label: "Source", width: "auto" },
										{ label: "Vendor", width: "auto" },
										{ label: "Model", width: "auto" },
										{ label: "Total Tokens", width: "auto" },
										{ label: "Cost", width: "auto" },
										{ label: "Response", width: "auto" },
										{ label: "Occurred", width: "auto" },
									].map((h) => (
										<th
											key={h.label}
											className="h-12 px-4 text-center font-medium"
											style={{ width: h.width }}
										>
											{h.label}
										</th>
									))}
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{logs.length ? (
									logs.map((log, i) => {
										const hasErrorDescription =
											log.log_lvl === "ERROR" && log.description;

										return (
											<Tooltip key={`${log.timestamp}-${i}`}>
												<TooltipTrigger asChild>
													<tr
														className={`cursor-pointer transition-colors ${
															log.log_lvl === "ERROR"
																? "bg-red-50 hover:bg-red-100 dark:bg-[#3c292a]"
																: "hover:bg-muted/60"
														}`}
														onClick={() => handleLogClick(log)}
													>
														<td
															className="p-4 text-center"
															style={{ width: "50px" }}
														>
															{log.log_lvl === "SUCCESS" ? (
																<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-[#2da44a] mx-auto" />
															) : (
																<XCircle className="h-4 w-4 text-destructive dark:text-[#d74746] mx-auto" />
															)}
														</td>
														<td className="p-4 text-center">
															{formatUserLocalDateTime(log.timestamp)}
														</td>
														<td className="p-4 text-center capitalize">
															{log.source === "ui"
																? "UI"
																: log.source}
														</td>
														<td className="p-4 text-center">
															{log.vendor}
														</td>
														<td className="p-4 text-center">
															{log.model}
														</td>
														<td className="p-4 text-center">
															{log.tokens_sum}
														</td>
														<td className="p-4 text-center">
															${log.cost.toFixed(6)}
														</td>
														<td className="p-4 text-center">
															{Math.round(log.response_ms)} ms
														</td>
														<td className="p-4 text-center">
															{timeAgo(log.timestamp)}
														</td>
													</tr>
												</TooltipTrigger>
												{hasErrorDescription && (
													<TooltipContent
														side="top"
														align="start"
														showArrow={false}
														className="max-w-[344px] mb-[-25px] ml-[20%]"
													>
														<div className="space-y-1">
															<h3 className="text-sm font-semibold">
																Error Description
															</h3>
															<p className="text-sm text-[#FFFFFF]">
																{log.description}
															</p>
														</div>
													</TooltipContent>
												)}
											</Tooltip>
										);
									})
								) : (
									<tr>
										<td colSpan={9} className="pt-6 text-center">
											{isFetching ? (
												<span className="text-muted-foreground">
													Loading...
												</span>
											) : (
												<EmptyState
													title="No logs"
													description="No logs found for the selected filters."
												/>
											)}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</TooltipProvider>
				)}

				<div className="w-full flex items-center justify-between px-0 py-3 mt-4">
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">
							Page {page} / {totalPages}
						</span>
					</div>
					<div className="flex items-center gap-4">
						<span className="text-[14px] text-muted-foreground">Rows:</span>
						<Select value={String(pageSize)} onValueChange={handlePageSizeChange}>
							<SelectTrigger className="w-16 h-8 text-xs px-2">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="10">10</SelectItem>
								<SelectItem value="20">20</SelectItem>
								<SelectItem value="50">50</SelectItem>
								<SelectItem value="100">100</SelectItem>
							</SelectContent>
						</Select>
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								disabled={page === 1}
								onClick={handlePrevPage}
								className="h-9"
							>
								<ChevronLeft className="h-4 w-4 mr-1" />
								Prev
							</Button>

							{visiblePages.map((p) => (
								<Button
									key={p}
									variant={p === page ? "default" : "outline"}
									size="icon"
									onClick={() => setPage(p)}
									aria-current={p === page ? "page" : undefined}
								>
									{p}
								</Button>
							))}

							<Button
								variant="outline"
								size="sm"
								disabled={page >= totalPages}
								onClick={handleNextPage}
								className="h-9"
							>
								Next
								<ChevronRight className="h-4 w-4 ml-1" />
							</Button>
						</div>
					</div>
				</div>
			</div>

			<LogDetailsDialog
				open={isLogDetailsOpen}
				onOpenChange={setIsLogDetailsOpen}
				selectedLog={selectedLog}
				isInputExpanded={isInputExpanded}
				setIsInputExpanded={setIsInputExpanded}
				isOutputExpanded={isOutputExpanded}
				setIsOutputExpanded={setIsOutputExpanded}
				handleAddTestcaseFromLog={handleAddTestcaseFromLog}
				creatingTestcase={creatingTestcase}
				promptNames={[]}
				isSinglePromptPage={true}
			/>
		</div>
	);
}
