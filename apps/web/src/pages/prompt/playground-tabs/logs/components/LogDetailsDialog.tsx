import { memo, useCallback, useEffect, useMemo, useState } from "react";
import type { FC } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import MonacoEditor from "@/components/ui/MonacoEditor";
import { parseJson } from "@/lib/jsonUtils";
import { CheckCircle2, XCircle } from "lucide-react";
import { Eye, EyeClosed, CornersOut } from "phosphor-react";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";
import AIPreview from "@/pages/prompt/playground-tabs/playground/components/input-textarea/components/AIPreview";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/useToast";
import type { Log, PromptName } from "@/types/logs";
import { getPromptName, isPromptDeleted } from "../utils/promptNames";
import { getLogTypeDescription, getSourceLabel, normalizeVendorName, formatResponseTime } from "../utils/logDetailsHelpers";
import {
	EXPAND_ICON_STYLE,
	EYE_ICON_STYLE,
	EYE_ICON_STYLE_SMALL,
	READONLY_EDITOR_OPTIONS,
	READONLY_EDITOR_WITH_LINE_NUMBERS_OPTIONS,
} from "../utils/logDetailsEditorConfig";

interface LogDetailsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedLog: Log | null;
	isInputExpanded: boolean;
	setIsInputExpanded: (v: boolean) => void;
	isOutputExpanded: boolean;
	setIsOutputExpanded: (v: boolean) => void;
	handleAddTestcaseFromLog: () => void;
	creatingTestcase: boolean;
	promptNames: PromptName[];
	isSinglePromptPage?: boolean;
}


