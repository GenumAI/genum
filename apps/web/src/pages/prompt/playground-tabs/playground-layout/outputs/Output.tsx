import React, { useState, useRef, useEffect, memo, useCallback, useMemo } from "react";

import { Ticket, Coins, CircleGauge, Loader2, X } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useParams, useSearchParams } from "react-router-dom";
import { PromptResponse } from "@/hooks/useRunPrompt";
import { TestcasePayload, useCreateTestcase } from "@/hooks/useCreateTestcase";
import { useToast } from "@/hooks/useToast";
import { useAuth0 } from "@auth0/auth0-react";
import { checkIsJson, parseJson } from "@/lib/jsonUtils";
import CompareDiffEditor from "@/components/ui/DiffEditor";
import PromptDiff from "@/components/dialogs/PromptDiffDialog";
import { useMutation } from "@tanstack/react-query";
import { promptApi } from "@/api/prompt";
import { useQueryClient } from "@tanstack/react-query";
import { capitalizeFirstLetter } from "@/lib/capitalizeFirstLetter";
import useMutationWithAuth from "@/hooks/useMutationWithAuth";
import { CornersOut } from "phosphor-react";
import {
	usePlaygroundContent,
	usePlaygroundActions,
	usePlaygroundTestcase,
} from "@/stores/playground.store";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePromptById } from "@/hooks/usePrompt";
import debounce from "lodash.debounce";
import clsx from "clsx";
import MemoryKey from "../../memory/MemoryKey";
import AssertionPopover from "@/components/popovers/AssertionPopover";

export interface UpdateExpected {
	answer: string;
}

const getSeconds = (ms?: number) => {
	if (!ms) {
		return 0;
	}
	return ms / 1000;
};

const formatNumber = (num: number) => {
	if (Number.isInteger(num)) {
		return num;
	} else {
		return parseFloat(num.toFixed(4));
	}
};

const TuneIcon = ({
	className = "",
	stroke = "currentColor",
}: {
	className?: string;
	stroke?: string;
}) => (
	<svg
		width="17"
		height="18"
		viewBox="0 0 17 18"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
	>
		<g clipPath="url(#clip0_6861_24864)">
			<path
				d="M7.28592 5.62695L6.92912 6.59086C6.46168 7.85487 6.22797 8.48688 5.76675 8.94809C5.30554 9.4093 4.67354 9.64302 3.40953 10.1105L2.44562 10.4673L3.40953 10.8241C4.67354 11.2915 5.30554 11.5259 5.76675 11.9864C6.22797 12.4469 6.46168 13.0796 6.92912 14.3436L7.28592 15.3076L7.64272 14.3436C8.11015 13.0796 8.34456 12.4476 8.80508 11.9864C9.2656 11.5252 9.89829 11.2915 11.1623 10.8241L12.1262 10.4673L11.1623 10.1105C9.89829 9.64302 9.26629 9.4093 8.80508 8.94809C8.34387 8.48688 8.11015 7.85487 7.64272 6.59086L7.28592 5.62695Z"
				stroke={stroke}
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
			<path
				d="M12.6648 3.27414L12.8176 2.86133L12.9711 3.27414C13.1709 3.81625 13.2712 4.08731 13.4689 4.28507C13.6658 4.48193 13.9365 4.58219 14.4768 4.78231L14.4785 4.78293L14.892 4.93574L14.4792 5.08925C13.9371 5.28908 13.666 5.38935 13.4683 5.58711C13.2712 5.78418 13.1709 6.05523 12.9704 6.59734L12.9704 6.59735L12.8176 7.01016L12.6641 6.59735C12.4642 6.05523 12.364 5.78418 12.1662 5.58642C11.9693 5.38955 11.6986 5.28929 11.1583 5.08918L11.1567 5.08856L10.7432 4.93574L11.156 4.78224C11.6981 4.5824 11.9691 4.48214 12.1669 4.28438C12.364 4.08731 12.4642 3.81625 12.6648 3.27415L12.6648 3.27414Z"
				stroke={stroke}
				strokeWidth="0.7"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</g>
		<defs>
			<clipPath id="clip0_6861_24864">
				<rect width="14" height="14" fill={stroke} transform="translate(1.5 2.25293)" />
			</clipPath>
		</defs>
	</svg>
);

