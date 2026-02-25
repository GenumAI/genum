import { memo } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";
import { cn } from "@/lib/utils";
import type { Log, PromptName } from "@/types/logs";
import { timeAgo } from "@/components/logs/utils/timeAgo";
import { getPromptName, isPromptDeleted } from "../utils/promptNames";
import { normalizeVendorName, formatResponseTime } from "../utils/logDetailsHelpers";

interface LogsTableProps {
	logs: Log[];
	isFetching: boolean;
	onLogClick: (log: Log) => void;
	showPromptColumn?: boolean;
	promptNames?: PromptName[];
}

type Column = { label: string; className?: string };

function LogsTableComponent({
	logs,
	isFetching,
	onLogClick,
	showPromptColumn = true,
	promptNames = [],
}: LogsTableProps) {
	const columns: Column[] = showPromptColumn
		? [
				{ label: "Status", className: "w-12" },
				{ label: "Timestamp", className: "w-[180px]" },
				{ label: "Source", className: "hidden lg:table-cell" },
				{ label: "Vendor", className: "hidden lg:table-cell" },
				{ label: "Model", className: "w-[180px]" },
				{ label: "Prompt", className: "hidden xl:table-cell" },
				{ label: "Total Tokens", className: "hidden xl:table-cell" },
				{ label: "Cost", className: "hidden md:table-cell" },
				{ label: "Response", className: "hidden sm:table-cell" },
				{ label: "Occurred", className: "hidden sm:table-cell" },
			]
		: [
				{ label: "Status", className: "w-12" },
				{ label: "Timestamp", className: "w-[180px]" },
				{ label: "Source", className: "hidden lg:table-cell" },
				{ label: "Vendor", className: "hidden lg:table-cell" },
				{ label: "Model", className: "w-[180px]" },
				{ label: "Total Tokens", className: "hidden xl:table-cell" },
				{ label: "Cost", className: "hidden md:table-cell" },
				{ label: "Response", className: "hidden sm:table-cell" },
				{ label: "Occurred", className: "hidden sm:table-cell" },
			];

	return (
		<TooltipProvider>
			<table className="w-full table-fixed text-sm border border-border rounded-[6px] overflow-hidden bg-card text-card-foreground">
				<thead className="bg-muted h-[52.5px]">
					<tr>
						{columns.map((column) => (
							<th
								key={column.label}
								className={cn(
									"h-12 px-3 font-medium text-center text-muted-foreground whitespace-nowrap",
									column.className,
								)}
							>
								{column.label}
							</th>
						))}
					</tr>
				</thead>
				<tbody className="divide-y divide-border">
					{logs.length ? (
						logs.map((log, index) => {
							const hasErrorDescription = log.log_lvl === "ERROR" && log.description;
							const modelDisplay =
								showPromptColumn && log.model.length > 18
									? `${log.model.slice(0, 18)}...`
									: log.model;
							const promptName = getPromptName(log.prompt_id, promptNames);
							const promptDeleted = isPromptDeleted(log.prompt_id, promptNames);
							const promptDisplay = promptDeleted
								? `Prompt ${log.prompt_id}`
								: promptName.length > 18
									? `${promptName.slice(0, 18)}...`
									: promptName;

							return (
								<Tooltip key={`${log.timestamp}-${index}`}>
									<TooltipTrigger asChild>
										<tr
											className={`cursor-pointer transition-colors ${
												log.log_lvl === "ERROR"
													? "bg-red-50 hover:bg-red-100 dark:bg-[#3c292a]"
													: "hover:bg-muted/50"
											}`}
											onClick={() => onLogClick(log)}
										>
											<td className="w-12 p-3 text-center">
												{log.log_lvl === "SUCCESS" ? (
													<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-[#2da44a] mx-auto" />
												) : (
													<XCircle className="h-4 w-4 text-destructive dark:text-[#d74746] mx-auto" />
												)}
											</td>

											<td className="w-[180px] p-3 text-center whitespace-nowrap text-xs sm:text-sm">
												{formatUserLocalDateTime(log.timestamp)}
											</td>

											<td className="hidden lg:table-cell p-3 text-center capitalize truncate">
												{log.source === "ui" ? "UI" : log.source}
											</td>

											<td className="hidden lg:table-cell p-3 text-center truncate">
												{normalizeVendorName(log.vendor)}
											</td>

											<td className="w-[180px] p-3 text-center truncate" title={log.model}>
												{modelDisplay}
											</td>

											{showPromptColumn && (
												<td
													className="hidden xl:table-cell p-3 text-center truncate"
													title={promptName}
												>
													{promptDeleted ? (
														<Tooltip>
															<TooltipTrigger asChild>
																<span className="text-destructive">
																	{promptDisplay}
																</span>
															</TooltipTrigger>
															<TooltipContent>
																<p>Prompt was deleted</p>
															</TooltipContent>
														</Tooltip>
													) : (
														promptDisplay
													)}
												</td>
											)}

											<td className="hidden xl:table-cell p-3 text-center">
												{log.tokens_sum}
											</td>

											<td className="hidden md:table-cell p-3 text-center tabular-nums">
												${log.cost.toFixed(6)}
											</td>

											<td className="hidden sm:table-cell p-3 text-center whitespace-nowrap">
												<Tooltip>
													<TooltipTrigger asChild>
														<span>
															{formatResponseTime(log.response_ms)}
														</span>
													</TooltipTrigger>
													<TooltipContent>
														<p>{Math.round(log.response_ms)} ms</p>
													</TooltipContent>
												</Tooltip>
											</td>

											<td className="hidden sm:table-cell p-3 text-center whitespace-nowrap">
												{timeAgo(log.timestamp)}
											</td>
										</tr>
									</TooltipTrigger>

									{hasErrorDescription && (
										<TooltipContent
											side="top"
											align="start"
											showArrow={false}
											className="max-w-[364px] p-4 bg-popover text-popover-foreground border border-border shadow-lg rounded-lg mb-[-50px] ml-[20%]"
										>
											<div className="space-y-2">
												<h3 className="text-sm font-semibold">
													Error Description
												</h3>
												<p className="text-sm dark:text-[#FFFFFF]">
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
							<td colSpan={columns.length} className="pt-6 text-center">
								{isFetching ? (
									<span className="text-muted-foreground">Loading...</span>
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
	);
}

export const LogsTable = memo(LogsTableComponent);
