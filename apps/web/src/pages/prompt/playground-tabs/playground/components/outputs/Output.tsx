import { useState, useEffect, memo } from "react";
import { Card } from "@/components/ui/card";
import { useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import CompareDiffEditor from "@/components/ui/DiffEditor";
import type { PromptResponse } from "@/api/prompt";
import { usePlaygroundInput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundInput";
import { usePlaygroundOutput } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundOutput";

import { useExpectedOutput } from "./hooks/useExpectedOutput";
import { useAssertions } from "./hooks/useAssertions";
import { useTestcaseActions } from "./hooks/useTestcaseActions";

import { MetricsDisplay } from "./components/MetricsDisplay";
import { OutputHeader } from "./components/OutputHeader";
import { OutputActions } from "./components/OutputActions";
import { ExpandedOutputDialog } from "./components/ExpandedOutputDialog";

export interface UpdateExpected {
	answer: string;
	metrics?: Pick<PromptResponse, "tokens" | "cost" | "response_time_ms" | "status">;
}

interface OutputBlockProps {
	onSaveAsExpected: (content: UpdateExpected) => Promise<void>;
	onTestcaseAdded?: () => void;
	onRegisterClearFunction?: (clearFn: () => void) => void;
	selectedFiles?: Array<{ id: string }>;
	onTestcaseLoadingChange?: (isLoading: boolean) => void;
	isRunning?: boolean;
	serverAssertionType?: string;
	serverAssertionValue?: string;
}

const OutputBlock: React.FC<OutputBlockProps> = ({
	onSaveAsExpected,
	onTestcaseAdded,
	onRegisterClearFunction,
	selectedFiles,
	onTestcaseLoadingChange,
	isRunning,
	serverAssertionType,
	serverAssertionValue,
}) => {
	// Route params
	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");

	// Store/query state
	const { outputContent: content } = usePlaygroundOutput({ promptId, testcaseId });
	const { inputContent: inputValue } = usePlaygroundInput({ promptId, testcaseId });
	const { toast } = useToast();

	// Local UI state
	const [isOpenAssertion, setIsOpenAssertion] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	// Custom hooks
	const {
		modifiedValue,
		expectedMetrics,
		clearExpectedOutput,
		handleModifiedValueChange,
		saveModifiedValue,
		handleSaveAsExpected: handleSaveAsExpectedFromHook,
		hasValidOutput,
	} = useExpectedOutput({
		onSaveAsExpected,
		testcaseId,
		promptId,
	});

	const {
		currentAssertionType,
		assertionValue,
		handleAssertionTypeChange,
		handleAssertionValueChange,
		handleAssertionValueBlur,
	} = useAssertions({ promptId, serverAssertionType, serverAssertionValue });

	const { isTestcaseLoading, createTestcase } = useTestcaseActions({
		promptId,
		onTestcaseAdded,
		selectedFiles,
	});

	// Register clear function
	useEffect(() => {
		if (onRegisterClearFunction) {
			onRegisterClearFunction(clearExpectedOutput);
		}
	}, [onRegisterClearFunction, clearExpectedOutput]);
	useEffect(() => {
		if (onTestcaseLoadingChange) {
			onTestcaseLoadingChange(isTestcaseLoading);
		}
	}, [isTestcaseLoading, onTestcaseLoadingChange]);

	// Handlers
	const handleSaveAsExpected = async () => {
		const result = await handleSaveAsExpectedFromHook();
		if (result.success) {
			toast({
				title: "Saved as expected",
				description: "Output and thoughts copied from Last Output to Expected Output.",
			});
		}
	};

	const handleAddTestcase = async () => {
		const result = await createTestcase(inputValue || "", modifiedValue, content?.answer || "");
		if (result.success) {
			// Clear the form after successful creation
			// The hook already handles showing toast
		}
	};

	const handleOpenPlayground = () => {
		setIsExpanded(true);
	};

	return (
		<div className="w-full min-w-0">
			<OutputHeader
				promptId={promptId}
				currentAssertionType={currentAssertionType}
				assertionValue={assertionValue}
				isOpenAssertion={isOpenAssertion}
				onOpenAssertionChange={setIsOpenAssertion}
				onAssertionTypeChange={handleAssertionTypeChange}
				onAssertionValueChange={handleAssertionValueChange}
				onAssertionValueBlur={handleAssertionValueBlur}
				setAssertionValue={handleAssertionValueChange}
				toast={toast}
				onExpand={handleOpenPlayground}
			/>

			<Card className="w-full min-w-0 rounded-lg border shadow-sm">
				<div className="grid grid-cols-1 rounded-t-lg border-b text-xs dark:bg-[#27272A] sm:grid-cols-2">
					<div className="min-w-0">
						<MetricsDisplay title="Last Output" content={content || undefined} />
					</div>

					<div className="min-w-0 border-t sm:border-l sm:border-t-0">
						<MetricsDisplay title="Expected Output" content={expectedMetrics} />
					</div>
				</div>

				<div className="output-diff-container relative h-80 min-w-0 overflow-hidden rounded-b-[6px] text-sm">
					<CompareDiffEditor
						original={content?.answer}
						modified={modifiedValue}
						onChange={handleModifiedValueChange}
						onBlur={saveModifiedValue}
						className="output-diff-editor w-full min-w-0 rounded-b-[6px]"
					/>
				</div>
			</Card>

			<OutputActions
				hasValidOutput={hasValidOutput}
				testcaseId={testcaseId}
				isTestcaseLoading={isTestcaseLoading}
				modifiedValue={modifiedValue}
				onSaveAsExpected={handleSaveAsExpected}
				onAddTestcase={handleAddTestcase}
				isRunning={isRunning}
			/>

			<ExpandedOutputDialog
				isOpen={isExpanded}
				onOpenChange={setIsExpanded}
				content={content || undefined}
				expectedMetrics={expectedMetrics}
				modifiedValue={modifiedValue}
				testcaseId={testcaseId}
				isTestcaseLoading={isTestcaseLoading}
				hasValidOutput={hasValidOutput}
				onModifiedValueChange={handleModifiedValueChange}
				onSaveModifiedValue={saveModifiedValue}
				onSaveAsExpected={handleSaveAsExpected}
				onAddTestcase={handleAddTestcase}
				isRunning={isRunning}
			/>
		</div>
	);
};

export default memo(OutputBlock);