const MetricsDisplay = ({ title, content }: { title: string; content?: PromptResponse }) => {
	const tokensTotal = content?.tokens?.total;
	const costTotal = content?.cost?.total;
	const responseTimeSeconds = getSeconds(content?.response_time_ms);

	const shouldShowTokens = typeof tokensTotal === "number" && tokensTotal !== 0;
	const shouldShowCost = typeof costTotal === "number" && costTotal !== 0;
	const shouldShowResponseTime =
		typeof responseTimeSeconds === "number" && responseTimeSeconds !== 0;

	return (
		<div className="flex items-center justify-between py-[18px] px-[7px] h-[60px]">
			<div className="flex flex-wrap items-center text-muted-foreground gap-2.5">
				<CardTitle className="text-sm font-medium text-foreground mr-1">{title}</CardTitle>
				{shouldShowTokens && (
					<span className="flex items-center text-zinc-500 text-xs gap-1">
						<Ticket className="w-4 h-4" />
						{formatNumber(tokensTotal)}
					</span>
				)}
				{shouldShowCost && (
					<span className="flex items-center text-zinc-500 text-xs gap-1">
						<Coins className="w-4 h-4" />
						{formatNumber(costTotal)}
					</span>
				)}
				{shouldShowResponseTime && (
					<span className="flex items-center text-zinc-500 text-xs gap-1">
						<CircleGauge className="w-4 h-4" />
						{formatNumber(responseTimeSeconds)} sec
					</span>
				)}
			</div>
		</div>
	);
};

interface DiffEditorPopupProps {
	original: string;
	modified: string;
	onSave: (value: string) => void;
	onClose: () => void;
	content?: PromptResponse;
	expectedContent?: PromptResponse;
	isShowTunePrompt?: boolean;
	tuneText?: string;
	setTuneText?: (text: string) => void;
	isTunePopoverOpen?: boolean;
	setIsTunePopoverOpen?: (open: boolean) => void;
	onTune?: () => void;
	isTuning?: boolean;
}

const DiffEditorPopup = ({
	original,
	modified,
	onSave,
	onClose,
	content,
	expectedContent,
	isShowTunePrompt = false,
	tuneText = "",
	setTuneText,
	isTunePopoverOpen = false,
	setIsTunePopoverOpen,
	onTune,
	isTuning = false,
}: DiffEditorPopupProps) => {
	const [modifiedPrompt, setModifiedPrompt] = useState<string>(modified ?? "");

	const changeHandler = (value: string) => {
		setModifiedPrompt(value ?? "");
	};

	useEffect(() => {
		setModifiedPrompt(modified);
	}, [modified]);

	const closeHandler = () => {
		onClose();
		onSave(modifiedPrompt);
	};

	return (
		<div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
			<div className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[90vh] flex flex-col">
				<div className="flex items-center justify-between p-4 border-b">
					<div className="flex items-center gap-4">
						<h2 className="text-lg font-semibold">Output</h2>
					</div>
					<Button variant="ghost" size="sm" onClick={closeHandler}>
						<X className="w-4 h-4" />
					</Button>
				</div>

				<div className="grid grid-cols-2 text-xs border-b">
					<div>
						<MetricsDisplay title="Last Output" content={content || undefined} />
					</div>

					<div>
						<MetricsDisplay title="Expected Output" content={expectedContent} />
					</div>
				</div>

				<div className="flex-1 py-4 pr-1">
					<CompareDiffEditor
						original={original}
						modified={modified}
						onChange={changeHandler}
					/>
				</div>
			</div>
		</div>
	);
};

interface OutputBlockProps {
	promptName: string;
	onSaveAsExpected: (content: UpdateExpected) => Promise<void>;
	systemPrompt?: string;
	onPromptUpdate?: (newPrompt: string) => void;
	onTestcaseAdded?: () => void;
	onRegisterClearFunction?: (clearFn: () => void) => void;
}

