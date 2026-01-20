import React, { useRef, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Editor from "@monaco-editor/react";
import { parseJson } from "@/lib/jsonUtils";
import { CheckCircle2, XCircle } from "lucide-react";
import { Eye, EyeClosed, CornersOut } from "phosphor-react";
import { useTheme } from "@/components/theme/theme-provider";
import { formatUserLocalDateTime } from "@/lib/formatUserLocalDateTime";
import AIPreview from "@/pages/prompt/playground-tabs/playground/components/input-textarea/components/AIPreview";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/useToast";

interface LogDetailsDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	selectedLog: any;
	isInputExpanded: boolean;
	setIsInputExpanded: (v: boolean) => void;
	isOutputExpanded: boolean;
	setIsOutputExpanded: (v: boolean) => void;
	handleAddTestcaseFromLog: () => void;
	creatingTestcase: boolean;
	promptNames: { id: number; name: string }[];
	isSinglePromptPage?: boolean;
}

export const LogDetailsDialog: React.FC<LogDetailsDialogProps> = ({
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
	const inputEditorRef = useRef<any>(null);
	const outputEditorRef = useRef<any>(null);
	const [isInputPreviewMode, setIsInputPreviewMode] = useState(false);
	const { toast } = useToast();

	useEffect(() => {
		return () => {
			if (inputEditorRef.current) {
				setTimeout(() => inputEditorRef.current.dispose(), 500);
			}
			if (outputEditorRef.current) {
				setTimeout(() => outputEditorRef.current.dispose(), 500);
			}
		};
	}, []);

	// Reset preview mode when main dialog closes
	useEffect(() => {
		if (!open) {
			setIsInputPreviewMode(false);
		}
	}, [open]);

	const handleInputEditorDidMount = (editor: any) => {
		inputEditorRef.current = editor;
	};

	const handleOutputEditorDidMount = (editor: any) => {
		outputEditorRef.current = editor;
	};

	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

	function getLogTypeDescription(logType: string | undefined) {
		switch (logType) {
			case "prs":
				return "Prompt run successfully";
			case "pre":
				return "Prompt run error";
			case "ae":
				return "AI Error";
			case "te":
				return "Technical Error";
			default:
				return "Unknown log type";
		}
	}
	function getPromptName(
		promptId: number | undefined,
		promptNames: { id: number; name: string }[],
	) {
		if (!promptId) return "-";
		return promptNames.find((p) => p.id === promptId)?.name || `Prompt ${promptId}`;
	}

	function isPromptDeleted(
		promptId: number | undefined,
		promptNames: { id: number; name: string }[],
	) {
		if (!promptId) return false;
		return !promptNames.find((p) => p.id === promptId);
	}

	function getSourceLabel(source: string | undefined) {
		switch (source) {
			case "ui":
				return "UI";
			case "testcase":
				return "Testcase";
			case "api":
				return "API";
			default:
				return source ? source.charAt(0).toUpperCase() + source.slice(1) : "-";
		}
	}

	const isPromptDeletedForCurrentLog = isSinglePromptPage
		? false
		: isPromptDeleted(selectedLog?.prompt_id, promptNames);

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
											{selectedLog.vendor}
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
											<td className="p-4 border font-semibold">
												{isPromptDeletedForCurrentLog ? (
													<span className="text-red-600">
														Prompt was deleted
													</span>
												) : (
													getPromptName(
														selectedLog.prompt_id,
														promptNames,
													)
												)}
											</td>
											<td className="bg-muted p-4 border font-medium text-foreground">
												Memory Key
											</td>
											<td className="p-4 border">
												{selectedLog.memory_key || "-"}
											</td>
										</tr>
									)}
									{isSinglePromptPage && (
										<tr>
											<td className="bg-muted p-4 border font-medium text-foreground">
												Memory Key
											</td>
											<td className="p-4 border" colSpan={3}>
												{selectedLog.memory_key || "-"}
											</td>
										</tr>
									)}
									<tr>
										<td className="bg-muted p-4 border font-medium text-foreground">
											Performance
										</td>
										<td className="p-4 border" colSpan={3}>
											<div className="flex justify-between">
												<span>
													Tokens: In: {selectedLog.tokens_in || 0} | Out:{" "}
													{selectedLog.tokens_out || 0} | Total:{" "}
													{selectedLog.tokens_sum || 0}
												</span>
												<span>
													Response Time: {selectedLog.response_ms}ms
												</span>
												<span>
													Cost: ${selectedLog.cost?.toFixed?.(6) ?? 0}
												</span>
											</div>
										</td>
									</tr>
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
															onClick={() =>
																setIsInputPreviewMode(
																	!isInputPreviewMode,
																)
															}
														>
															{isInputPreviewMode ? (
																<EyeClosed
																	style={{
																		width: "17px",
																		height: "17px",
																	}}
																/>
															) : (
																<Eye
																	style={{
																		width: "17px",
																		height: "17px",
																	}}
																/>
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
															<CornersOut
																style={{
																	width: "20px",
																	height: "20px",
																}}
															/>
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
											<>
												{isInputPreviewMode ? (
													<div className="h-[200px] overflow-y-auto overflow-x-hidden w-full">
														<div className="p-4 w-full max-w-full overflow-x-hidden">
															<AIPreview
																content={selectedLog.in || ""}
																onError={(error) => {
																	toast({
																		title: "Preview Error",
																		description: error,
																		variant: "destructive",
																	});
																}}
															/>
														</div>
													</div>
												) : (
													<Editor
														height="200px"
														width="100%"
														defaultLanguage="json"
														value={parseJson(selectedLog.in)}
														onMount={handleInputEditorDidMount}
														options={{
															readOnly: true,
															minimap: { enabled: false },
															scrollBeyondLastLine: false,
															wordWrap: "on",
															fontSize: 14,
															contextmenu: false,
															lineNumbers: "off",
															folding: false,
															lineDecorationsWidth: 0,
															lineNumbersMinChars: 3,
															fontFamily: "Inter, sans-serif",
															scrollbar: {
																vertical: "auto",
																horizontal: "auto",
															},
															stickyScroll: {
																enabled: false,
															},
															overviewRulerLanes: 0,
															hideCursorInOverviewRuler: true,
															overviewRulerBorder: false,
															padding: { top: 8, bottom: 8 },
														}}
														theme={monacoTheme}
													/>
												)}
											</>
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
															<CornersOut
																style={{
																	width: "20px",
																	height: "20px",
																}}
															/>
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
										<Editor
											height="200px"
											width="100%"
											defaultLanguage="json"
											value={parseJson(selectedLog.out)}
											onMount={handleOutputEditorDidMount}
											theme={monacoTheme}
											options={{
												readOnly: true,
												minimap: { enabled: false },
												scrollBeyondLastLine: false,
												wordWrap: "on",
												fontSize: 14,
												contextmenu: false,
												lineNumbers: "off",
												folding: false,
												scrollbar: {
													vertical: "auto",
													horizontal: "auto",
													verticalScrollbarSize: 5,
												},
												lineDecorationsWidth: 0,
												lineNumbersMinChars: 3,
												fontFamily: "Inter, sans-serif",
												overviewRulerLanes: 0,
												hideCursorInOverviewRuler: true,
												overviewRulerBorder: false,
												padding: { top: 8, bottom: 8 },
											}}
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
									{creatingTestcase ? "Adding..." : "Add to testcase"}
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
							<h3 className="text-sm font-medium">Input</h3>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 text-[#09090B] dark:text-[#FAFAFA] [&_svg]:size-3"
											onClick={() =>
												setIsInputPreviewMode(!isInputPreviewMode)
											}
										>
											{isInputPreviewMode ? (
												<EyeClosed
													style={{ width: "16px", height: "16px" }}
												/>
											) : (
												<Eye style={{ width: "16px", height: "16px" }} />
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
										onError={(error) => {
											toast({
												title: "Preview Error",
												description: error,
												variant: "destructive",
											});
										}}
									/>
								</div>
							) : (
								<div className="h-full bg-white dark:bg-[#1e1e1e] border rounded">
									<Editor
										height="100%"
										width="100%"
										defaultLanguage="json"
										value={parseJson(selectedLog?.in || "")}
										onMount={handleInputEditorDidMount}
										options={{
											readOnly: true,
											minimap: { enabled: false },
											scrollBeyondLastLine: false,
											wordWrap: "on",
											fontSize: 14,
											contextmenu: false,
											lineNumbers: "on",
											folding: true,
											lineDecorationsWidth: 0,
											lineNumbersMinChars: 3,
											fontFamily: "Inter, sans-serif",
											scrollbar: {
												vertical: "auto",
												horizontal: "auto",
											},
											stickyScroll: {
												enabled: false,
											},
											overviewRulerLanes: 0,
											hideCursorInOverviewRuler: true,
											overviewRulerBorder: false,
											padding: { top: 8, bottom: 8 },
										}}
										theme={monacoTheme}
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
							<h3 className="text-sm font-medium">Output</h3>
						</div>
						<div className="flex-grow overflow-auto">
							<div className="h-full bg-white dark:bg-[#1e1e1e] border rounded">
								<Editor
									height="100%"
									width="100%"
									defaultLanguage="json"
									value={parseJson(selectedLog?.out || "")}
									onMount={handleOutputEditorDidMount}
									theme={monacoTheme}
									options={{
										readOnly: true,
										minimap: { enabled: false },
										scrollBeyondLastLine: false,
										wordWrap: "on",
										fontSize: 14,
										contextmenu: false,
										lineNumbers: "on",
										folding: true,
										scrollbar: {
											vertical: "auto",
											horizontal: "auto",
											verticalScrollbarSize: 5,
										},
										lineDecorationsWidth: 0,
										lineNumbersMinChars: 3,
										fontFamily: "Inter, sans-serif",
										overviewRulerLanes: 0,
										hideCursorInOverviewRuler: true,
										overviewRulerBorder: false,
										padding: { top: 8, bottom: 8 },
									}}
								/>
							</div>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</Dialog>
	);
};
