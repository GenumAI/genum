import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import type { Options } from "@/hooks/usePrompt";
import { usePromptById } from "@/hooks/usePrompt";
import TextEditor from "@/pages/prompt/playground-tabs/playground-layout/prompt-editor/TextEditor";
import type { UpdateExpected } from "@/pages/prompt/playground-tabs/playground-layout/outputs/Output";
import OutputBlock from "@/pages/prompt/playground-tabs/playground-layout/outputs/Output";
import { useToast } from "@/hooks/useToast";
import type { PromptResponse } from "@/hooks/useRunPrompt";
import { useRunPrompt } from "@/hooks/useRunPrompt";
import { Button } from "@/components/ui/button";
import SettingsBar from "@/pages/prompt/playground-tabs/playground-layout/settings-block/SettingsBar";
import { TestcaseAssertionModal } from "@/components/dialogs/TestcaseAssertionDialog";
import { useAudit } from "@/hooks/useAudit";
import AuditResultsModal from "@/components/dialogs/AuditResultsDialog";
import PromptDiff from "@/components/dialogs/PromptDiffDialog";
import { InputTextArea } from "@/pages/prompt/playground-tabs/playground-layout/InputTextArea";
import { useSidebar } from "@/components/sidebar/sidebar";
import type { Model } from "@/types/AIModel";
import { usePromptStatus } from "@/contexts/PromptStatusContext";
import {
	usePlaygroundContent,
	usePlaygroundActions,
	usePlaygroundTestcase,
	usePlaygroundUI,
	defaultPromptResponse,
} from "@/stores/playground.store";
import usePlaygroundStore from "@/stores/playground.store";
import { useTestcaseStatusCounts } from "@/hooks/useTestcaseStatusCounts";
import { promptApi } from "@/api/prompt";
import { testcasesApi } from "@/api/testcases/testcases.api";

const formatTestcaseOutput = (output: any): PromptResponse => {
	if (!output) {
		return defaultPromptResponse;
	}

	if (typeof output === "object" && "answer" in output) {
		const result = {
			...output,
			answer: output.answer ?? "",
		};
		return result;
	}

	if (typeof output === "string") {
		return {
			answer: output,
			tokens: defaultPromptResponse.tokens,
			cost: defaultPromptResponse.cost,
			response_time_ms: defaultPromptResponse.response_time_ms,
			status: defaultPromptResponse.status,
		};
	}

	if (typeof output === "object") {
		return {
			answer: output.toString() || "",
			tokens: output.tokens || defaultPromptResponse.tokens,
			cost: output.cost || defaultPromptResponse.cost,
			response_time_ms: output.response_time_ms || defaultPromptResponse.response_time_ms,
			status: output.status || defaultPromptResponse.status,
		};
	}

	return defaultPromptResponse;
};