const compareValues = (val1: string, val2: string | undefined) => {
	if (val2 === undefined) {
		return false;
	}
	if (checkIsJson(val1) && checkIsJson(val2)) {
		try {
			return JSON.stringify(JSON.parse(val1)) === JSON.stringify(JSON.parse(val2));
		} catch {
			return val1 === val2;
		}
	}
	return val1 === val2;
};

const OutputBlock: React.FC<OutputBlockProps> = ({
	promptName,
	onSaveAsExpected,
	systemPrompt,
	onPromptUpdate,
	onTestcaseAdded,
	onRegisterClearFunction,
}) => {
	const {
		inputContent: inputValue,
		outputContent: content,
		expectedOutput: initialExpectedContent,
	} = usePlaygroundContent();
	const {
		setExpectedOutput,
		clearOutput,
		setCurrentAssertionType,
		setAssertionValue,
		fetchStatusCounts,
	} = usePlaygroundActions();
	const { currentAssertionType, assertionValue, selectedMemoryId } = usePlaygroundTestcase();

	const isShowTunePrompt = !!onPromptUpdate;
	const queryClient = useQueryClient();
	const { createTestcase, loading, error } = useCreateTestcase();
	const [tuneText, setTuneText] = useState("");
	const [isTunePopoverOpen, setIsTunePopoverOpen] = useState(false);
	const [isOpenPromptDiff, setIsOpenPromptDiff] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);
	const { toast } = useToast();
	const [modifiedValue, setModifiedValue] = useState(initialExpectedContent?.answer || "");
	const [isOpenAssertion, setIsOpenAssertion] = useState(false);
	const [isPopupOpen, setIsPopupOpen] = useState(false);
	const [expectedMetrics, setExpectedMetrics] = useState<PromptResponse | undefined>(
		initialExpectedContent ?? undefined,
	);

	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;

	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");

	const { prompt } = usePromptById(promptId);

	const updatePromptMutation = useMutation({
		mutationFn: async (data: Partial<any>) => {
			if (!promptId) throw new Error("Prompt ID is required");
			return await promptApi.updatePrompt(promptId, data);
		},
	});

	const prevPromptIdRef = useRef<number | undefined>(promptId);
	const prevTestcaseIdRef = useRef<string | null>(testcaseId);

	useEffect(() => {
		const prevPromptId = prevPromptIdRef.current;
		const currentPromptId = promptId;

		if (prevPromptId !== undefined && prevPromptId !== currentPromptId) {
			if (!testcaseId) {
				setExpectedOutput(null);
				setModifiedValue("");
				setExpectedMetrics(undefined);
			}
		}

		prevPromptIdRef.current = currentPromptId;
	}, [
		promptId,
		testcaseId,
		setExpectedOutput,
	]);

	const { mutation: promptTuneMutation } = useMutationWithAuth<{ prompt: string }>();

	const clearExpectedOutput = useCallback(() => {
		setModifiedValue("");
	}, []);

	useEffect(() => {
		if (prompt?.prompt) {
			setCurrentAssertionType(prompt.prompt.assertionType || "AI");
			setAssertionValue(prompt.prompt.assertionValue || "");
		}
	}, [prompt?.prompt, setCurrentAssertionType, setAssertionValue]);

	useEffect(() => {
		const handleAssertionTypeChange = (event: CustomEvent) => {
			const { assertionType: newAssertionType } = event.detail;
			if (newAssertionType && newAssertionType !== currentAssertionType) {
				setCurrentAssertionType(newAssertionType);
			}
		};

		window.addEventListener("assertionTypeChanged", handleAssertionTypeChange as EventListener);

		return () => {
			window.removeEventListener(
				"assertionTypeChanged",
				handleAssertionTypeChange as EventListener,
			);
		};
	}, [currentAssertionType, setCurrentAssertionType]);

	useEffect(() => {
		if (onRegisterClearFunction) {
			onRegisterClearFunction(clearExpectedOutput);
		}
	}, [onRegisterClearFunction, clearExpectedOutput]);

	useEffect(() => {
		if (initialExpectedContent?.answer) {
			setModifiedValue(initialExpectedContent.answer);
			if (!expectedMetrics || expectedMetrics.answer !== initialExpectedContent.answer) {
				setExpectedMetrics(initialExpectedContent ?? undefined);
			}
		} else {
			const prevTestcaseId = prevTestcaseIdRef.current;
			if (!testcaseId) {
				if (prevTestcaseId || !initialExpectedContent) {
					setModifiedValue("");
					setExpectedMetrics(undefined);
					clearOutput();
				}
			} else if (testcaseId) {
				setModifiedValue("");
			}
		}
	}, [initialExpectedContent, testcaseId, expectedMetrics, clearOutput]);

	useEffect(() => {
		const prevTestcaseId = prevTestcaseIdRef.current;
		if (prevTestcaseId && !testcaseId) {
			setModifiedValue("");
			setExpectedMetrics(undefined);
			clearOutput();
		}
		prevTestcaseIdRef.current = testcaseId;
	}, [testcaseId, clearOutput]);

	const debouncedUpdateAssertionValue = useMemo(
		() =>
			debounce((value: string) => {
				if (promptId && currentAssertionType === "AI") {
					updatePromptMutation.mutate(
						{ assertionValue: value },
						{
							onSuccess: () => {
								queryClient.invalidateQueries({
									queryKey: ["prompt", promptId],
								});
							},
							onError: () => {
								toast({
									title: "Something went wrong",
									variant: "destructive",
								});
							},
						},
					);
				}
			}, 500),
		[promptId, currentAssertionType, updatePromptMutation, queryClient, toast],
	);

	const handleAssertionTypeChange = (value: string) => {
		setCurrentAssertionType(value);

		window.dispatchEvent(
			new CustomEvent("assertionTypeChanged", {
				detail: { assertionType: value },
			}),
		);

		if (promptId) {
			updatePromptMutation.mutate(
				{ assertionType: value },
				{
					onSuccess: () => {
						queryClient.invalidateQueries({
							queryKey: ["prompt", promptId],
						});
					},
					onError: () => {
						toast({
							title: "Something went wrong",
							variant: "destructive",
						});
					},
				},
			);
		}
	};

	const hasValidOutput = !!content?.answer;

	const handleSave = async () => {
		const createPayload: TestcasePayload = {
			promptId: Number(promptId),
			input: inputValue || "",
			expectedOutput: modifiedValue,
			lastOutput: content?.answer || "",
			memoryId: selectedMemoryId ? Number(selectedMemoryId) : undefined,
		};

		const ok = await createTestcase(createPayload);

		if (ok) {
			setModifiedValue("");
			setExpectedMetrics(undefined);
			if (promptId) {
				fetchStatusCounts(promptId);
			}
			onTestcaseAdded?.();
		}

		toast({
			title: ok ? "Test case added" : "Failed to add test case",
			description: ok
				? "Your test case was saved successfully."
				: (error ?? "Unknown error, try again."),
			variant: ok ? "default" : "destructive",
		});
	};

	const saveModifiedValue = async (value: string) => {
		setModifiedValue(value);

		if (!testcaseId) {
			return;
		}
		if (compareValues(value, initialExpectedContent?.answer)) {
			return;
		}

		await onSaveAsExpected({
			answer: value,
		});
	};

	const handleSaveAsExpected = async () => {
		const lastOutputAnswer = content?.answer || "";

		const newExpectedContent = {
			answer: lastOutputAnswer,
		};

		setModifiedValue(lastOutputAnswer);
		setExpectedMetrics(content ?? undefined);

		try {
			await onSaveAsExpected(newExpectedContent);

			toast({
				title: "Saved as expected",
				description: "Output and thoughts copied from Last Output to Expected Output.",
			});
		} catch (error) {
			setExpectedMetrics(initialExpectedContent ?? undefined);
		}
	};

	const handleOpenPlayground = () => {
		setIsExpanded(true);
	};

	const handleClosePlayground = () => {
		setIsPopupOpen(false);
	};

	const handleTune = async () => {
		if (!tuneText.trim()) {
			toast({
				title: "Cannot tune",
				description: "Please enter tuning instructions.",
				variant: "destructive",
			});
			return;
		}

		try {
			await promptTuneMutation.mutateAsync({
				url: `/helpers/prompt-tune`,
				data: {
					instruction: systemPrompt || "",
					input: inputValue || "",
					output: content?.answer || "",
					expectedOutput: modifiedValue,
					context: tuneText.trim(),
				},
			});

			setIsOpenPromptDiff(true);
			setIsTunePopoverOpen(false);
			setTuneText("");
		} catch (err) {
			toast({
				title: "Tuning failed",
				description:
					promptTuneMutation.error?.message ||
					"Failed to tune the prompt. Please try again.",
				variant: "destructive",
			});
		}
	};

	const onSavePromptDiff = (value: string) => {
		setIsOpenPromptDiff(false);
		if (isShowTunePrompt) {
			onPromptUpdate(value);
		}
	};

	return (
		<div>
			<div className="flex items-center justify-between pt-4 pb-2">
				<div className="flex w-full items-center justify-between">
					<CardTitle className="text-sm font-medium">Output</CardTitle>
					<div className="flex flex-row transition-all pr-6">
						{promptId && <MemoryKey promptId={promptId} />}

						<Popover open={isOpenAssertion} onOpenChange={setIsOpenAssertion}>
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<PopoverTrigger asChild>
											<button className="w-[120px] h-[32px] px-3 rounded-md transition-colors flex items-center justify-start gap-2 hover:bg-muted/50 ml-[15px]">
												<h2 className="text-[#18181B] dark:text-[#FFFFFF] text-[12px] font-bold flex-shrink-0">
													Assertion:
												</h2>
												<div
													className={clsx(
														"rounded-xl flex items-center justify-center h-4 text-[12px] font-[600] text-white flex-shrink-0",
														{
															"bg-[#2A9D90] w-[56px]":
																currentAssertionType === "STRICT",
															"bg-[#B66AD6] w-[56px]":
																currentAssertionType === "AI",
														},
													)}
												>
													{currentAssertionType !== "AI"
														? capitalizeFirstLetter(
																currentAssertionType,
															)
														: currentAssertionType}
												</div>
											</button>
										</PopoverTrigger>
									</TooltipTrigger>
									<TooltipContent>
										<p>Choose validation type</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
							<PopoverContent className="w-[400px] rounded-xl p-4" align="start">
								<div className="space-y-3">
									<h3 className="text-[#18181B] dark:text-[#FFFFFF] font-sans text-[14px] font-bold mb-4">
										Assertion
									</h3>

									<Select
										value={currentAssertionType}
										onValueChange={handleAssertionTypeChange}
									>
										<SelectTrigger className="text-[#18181B] dark:text-[#FFFFFF] text-[14px] font-normal leading-[20px] w-full">
											<SelectValue placeholder="AI" />
										</SelectTrigger>
										<SelectContent className="text-[#18181B] dark:text-[#FFFFFF] text-[14px] font-normal leading-[20px] w-full">
											<SelectItem value="STRICT">Strict</SelectItem>
											<SelectItem value="AI">AI</SelectItem>
										</SelectContent>
									</Select>

									<div className="space-y-2">
										{currentAssertionType === "AI" && (
											<div className="flex items-center justify-between">
												<span className="font-sans text-[12px] not-italic font-medium leading-[12px] text-[#18181B] dark:text-[#FFFFFF]">
													Value
												</span>
												{promptId && (
													<AssertionPopover
														promptId={promptId}
														setAssertionValue={setAssertionValue}
														toast={toast}
													/>
												)}
											</div>
										)}
										{currentAssertionType === "AI" && (
											<Textarea
												className="text-[14px] font-normal leading-[20px] w-full min-h-[180px] max-h-[300px]"
												placeholder="Enter assertion"
												value={assertionValue}
												onChange={(e) => setAssertionValue(e.target.value)}
												onBlur={(e) => {
													debouncedUpdateAssertionValue(e.target.value);
												}}
											/>
										)}
									</div>
								</div>
							</PopoverContent>
						</Popover>
					</div>
				</div>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 [&_svg]:size-3 text-[#09090B] dark:text-[#FAFAFA]"
								onClick={handleOpenPlayground}
							>
								<CornersOut style={{ width: "20px", height: "20px" }} />
							</Button>
						</TooltipTrigger>
						<TooltipContent>
							<p>Expand</p>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			</div>

			<Card className="w-full shadow-sm border rounded-lg">
				<div className="grid grid-cols-2 text-xs border-b dark:bg-[#27272A] rounded-t-lg">
					<div>
						<MetricsDisplay title="Last Output" content={content || undefined} />
					</div>

					<div>
						<MetricsDisplay title="Expected Output" content={expectedMetrics} />
					</div>
				</div>

				<div className="text-sm h-80 pr-px rounded-b-[6px] overflow-hidden">
					<CompareDiffEditor
						original={content?.answer}
						modified={modifiedValue}
						onBlur={saveModifiedValue}
						className="rounded-b-[6px]"
					/>
				</div>
			</Card>

			<div className="grid grid-cols-2 justify-items-end">
				<div className="pt-3">
					<Button
						variant="outline"
						size="sm"
						onClick={handleSaveAsExpected}
						disabled={!hasValidOutput}
						className="text-[14px] h-[32px] w-[138px]"
					>
						Save as expected
					</Button>
				</div>

				<div className="pt-3 px-0">
					{!testcaseId && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<div className="inline-block">
										<Button
											size="sm"
											onClick={handleSave}
											disabled={loading || !modifiedValue.trim()}
											className="text-[14px] h-[32px] w-[138px]"
										>
											{loading && (
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
											)}
											Add testcase
										</Button>
									</div>
								</TooltipTrigger>
								<TooltipContent>
									<p>Click to add a new test case</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>
			</div>

			<Dialog open={isExpanded} onOpenChange={(open) => setIsExpanded(open)}>
				<DialogContent className="max-w-6xl w-full h-[80vh] min-h-[500px] p-0 gap-0 flex flex-col">
					<div className="flex items-center justify-between p-4 border-b">
						<div className="flex items-center gap-4">
							<h2 className="text-lg font-semibold">Output</h2>
						</div>
					</div>

					<div className="grid grid-cols-2 text-xs border-b">
						<div>
							<MetricsDisplay title="Last Output" content={content || undefined} />
						</div>

						<div>
							<MetricsDisplay title="Expected Output" content={expectedMetrics} />
						</div>
					</div>

					<div className="flex-1 px-4">
						<CompareDiffEditor
							original={content?.answer}
							modified={modifiedValue}
							onBlur={saveModifiedValue}
						/>
					</div>

					<div className="grid grid-cols-2 justify-items-end border-t border-border bg-[#FAFAFA] dark:bg-[#1A1A1A] rounded-b-[6px]">
						<div className="py-3 px-4 border-r">
							<Button
								variant="outline"
								size="sm"
								onClick={handleSaveAsExpected}
								disabled={!hasValidOutput}
								className="text-[14px] h-[36px]"
							>
								Save as expected
							</Button>
						</div>

						<div className="py-3 px-4">
							{!testcaseId && (
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<div className="inline-block">
												<Button
													size="sm"
													onClick={handleSave}
													disabled={loading || !modifiedValue.trim()}
													className="text-[14px] h-[36px]"
												>
													{loading && (
														<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													)}
													Add testcase
												</Button>
											</div>
										</TooltipTrigger>
										<TooltipContent>
											<p>Click to add a new test case</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{isPopupOpen && (
				<DiffEditorPopup
					original={parseJson(content?.answer || "")}
					modified={parseJson(modifiedValue)}
					onSave={saveModifiedValue}
					onClose={handleClosePlayground}
					content={content || undefined}
					expectedContent={expectedMetrics}
					isShowTunePrompt={isShowTunePrompt}
					tuneText={tuneText}
					setTuneText={setTuneText}
					isTunePopoverOpen={isTunePopoverOpen}
					setIsTunePopoverOpen={setIsTunePopoverOpen}
					onTune={handleTune}
					isTuning={promptTuneMutation.isPending}
				/>
			)}

			{isShowTunePrompt && (
				<PromptDiff
					isOpen={isOpenPromptDiff}
					onOpenChange={setIsOpenPromptDiff}
					original={systemPrompt ?? ""}
					modified={promptTuneMutation.data?.prompt ?? ""}
					isLoading={false}
					onSave={onSavePromptDiff}
				/>
			)}
		</div>
	);
};

export default memo(OutputBlock);
