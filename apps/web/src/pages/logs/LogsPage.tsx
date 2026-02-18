import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LogsTable } from "../prompt/playground-tabs/logs/components/LogsTable";
import { LogsFilter } from "./components/LogsFilter";
import { LogDetailsDialog } from "@/pages/prompt/playground-tabs/logs/components/LogDetailsDialog";
import { useAddTestcaseFromLog } from "@/pages/prompt/playground-tabs/logs/hooks/useAddTestcaseFromLog";
import { useLogsFilters } from "@/pages/prompt/playground-tabs/logs/hooks/useLogsFilters";
import { useLogsPagination } from "@/pages/prompt/playground-tabs/logs/hooks/useLogsPagination";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";
import type { Log } from "@/types/logs";
import { useProjectLogsData } from "./hooks/useProjectLogsData";
import { useProjectPromptNames } from "./hooks/useProjectPromptNames";

export function LogsPage() {
	const { logsFilter, setLogsFilter, queryInput, handleQueryChange } = useLogsFilters();
	const { page, setPage, pageSize, getTotalPages, visiblePages, handlePageSizeChange } =
		useLogsPagination();

	const [selectedLog, setSelectedLog] = useState<Log | null>(null);
	const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);
	const [isInputExpanded, setIsInputExpanded] = useState(false);
	const [isOutputExpanded, setIsOutputExpanded] = useState(false);

	const selectedPromptId = useMemo(
		() => selectedLog?.prompt_id || logsFilter.promptId,
		[selectedLog?.prompt_id, logsFilter.promptId],
	);

	const { logs, total, memoriesData, isFetchingLogs, isLogsError, refetchLogs } =
		useProjectLogsData({
			page,
			pageSize,
			logsFilter,
			selectedPromptId,
			shouldFetchMemories: isLogDetailsOpen,
		});
	const { promptNames, refetchPromptNames } = useProjectPromptNames();

	const { handleAddTestcaseFromLog, creatingTestcase } = useAddTestcaseFromLog({
		promptId: selectedPromptId,
		selectedLog,
		memoriesData,
	});

	useEffect(() => {
		if (logsFilter.query !== undefined) {
			setPage(1);
		}
	}, [logsFilter.query, setPage]);

	useRefetchOnWorkspaceChange(() => {
		setPage(1);
		void refetchLogs();
		void refetchPromptNames();
	});
	const totalPages = getTotalPages(total);
	const pagesToRender = visiblePages(total);

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

	return (
		<div className="space-y-6 pt-8 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full text-foreground">
			<LogsFilter
				filter={logsFilter}
				setFilter={setLogsFilter}
				promptNames={promptNames}
				showQueryField={true}
				queryInput={queryInput}
				onQueryChange={handleQueryChange}
			/>
			<div className="w-full">
				{isLogsError ? (
					<div className="mb-2 text-sm text-destructive">
						Failed to load logs. Please try again.
					</div>
				) : null}
				<LogsTable
					logs={logs}
					promptNames={promptNames}
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
								Prev
							</Button>
							{pagesToRender.map((p) => (
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
				promptNames={promptNames}
				isSinglePromptPage={false}
			/>
		</div>
	);
}