export default function Playground() {
	const {
		setFlags,
		setOutputContent,
		setExpectedOutput,
		setCurrentExpectedThoughts,
		setCurrentAssertionType,
		resetForNewTestcase,
		clearAllState,
		fetchTestcases,
	} = usePlaygroundActions();
	const {
		outputContent: storeOutputContent,
		clearedOutput,
		currentExpectedThoughts,
	} = usePlaygroundContent();
	const { currentAssertionType, testcases } = usePlaygroundTestcase();
	const { modalOpen, status, wasRun, isStatusCountsLoading } = usePlaygroundUI();
	const get = usePlaygroundStore.getState;

	const [, setIsUncommitted] = useState(false);
	const [isPromptChangedAfterAudit, setIsPromptChangedAfterAudit] = useState(false);
	const clearExpectedOutputRef = useRef<(() => void) | null>(null);
	const lastSavedInputRef = useRef<string>("");

	const [diffModalInfo, setDiffModalInfo] = useState<{
		prompt: string;
	} | null>(null);
	const [showAuditModal, setShowAuditModal] = useState(false);
	const markAsUncommittedRef = useRef<(() => void) | null>(null);

	const { inputContent, hasInputContent, hasPromptContent } = usePlaygroundContent();
	const { setOriginalPromptContent, setInputContent } = usePlaygroundActions();

	const { setIsCommitted, setActivePromptId } = usePromptStatus();
	const [isFormattingUpdate, setIsFormattingUpdate] = useState(false);

	const { orgId, projectId, id } = useParams<{
		orgId: string;
		projectId: string;
		id: string;
	}>();
	const promptId = id ? Number(id) : undefined;
	const { toast } = useToast();
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");
	const { currentAuditData, runAudit, isAuditLoading, setCurrentAuditData, fixRisks } = useAudit({
		onAuditSuccess: () => {
			setIsPromptChangedAfterAudit(false);
			setShowAuditModal(true);
		},
		onFixSuccess: (fixedPrompt) => {
			setDiffModalInfo({ prompt: fixedPrompt });
			setShowAuditModal(false);
		},
	});
	const navigate = useNavigate();
	const [isFixing, setIsFixing] = useState(false);

	const [models, setModels] = useState<Model[]>([]);

	const fetchModels = useCallback(async () => {
		try {
			const data = await promptApi.getModels();
			if (data?.models) {
				setModels(data.models);
			}
		} catch (error) {
			console.error("Error fetching models:", error);
		}
	}, []);

	useEffect(() => {
		fetchModels();
	}, [fetchModels]);

	useTestcaseStatusCounts(promptId);

	const prevTestcaseIdRef = useRef<string | null>(testcaseId);

	useEffect(() => {
		return () => {
			clearAllState();
			setFlags({ clearedOutput: null });
		};
	}, [clearAllState, setFlags]);

	useEffect(() => {
		setActivePromptId(promptId);
		return () => setActivePromptId(undefined);
	}, [promptId, setActivePromptId]);

	const {
		updatePromptName,
		prompt,
		loading: promptLoading,
		error: updatePromptError,
	} = usePromptById(promptId);

	useEffect(() => {
		if (prompt?.prompt?.assertionType) {
			setCurrentAssertionType(prompt.prompt.assertionType);
		}
	}, [prompt?.prompt?.assertionType, setCurrentAssertionType]);

	const { runPrompt, result: outputContent, loading: runLoading } = useRunPrompt();

	useEffect(() => {
		if (outputContent && outputContent.answer !== undefined && outputContent.answer !== null) {
			setOutputContent(outputContent);
		}
	}, [outputContent, setOutputContent]);

	const testcase = useMemo(() => {
		if (!testcaseId || !testcases.length) return null;
		return testcases.find((tc) => tc.id === Number(testcaseId)) || null;
	}, [testcases, testcaseId]);

	useEffect(() => {
		const prevTestcaseId = prevTestcaseIdRef.current;
		const currentTestcaseId = testcaseId;

		if (prevTestcaseId && (!currentTestcaseId || prevTestcaseId !== currentTestcaseId)) {
			resetForNewTestcase();
		}

		prevTestcaseIdRef.current = currentTestcaseId;
	}, [testcaseId, resetForNewTestcase]);

	useEffect(() => {
		if (testcase) {
			const testcaseInput = testcase.input || "";
			setInputContent(testcaseInput);
			lastSavedInputRef.current = testcaseInput;
			setExpectedOutput(formatTestcaseOutput(testcase.expectedOutput));

			const formattedLastOutput = formatTestcaseOutput(testcase.lastOutput);

			if (
				formattedLastOutput &&
				formattedLastOutput.answer !== undefined &&
				formattedLastOutput.answer !== null
			) {
				const { outputContent } = get();

				const isSameAnswer = outputContent?.answer === formattedLastOutput.answer;
				const hasMetrics =
					(outputContent?.tokens?.total ?? 0) > 0 ||
					(outputContent?.response_time_ms ?? 0) > 0;

				if (!isSameAnswer || !hasMetrics) {
					setOutputContent(formattedLastOutput);
				}
			}

			setCurrentExpectedThoughts(testcase.expectedChainOfThoughts || "");
			setFlags({ isTestcaseLoaded: true });
		} else if (!testcaseId) {
			setExpectedOutput(null);
		}
	}, [
		testcase,
		testcaseId,
		get,
		setInputContent,
		setExpectedOutput,
		setOutputContent,
		setCurrentExpectedThoughts,
		setFlags,
	]);

	useEffect(() => {
		if (prompt?.prompt) {
			const promptCommitted = prompt.prompt.commited || false;
			setIsCommitted(promptCommitted);

			if (!isFormattingUpdate) {
				setIsUncommitted(!promptCommitted);
			}
		}
	}, [prompt?.prompt, isFormattingUpdate, setIsCommitted]);

	const auditPrompt = async () => {
		if (!promptId || !prompt?.prompt?.value || isAuditLoading) return;
		await runAudit(promptId);
	};

	const handleOpenAuditModal = () => {
		setShowAuditModal(true);
	};

	const handleCloseAuditModal = () => {
		setShowAuditModal(false);
	};

	const handleRunAudit = async () => {
		if (promptId) {
			await runAudit(promptId);
		}
	};

	const handleFixRisks = async (recommendations: string[]) => {
		if (!prompt?.prompt?.value) return;
		setIsFixing(true);
		await fixRisks(prompt.prompt.value, recommendations);
		setIsFixing(false);
	};

	const handleTestcaseAdded = useCallback(async () => {
		resetForNewTestcase();
		setInputContent("");
		clearExpectedOutputRef.current?.();
		window.dispatchEvent(new CustomEvent("testcaseUpdated"));
	}, [resetForNewTestcase, setInputContent]);

	const markAsUncommitted = useCallback(() => {}, []);

	const handleMarkAsUncommittedCallback = useCallback((callback: () => void) => {
		markAsUncommittedRef.current = callback;
	}, []);

	useEffect(() => {
		markAsUncommittedRef.current = markAsUncommitted;
	}, [markAsUncommitted]);

	const isContentChangeSignificant = useCallback(
		(oldContent: string, newContent: string): boolean => {
			const normalize = (str: string) =>
				str
					.replace(/\s+/g, " ")
					.replace(/[""]/g, '"')
					.replace(/['']/g, "'")
					.trim()
					.toLowerCase();

			const normalizedOld = normalize(oldContent);
			const normalizedNew = normalize(newContent);

			const lengthDiff = Math.abs(normalizedOld.length - normalizedNew.length);

			return normalizedOld !== normalizedNew && lengthDiff > 5;
		},
		[],
	);

	const [isUpdatingPromptContent, setIsUpdatingPromptContent] = useState(false);

	const prevPromptIdRef = useRef<number | undefined>(promptId);

	useEffect(() => {
		const prevPromptId = prevPromptIdRef.current;
		const currentPromptId = promptId;

		if (prevPromptId !== undefined && prevPromptId !== currentPromptId) {
			clearAllState();
			setActivePromptId(currentPromptId);
		}

		prevPromptIdRef.current = currentPromptId;
	}, [promptId, clearAllState, setActivePromptId]);

	useEffect(() => {
		const currentContent = prompt?.prompt?.value || "";

		if (!isUpdatingPromptContent) {
			setOriginalPromptContent(currentContent);
		}
	}, [prompt?.prompt?.value, isUpdatingPromptContent, setOriginalPromptContent]);

	const updatePromptContent = useCallback(
		async (
			value: string,
			options?: { isEmpty?: boolean; isFormattingOnly?: boolean } & Options,
		) => {
			try {
				setIsUpdatingPromptContent(true);

				if (isUpdatingPromptContent) {
					return;
				}

				if (options?.isWithoutUpdate) {
					setIsUncommitted(true);
					return;
				}

				const currentPromptValue = prompt?.prompt?.value || "";
				const isSignificantChange = options?.isFormattingOnly
					? false
					: isContentChangeSignificant(currentPromptValue, value);

				if (options?.isFormattingOnly) {
					setIsFormattingUpdate(true);
				}

				const updateValue = options?.isEmpty ? "" : value;

				if (updateValue !== currentPromptValue) {
					setIsCommitted(false);

					await updatePromptName({ value: updateValue }, options as Options);
				}

				if (options?.isFormattingOnly) {
					setIsFormattingUpdate(false);
				}
			} catch (error) {
				console.error("Failed to update prompt content:", error);
			} finally {
				setIsUpdatingPromptContent(false);
			}
		},
		[
			updatePromptName,
			isUpdatingPromptContent,
			prompt?.prompt?.value,
			isContentChangeSignificant,
			setIsCommitted,
		],
	);

	const handleDiffSave = useCallback(
		(value: string) => {
			if (value) {
				updatePromptContent(value, {
					isWithoutUpdate: false,
					isFormattingOnly: false,
				});
				setCurrentAuditData(null);
				setIsPromptChangedAfterAudit(true);
			}
			setDiffModalInfo(null);
		},
		[updatePromptContent, setCurrentAuditData],
	);

	const handleSaveAsExpected = useCallback(
		async (newExpectedContent: UpdateExpected) => {
			const expectedOutputData = {
				answer: newExpectedContent.answer,
				tokens: storeOutputContent?.tokens || defaultPromptResponse.tokens,
				cost: storeOutputContent?.cost || defaultPromptResponse.cost,
				response_time_ms:
					storeOutputContent?.response_time_ms || defaultPromptResponse.response_time_ms,
				status: storeOutputContent?.status || defaultPromptResponse.status,
			};
			setExpectedOutput(expectedOutputData);

			if (!testcaseId) {
				return;
			}

			try {
				const updateData = {
					expectedOutput: newExpectedContent.answer,
					expectedChainOfThoughts: currentExpectedThoughts || "",
				};

				await testcasesApi.updateTestcase(testcaseId, updateData);
				if (promptId) await fetchTestcases(promptId);
			} catch (error) {
				console.error("Failed to save as expected:", error);
			}
		},
		[
			testcaseId,
			promptId,
			fetchTestcases,
			setExpectedOutput,
			storeOutputContent,
			currentExpectedThoughts,
		],
	);

	const inputRef = useRef<HTMLTextAreaElement>(null);

	const handlePromptUpdate = useCallback(
		async (newPrompt: string) => {
			await updatePromptContent(newPrompt);

			if (updatePromptError) {
				toast({
					title: "Update failed",
					description: "Failed to update system instructions.",
					variant: "destructive",
				});
			} else {
				toast({
					title: "Prompt updated",
					description: "System instructions have been updated successfully.",
				});
			}
		},
		[updatePromptContent, toast, updatePromptError],
	);

	useEffect(() => {
		if (!outputContent || !testcaseId || !testcase || !wasRun) {
			return;
		}

		setFlags({ status: outputContent.status });
		const assertionType = currentAssertionType || prompt?.prompt?.assertionType;
		if (assertionType === "AI" || assertionType === "STRICT") {
			setFlags({ modalOpen: true });
		}

		const fetchLatestPromptData = async () => {
			try {
				if (!promptId) return;
				const data = await promptApi.getPrompt(promptId);
				if (data.prompt?.testcaseStatuses) {
					window.dispatchEvent(
						new CustomEvent("testcaseStatusUpdated", {
							detail: {
								promptId,
								testcaseStatuses: data.prompt.testcaseStatuses,
							},
						}),
					);
				}
			} catch (error) {
				console.error("Failed to fetch latest prompt data:", error);
			}
		};

		setTimeout(fetchLatestPromptData, 500);
		setFlags({ wasRun: false });
	}, [
		outputContent,
		testcaseId,
		testcase,
		wasRun,
		prompt,
		currentAssertionType,
		promptId,
		setFlags,
	]);

	const handleRegisterClearFunction = useCallback((clearFn: () => void) => {
		clearExpectedOutputRef.current = clearFn;
	}, []);

	const handleInputBlur = useCallback(async () => {
		if (!testcaseId) return;

		if (inputContent !== lastSavedInputRef.current) {
			try {
				await testcasesApi.updateTestcase(testcaseId, { input: inputContent });
				lastSavedInputRef.current = inputContent;
				if (promptId) await fetchTestcases(promptId);
			} catch (error) {
				console.error("Failed to update testcase input:", error);
			}
		}
	}, [testcaseId, inputContent, promptId, fetchTestcases]);

	const handleRun = async () => {
		if (!promptId) return;

		setFlags({ clearedOutput: null });

		try {
			const { selectedMemoryId } = usePlaygroundStore.getState();

			const runParams = {
				question: inputContent,
				...(selectedMemoryId && { memoryId: Number(selectedMemoryId) }),
			};

			if (!testcaseId) {
				await runPrompt(promptId, runParams);
				return;
			}

			const result = await runPrompt(promptId, runParams, testcaseId);

			if (result) {
				setOutputContent(result);
				setFlags({ wasRun: true });

				await fetchTestcases(promptId);

				window.dispatchEvent(new CustomEvent("testcaseUpdated"));
			}
		} catch (error) {
			console.error("Failed to run prompt/testcase:", error);
			if (testcaseId) {
				await fetchTestcases(promptId);
			}
		}
	};

	const currentOutput = clearedOutput || storeOutputContent;
	const expectedContent = formatTestcaseOutput(testcase?.expectedOutput);

	const currentTokens = currentOutput?.tokens || defaultPromptResponse.tokens;
	const currentCost = currentOutput?.cost || defaultPromptResponse.cost;
	const currentResponseTime = currentOutput?.response_time_ms || null;

	const currentAuditRate = isPromptChangedAfterAudit
		? undefined
		: (currentAuditData?.rate ?? prompt?.prompt?.audit?.data?.rate);

	const sidebar = useSidebar();

	useEffect(() => {
		if (
			updatePromptError &&
			updatePromptError.includes("Prompt is not found") &&
			orgId &&
			projectId
		) {
			navigate(`/${orgId}/${projectId}/prompts`, { replace: true });
		}
	}, [updatePromptError, orgId, projectId, navigate]);

	return (
		<div className="h-full flex flex-grow-0 max-w-[1470px] ml-3 mr-3 lg:mr-6 w-full text-foreground">
			<div className="flex flex-col lg:flex-row w-full h-full items-start">
				<div className="flex w-full flex-col bg-card text-card-foreground border border-border rounded-[12px] mt-0 pt-3 pb-4 px-4 gap-8">
					{testcaseId && !testcase && isStatusCountsLoading ? (
						<div className="flex items-center justify-center h-full">
							<Loader2 className="animate-spin" />
							<span className="ml-2">Loading testcase...</span>
						</div>
					) : (
						<>
							<TextEditor
								isPromptInstructionsEditor
								title="System Instructions"
								main={true}
								onUpdatePrompt={updatePromptContent}
								tokens={currentTokens}
								cost={currentCost}
								responseTime={currentResponseTime}
								testcaseInput={testcase?.input}
								expectedContent={expectedContent}
								onAuditPrompt={auditPrompt}
								onOpenAuditModal={handleOpenAuditModal}
								isAuditLoading={isAuditLoading}
								canAudit={!!prompt?.prompt?.value}
								auditRate={currentAuditRate}
							/>

							<div>
								<InputTextArea
									ref={inputRef}
									onBlur={handleInputBlur}
									promptId={promptId}
									systemPrompt={prompt?.prompt?.value}
								/>

								<div className="flex flex-col gap-2 mt-3">
									<div className="flex justify-end">
										<Button
											disabled={
												!hasPromptContent ||
												!hasInputContent ||
												promptLoading ||
												runLoading
											}
											onClick={handleRun}
											className="text-[14px] h-[32px] w-[138px]"
										>
											{runLoading && <Loader2 className="animate-spin" />}
											{testcaseId ? "Run testcase" : "Run prompt"}
										</Button>
									</div>
								</div>
							</div>

							<OutputBlock
								key={testcaseId}
								promptName={prompt?.prompt?.name || ""}
								onSaveAsExpected={handleSaveAsExpected}
								systemPrompt={prompt?.prompt?.value}
								onPromptUpdate={handlePromptUpdate}
								onTestcaseAdded={handleTestcaseAdded}
								onRegisterClearFunction={handleRegisterClearFunction}
							/>
						</>
					)}
				</div>

				<div
					className={clsx(
						"w-full transition-all md:w-[322px] md:min-w-[322px] 2xl-plus:w-[400px] 2xl-plus:min-w-[400px] lg:pt-0 lg:pl-6",
						{ "xl:min-w-[400px]": !sidebar.open },
					)}
				>
					<SettingsBar
						prompt={prompt?.prompt}
						models={models}
						tokens={currentTokens}
						cost={currentCost}
						responseTime={currentResponseTime}
						updatePromptContent={updatePromptContent}
						onMarkAsUncommittedCallback={handleMarkAsUncommittedCallback}
						isUpdatingPromptContent={isUpdatingPromptContent}
					/>
				</div>
			</div>

			{testcase && (
				<TestcaseAssertionModal
					open={modalOpen}
					onClose={() => setFlags({ modalOpen: false })}
					// @ts-ignore
					testcase={testcase}
					status={status}
					assertionType={currentAssertionType}
				/>
			)}

			<AuditResultsModal
				auditData={currentAuditData || prompt?.prompt?.audit?.data || null}
				isLoading={isAuditLoading}
				isFixing={isFixing}
				isOpen={showAuditModal}
				onClose={handleCloseAuditModal}
				onRunAudit={handleRunAudit}
				onFixRisks={handleFixRisks}
				isDisabledFix={false}
			/>

			{diffModalInfo && (
				<PromptDiff
					isOpen={!!diffModalInfo}
					onOpenChange={(open) => !open && setDiffModalInfo(null)}
					original={prompt?.prompt?.value || ""}
					modified={diffModalInfo.prompt}
					isLoading={false}
					onSave={handleDiffSave}
				/>
			)}
		</div>
	);
}
