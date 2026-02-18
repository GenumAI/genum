import { memo } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";
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

type Column = { label: string; width: number };

function LogsTableComponent({
	logs,
	isFetching,
	onLogClick,
	showPromptColumn = true,
	promptNames = [],
}: LogsTableProps) {
	const columns: Column[] = showPromptColumn
		? [
				{ label: "Status", width: 50 },
				{ label: "Timestamp", width: 170 },
				{ label: "Source", width: 100 },
				{ label: "Vendor", width: 100 },
				{ label: "Model", width: 140 },
				{ label: "Prompt", width: 180 },
				{ label: "Total Tokens", width: 110 },
				{ label: "Cost", width: 90 },
				{ label: "Response", width: 80 },
				{ label: "Occurred", width: 120 },
			]
		: [
				{ label: "Status", width: 50 },
				{ label: "Timestamp", width: 170 },
				{ label: "Source", width: 100 },
				{ label: "Vendor", width: 100 },
				{ label: "Model", width: 160 },
				{ label: "Total Tokens", width: 110 },
				{ label: "Cost", width: 90 },
				{ label: "Response", width: 80 },
				{ label: "Occurred", width: 120 },
			];

	return (
		<TooltipProvider>
			<table className="w-full text-sm border border-border rounded-[6px] overflow-hidden bg-card text-card-foreground">
				<thead className="bg-muted h-[52.5px]">
					<tr>
						{columns.map((column) => (
							<th
								key={column.label}
								className="h-12 px-4 font-medium text-center text-muted-foreground whitespace-nowrap"
								style={{
									width: column.width,
									minWidth: column.width,
									maxWidth: column.width,
								}}
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
											<td className="p-4 text-center" style={{ width: 50 }}>
												{log.log_lvl === "SUCCESS" ? (
													<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-[#2da44a] mx-auto" />
												) : (
													<XCircle className="h-4 w-4 text-destructive dark:text-[#d74746] mx-auto" />
												)}
											</td>

											<td className="p-4 text-center" style={{ width: 170 }}>
												{formatUserLocalDateTime(log.timestamp)}
											</td>

											<td
												className="p-4 text-center capitalize"
												style={{ width: 100 }}
											>
												{log.source === "ui" ? "UI" : log.source}
											</td>

											<td className="p-4 text-center" style={{ width: 100 }}>
												{normalizeVendorName(log.vendor)}
											</td>

											<td
												className="p-4 text-center truncate"
												style={{ width: showPromptColumn ? 140 : 160 }}
												title={log.model}
											>
												{modelDisplay}
											</td>

											{showPromptColumn && (
												<td
													className="p-4 text-center truncate"
													style={{ width: 180 }}
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

											<td className="p-4 text-center" style={{ width: 110 }}>
												{log.tokens_sum}
											</td>

											<td
												className="p-4 text-center tabular-nums"
												style={{ width: 90 }}
											>
												${log.cost.toFixed(6)}
											</td>

											<td className="p-4 text-center" style={{ width: 80 }}>
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

											<td className="p-4 text-center" style={{ width: 120 }}>
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
