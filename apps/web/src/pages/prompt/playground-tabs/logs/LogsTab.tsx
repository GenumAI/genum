"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { LogsFilter } from "@/pages/logs/components/LogsFilter";
import { LogDetailsDialog } from "@/pages/prompt/playground-tabs/logs/components/LogDetailsDialog";
import { LogsTable } from "./components/LogsTable";
import { useLogsData } from "./hooks/useLogsData";
import { useLogsFilters } from "./hooks/useLogsFilters";
import { useLogsPagination } from "./hooks/useLogsPagination";
import { useAddTestcaseFromLog } from "./hooks/useAddTestcaseFromLog";
import type { Log } from "@/types/logs";

export default function LogsTab() {
	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;

	const { logsFilter, setLogsFilter, queryInput, handleQueryChange } = useLogsFilters();
	const { page, setPage, pageSize, getTotalPages, visiblePages, handlePageSizeChange } =
		useLogsPagination();

	const [selectedLog, setSelectedLog] = useState<Log | null>(null);
	const [isLogDetailsOpen, setIsLogDetailsOpen] = useState(false);
	const [isInputExpanded, setIsInputExpanded] = useState(false);
	const [isOutputExpanded, setIsOutputExpanded] = useState(false);

	const { logs, total, memoriesData, isInitialLoadingLogs, isLogsError } = useLogsData({
		promptId,
		page,
		pageSize,
		logsFilter,
		shouldFetchMemories: isLogDetailsOpen,
	});

	const { handleAddTestcaseFromLog, creatingTestcase } = useAddTestcaseFromLog({
		promptId,
		selectedLog,
		memoriesData,
	});

	useEffect(() => {
		if (logsFilter.query !== undefined) {
			setPage(1);
		}
	}, [logsFilter.query, setPage]);

	const totalPages = getTotalPages(total);
	const pagesToRender = visiblePages(total);

	const handlePrevPage = () => {
		if (page > 1) setPage((prev) => prev - 1);
	};

	const handleNextPage = () => {
		if (page < totalPages) setPage((prev) => prev + 1);
	};

	const handleLogClick = useCallback((log: Log) => {
		setSelectedLog(log);
		setIsLogDetailsOpen(true);
		setIsInputExpanded(false);
		setIsOutputExpanded(false);
	}, []);

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
				{isLogsError ? (
					<div className="p-6 text-center text-destructive">Can't find logs</div>
				) : null}

				<LogsTable
					logs={logs}
					isFetching={isInitialLoadingLogs}
					onLogClick={handleLogClick}
					showPromptColumn={false}
				/>

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

							{pagesToRender.map((value) => (
								<Button
									key={value}
									variant={value === page ? "default" : "outline"}
									size="icon"
									onClick={() => setPage(value)}
									aria-current={value === page ? "page" : undefined}
								>
									{value}
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
