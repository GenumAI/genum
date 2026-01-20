import React, { useState, useCallback, useRef } from "react";
import { LogsTable, Log } from "./LogsTable";
import { useQueryClient } from "@tanstack/react-query";

import { LogsFilter, LogsFilterState } from "./LogsFilter";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { useCreateTestcase } from "@/hooks/useCreateTestcase";
import { LogDetailsDialog } from "@/components/dialogs/LogDetailsDialog";
import { useParams } from "react-router-dom";
import { promptApi } from "@/api/prompt";
import { projectApi } from "@/api/project";

export interface PromptName {
	id: number;
	name: string;
}

const today = new Date();
const monthAgo = new Date();
monthAgo.setMonth(today.getMonth() - 1);

export function LogsPage() {
	const { orgId, projectId } = useParams<{
		orgId: string;
		projectId: string;
	}>();
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);
	const [queryInput, setQueryInput] = useState<string>("");
	const [filter, setFilter] = useState<LogsFilterState>({
		dateRange: {
			from: monthAgo,
			to: today,
		},
		logLevel: "all",
		model: "all",
		source: undefined,
		promptId: undefined,
		query: undefined,
	});

	React.useEffect(() => {
		const timer = setTimeout(() => {
			setFilter((prev) => ({
				...prev,
				query: queryInput.trim() || undefined,
			}));
		}, 250);

		return () => {
			clearTimeout(timer);
		};
	}, [queryInput]);
	const [selectedLog, setSelectedLog] = useState<Log | null>(null);
	const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);
	const [isInputExpanded, setIsInputExpanded] = useState(false);
	const [isOutputExpanded, setIsOutputExpanded] = useState(false);

	const { toast } = useToast();
	const { createTestcase, loading: creatingTestcase } = useCreateTestcase();
	const queryClient = useQueryClient();

	React.useEffect(() => {
		setPage(1);
	}, [orgId, projectId]);

	React.useEffect(() => {
		if (filter.query !== undefined) {
			setPage(1);
		}
	}, [filter.query]);

	const handleQueryChange = (value: string) => {
		setQueryInput(value);
	};

	const [logsData, setLogsData] = useState<
		| {
				logs: Log[];
				total: number;
		  }
		| undefined
	>(undefined);
	const [isFetchingLogs, setIsFetchingLogs] = useState(false);
	const [logsError, setLogsError] = useState<Error | null>(null);
	const logsRequestIdRef = useRef(0);

	const fetchLogs = useCallback(async () => {
		const requestId = ++logsRequestIdRef.current;
		setIsFetchingLogs(true);
		setLogsError(null);
		try {
			const data = await projectApi.getLogs({
				page,
				pageSize,
				fromDate: filter.dateRange?.from ? filter.dateRange.from.toISOString() : undefined,
				toDate: filter.dateRange?.to ? filter.dateRange.to.toISOString() : undefined,
				logLevel:
					filter.logLevel && filter.logLevel !== "all" ? filter.logLevel : undefined,
				model: filter.model && filter.model !== "all" ? filter.model : undefined,
				source: filter.source || undefined,
				promptId: filter.promptId || undefined,
				query: filter.query || undefined,
			});

			if (requestId === logsRequestIdRef.current) {
				setLogsData({ logs: data.logs as unknown as Log[], total: data.total });
			}
		} catch (err) {
			if (requestId === logsRequestIdRef.current) {
				setLogsError(err as Error);
			}
		} finally {
			if (requestId === logsRequestIdRef.current) {
				setIsFetchingLogs(false);
			}
		}
	}, [page, pageSize, filter]);

	React.useEffect(() => {
		void fetchLogs();
	}, [fetchLogs]);

	const [promptsData, setPromptsData] = useState<
		| {
				prompts: PromptName[];
		  }
		| undefined
	>(undefined);
	const promptsRequestIdRef = useRef(0);
	React.useEffect(() => {
		const fetchPrompts = async () => {
			const requestId = ++promptsRequestIdRef.current;
			try {
				const data = await promptApi.getPrompts();
				if (requestId === promptsRequestIdRef.current) {
					setPromptsData(data);
				}
			} catch {}
		};
		void fetchPrompts();
	}, [orgId, projectId]);

	const promptId = selectedLog?.prompt_id || filter.promptId;

	const [memoriesData, setMemoriesData] = useState<
		| {
				memories: Array<{
					id: number;
					key: string;
				}>;
		  }
		| undefined
	>(undefined);
	const memoriesRequestIdRef = useRef(0);
	React.useEffect(() => {
		const fetchMemories = async () => {
			if (!promptId) {
				setMemoriesData(undefined);
				return;
			}
			const requestId = ++memoriesRequestIdRef.current;
			try {
				const data = await promptApi.getMemories(promptId);
				if (requestId === memoriesRequestIdRef.current) {
					setMemoriesData(data);
				}
			} catch {
				if (requestId === memoriesRequestIdRef.current) {
					setMemoriesData(undefined);
				}
			}
		};
		void fetchMemories();
	}, [promptId]);
	const total = logsData?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const visiblePages = React.useMemo(() => {
		if (totalPages <= 5)
			return Array.from(
				{
					length: totalPages,
				},
				(_, i) => i + 1,
			);

		if (page <= 3) return [1, 2, 3, 4, 5];

		if (page >= totalPages - 2)
			return Array.from(
				{
					length: 5,
				},
				(_, i) => totalPages - 4 + i,
			);

		return [page - 2, page - 1, page, page + 1, page + 2];
	}, [page, totalPages]);

	const handlePrevPage = () => {
		if (page > 1) setPage(page - 1);
	};
	const handleNextPage = () => {
		if (page < totalPages) setPage(page + 1);
	};

	const handleLogClick = (log: Log) => {
		setSelectedLog(log);
		setIsLogDetailsOpen(true);
		setIsInputExpanded(false);
		setIsOutputExpanded(false);
	};

	const handleAddTestcaseFromLog = async () => {
		if (!selectedLog || !selectedLog.prompt_id) return;

		try {
			let memoryId: number | null = null;
			if (selectedLog.memory_key && memoriesData?.memories) {
				const memory = memoriesData.memories.find((m) => m.key === selectedLog.memory_key);
				if (memory) {
					memoryId = memory.id;
				}
			}

			const ok = await createTestcase({
				promptId: Number(selectedLog.prompt_id),
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
				queryClient.invalidateQueries({
					queryKey: ["prompt-testcases", Number(selectedLog.prompt_id)],
				});
				queryClient.invalidateQueries({
					queryKey: ["testcase-status-counts", Number(selectedLog.prompt_id)],
				});
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
		<div className="space-y-6 pt-8 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full text-foreground">
			<LogsFilter
				filter={filter}
				setFilter={setFilter}
				promptNames={promptsData?.prompts || []}
				showQueryField={true}
				queryInput={queryInput}
				onQueryChange={handleQueryChange}
			/>
			<div className="w-full">
				{logsError ? (
					<div className="mb-2 text-sm text-destructive">
						Failed to load logs. Please try again.
					</div>
				) : null}
				<LogsTable
					logs={logsData?.logs || []}
					promptNames={promptsData?.prompts || []}
					isFetching={isFetchingLogs}
					onLogClick={handleLogClick}
				/>
				<div className="w-full flex items-center justify-between px-0 py-3 mt-4">
					<div className="flex items-center gap-3">
						<span className="text-sm text-muted-foreground">
							Page {page}/ {totalPages}{" "}
						</span>
					</div>
					<div className="flex items-center gap-4">
						<span className="text-[14px] text-muted-foreground">Rows:</span>
						<Select
							value={String(pageSize)}
							onValueChange={(value) => {
								setPageSize(Number(value));
								setPage(1);
							}}
						>
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
								Prev
							</Button>
							{visiblePages.map((p) => (
								<Button
									key={p}
									variant={p === page ? "default" : "outline"}
									size="icon"
									onClick={() => setPage(p)}
								>
									{p}{" "}
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
				promptNames={promptsData?.prompts || []}
				isSinglePromptPage={false}
			/>
		</div>
	);
}