const LogDetailsDialogComponent: FC<LogDetailsDialogProps> = ({
	open,
	onOpenChange,
	selectedLog,
	isInputExpanded,
	setIsInputExpanded,
	isOutputExpanded,
	setIsOutputExpanded,
	handleAddTestcaseFromLog,
	creatingTestcase,
	promptNames,
	isSinglePromptPage = false,
}) => {
	const [isInputPreviewMode, setIsInputPreviewMode] = useState(false);
	const { toast } = useToast();

	// Reset preview mode when main dialog closes
	useEffect(() => {
		if (!open) {
			setIsInputPreviewMode(false);
		}
	}, [open]);

	const parsedInput = useMemo(() => parseJson(selectedLog?.in || ""), [selectedLog?.in]);
	const parsedOutput = useMemo(() => parseJson(selectedLog?.out || ""), [selectedLog?.out]);
	const promptName = useMemo(
		() => getPromptName(selectedLog?.prompt_id, promptNames),
		[selectedLog?.prompt_id, promptNames],
	);

	const isPromptDeletedForCurrentLog = useMemo(() => {
		return isSinglePromptPage ? false : isPromptDeleted(selectedLog?.prompt_id, promptNames);
	}, [isSinglePromptPage, promptNames, selectedLog?.prompt_id]);
	const handlePreviewError = useCallback(
		(error: string) => {
			toast({
				title: "Preview Error",
				description: error,
				variant: "destructive",
			});
		},
		[toast],
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-x-hidden overflow-y-auto">
				<div className="flex items-center justify-between">
					<DialogTitle className="text-[18px] font-semibold">Log Details</DialogTitle>
				</div>
				{selectedLog && (
					<div>
						<div className="border rounded-[6px]">
							<table className="w-full border-collapse border rounded-lg overflow-hidden text-sm">
								<tbody>
									<tr>
										<td className="bg-muted p-4 border font-medium text-foreground w-1/4">
											Timestamp
										</td>
										<td
											className="p-4 border w-1/4"
											title={selectedLog.timestamp}
										>
											{formatUserLocalDateTime(selectedLog.timestamp)}
										</td>
										<td className="bg-muted p-4 border font-medium text-foreground w-1/4">
											Log Level
										</td>
										<td className="p-4 border w-1/4">
											{selectedLog.log_lvl === "SUCCESS" ? (
												<span className="flex items-center gap-2 text-green-600">
													<CheckCircle2 className="h-4 w-4" /> Pass
												</span>
											) : (
												<span className="flex items-center gap-2 text-red-600">
													<XCircle className="h-4 w-4" /> Error
												</span>
											)}
										</td>
									</tr>
									<tr>
										<td className="bg-muted p-4 border font-medium text-foreground">
											Log Type
										</td>
										<td className="p-4 border">
											{getLogTypeDescription(selectedLog.log_type)}
										</td>
										<td className="bg-muted p-4 border font-medium text-foreground">
											Source
										</td>
										<td className="p-4 border font-semibold">
											{getSourceLabel(selectedLog.source)}
										</td>
									</tr>
									<tr>
										<td className="bg-muted p-4 border font-medium text-foreground">
											Vendor
										</td>
										<td className="p-4 border font-semibold">
											{normalizeVendorName(selectedLog.vendor)}
										</td>
										<td className="bg-muted p-4 border font-medium text-foreground">
											Model
										</td>
										<td className="p-4 border font-semibold">
											{selectedLog.model}
										</td>
									</tr>
									{!isSinglePromptPage && (
										<tr>
											<td className="bg-muted p-4 border font-medium text-foreground">
												Prompt Name
											</td>
											<td className="p-4 border font-semibold" colSpan={selectedLog.memory_key ? 1 : 3}>
												{isPromptDeletedForCurrentLog ? (
													<span className="text-red-600">
														Prompt was deleted
													</span>
												) : (
													promptName
												)}
											</td>
											{selectedLog.memory_key && (
												<>
													<td className="bg-muted p-4 border font-medium text-foreground">
														Memory Key
													</td>
													<td className="p-4 border">
														{selectedLog.memory_key}
													</td>
												</>
											)}
										</tr>
									)}
									{isSinglePromptPage && selectedLog.memory_key && (
										<tr>
											<td className="bg-muted p-4 border font-medium text-foreground">
												Memory Key
											</td>
											<td className="p-4 border" colSpan={3}>
												{selectedLog.memory_key}
											</td>
										</tr>
									)}
									<tr>
										<td className="bg-muted p-4 border font-medium text-foreground">
											Performance
										</td>
										<td className="p-4 border" colSpan={3}>
											<div className="grid grid-cols-1 md:grid-cols-5 gap-3">
												<div className="rounded-md border bg-muted/30 px-3 py-2 md:col-span-3">
													<div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
														Tokens
													</div>
													<div className="grid grid-cols-3 gap-2">
														<div>
															<div className="text-xs text-muted-foreground">In</div>
															<div className="font-medium">
																{selectedLog.tokens_in || 0}
															</div>
														</div>
														<div>
															<div className="text-xs text-muted-foreground">Out</div>
															<div className="font-medium">
																{selectedLog.tokens_out || 0}
															</div>
														</div>
														<div>
															<div className="text-xs text-muted-foreground">Total</div>
															<div className="font-medium">
																{selectedLog.tokens_sum || 0}
															</div>
														</div>
													</div>
												</div>
												<div className="rounded-md border bg-muted/30 px-3 py-2 flex flex-col">
													<div className="text-xs uppercase text-muted-foreground text-center">Time</div>
													<div className="flex-1 flex items-center justify-center">
														<TooltipProvider>
															<Tooltip>
																<TooltipTrigger asChild>
																	<div className="font-medium text-center">{formatResponseTime(selectedLog.response_ms)}</div>
																</TooltipTrigger>
																<TooltipContent>
																	<p>{selectedLog.response_ms} ms</p>
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
													</div>
												</div>
												<div className="rounded-md border bg-muted/30 px-3 py-2 flex flex-col">
													<div className="text-xs uppercase text-muted-foreground text-center">Cost</div>
													<div className="flex-1 flex items-center justify-center">
														<div className="font-medium text-center">
															${selectedLog.cost?.toFixed?.(6) ?? 0}
														</div>
													</div>
												</div>
											</div>
										</td>
									</tr>
									{selectedLog.log_lvl === "ERROR" && (
										<tr>
											<td className="bg-muted p-4 border font-medium text-foreground">
												Error Description
											</td>
											<td className="p-4 border" colSpan={3}>
												{selectedLog.description ? (
													<span className="text-red-600">
														{selectedLog.description}
													</span>
												) : (
													"No Errors"
												)}
											</td>
										</tr>
									)}
								</tbody>
							</table>
						</div>
						<div className="mt-4 flex flex-col gap-4">
							{selectedLog.in && (
								<div>
									<div className="mb-1 flex items-center justify-between">
										<p className="font-medium text-xs leading-none tracking-normal text-[#71717A]">
											Input
										</p>
										<div className="flex items-center gap-2">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
															onClick={() => setIsInputPreviewMode((prev) => !prev)}
														>
															{isInputPreviewMode ? (
																<EyeClosed style={EYE_ICON_STYLE} />
															) : (
																<Eye style={EYE_ICON_STYLE} />
															)}
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														<p>Show Preview</p>
													</TooltipContent>
												</Tooltip>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
															onClick={() => setIsInputExpanded(true)}
														>
															<CornersOut style={EXPAND_ICON_STYLE} />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														<p>Expand</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									</div>
									<div className="bg-white dark:bg-[#1e1e1e] border rounded font-medium text-xs tracking-normal text-[#71717A] w-full">
										{!isInputExpanded && (
											isInputPreviewMode ? (
												<div className="h-[200px] overflow-y-auto overflow-x-hidden w-full">
													<div className="p-4 w-full max-w-full overflow-x-hidden">
														<AIPreview
															content={selectedLog.in || ""}
															onError={handlePreviewError}
														/>
													</div>
												</div>
											) : (
												<MonacoEditor
													height="200px"
													width="100%"
													defaultLanguage="json"
													value={parsedInput}
													options={READONLY_EDITOR_OPTIONS}
												/>
											)
										)}
									</div>
								</div>
							)}
							{selectedLog.out && (
								<div>
									<div className="mb-1 flex items-center justify-between">
										<p className="font-medium text-xs leading-none tracking-normal text-[#71717A]">
											Output
										</p>
										<div className="flex items-center gap-2">
											<TooltipProvider>
												<Tooltip>
													<TooltipTrigger asChild>
														<Button
															variant="ghost"
															size="icon"
															className="h-6 w-6 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
															onClick={() =>
																setIsOutputExpanded(true)
															}
														>
															<CornersOut style={EXPAND_ICON_STYLE} />
														</Button>
													</TooltipTrigger>
													<TooltipContent>
														<p>Expand</p>
													</TooltipContent>
												</Tooltip>
											</TooltipProvider>
										</div>
									</div>
									<div className="bg-white dark:bg-[#1e1e1e] border rounded font-medium text-xs tracking-normal text-[#71717A] w-full">
									<MonacoEditor
										height="200px"
										width="100%"
										defaultLanguage="json"
										value={parsedOutput}
										options={READONLY_EDITOR_OPTIONS}
									/>
									</div>
								</div>
							)}
							<div className="flex justify-end mt-4">
								<Button
									onClick={handleAddTestcaseFromLog}
									disabled={creatingTestcase || isPromptDeletedForCurrentLog}
									className="text-[14px] h-[36px]"
								>
									{creatingTestcase ? "Adding..." : "Add testcase"}
								</Button>
							</div>
						</div>
					</div>
				)}
			</DialogContent>

			{/* Expanded Input Dialog */}
			<Dialog open={isInputExpanded} onOpenChange={setIsInputExpanded}>
				<DialogContent className="max-w-4xl h-[80vh] flex flex-col overflow-x-hidden py-6 px-4">
					<div className="flex h-full flex-col gap-2">
						<div className="flex items-center gap-2">
							<DialogTitle className="text-sm font-medium">Input</DialogTitle>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
											onClick={() => setIsInputPreviewMode((prev) => !prev)}
										>
											{isInputPreviewMode ? (
												<EyeClosed style={EYE_ICON_STYLE_SMALL} />
											) : (
												<Eye style={EYE_ICON_STYLE_SMALL} />
											)}
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Show Preview</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						</div>
						<div className="flex-grow overflow-auto">
							{isInputPreviewMode ? (
								<div className="h-full overflow-y-auto rounded-md border bg-transparent p-4 text-sm dark:border-border">
									<AIPreview
										content={selectedLog?.in || ""}
										onError={handlePreviewError}
									/>
								</div>
							) : (
								<div className="h-full bg-white dark:bg-[#1e1e1e] border rounded ring-1 ring-border">
									<MonacoEditor
										height="100%"
										width="100%"
										defaultLanguage="json"
										value={parsedInput}
										options={READONLY_EDITOR_WITH_LINE_NUMBERS_OPTIONS}
									/>
								</div>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Expanded Output Dialog */}
			<Dialog open={isOutputExpanded} onOpenChange={setIsOutputExpanded}>
				<DialogContent className="max-w-4xl h-[80vh] flex flex-col overflow-x-hidden py-6 px-4">
					<div className="flex h-full flex-col gap-2">
						<div className="flex items-center gap-2">
							<DialogTitle className="text-sm font-medium">Output</DialogTitle>
						</div>
						<div className="flex-grow overflow-auto">
							<div className="h-full bg-white dark:bg-[#1e1e1e] border rounded ring-1 ring-border">
								<MonacoEditor
									height="100%"
									width="100%"
									defaultLanguage="json"
									value={parsedOutput}
									options={READONLY_EDITOR_WITH_LINE_NUMBERS_OPTIONS}
								/>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</Dialog>
	);
};

export const LogDetailsDialog = memo(LogDetailsDialogComponent);
