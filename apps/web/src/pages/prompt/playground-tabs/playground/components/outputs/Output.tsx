import { useState, useEffect, memo } from "react";
import { Card } from "@/components/ui/card";
import { useParams, useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/useToast";
import CompareDiffEditor from "@/components/ui/DiffEditor";
import { usePlaygroundContent } from "@/stores/playground.store";

import { useExpectedOutput } from "./hooks/useExpectedOutput";
import { useAssertions } from "./hooks/useAssertions";
import { useTestcaseActions } from "./hooks/useTestcaseActions";

import { MetricsDisplay } from "./components/MetricsDisplay";
import { OutputHeader } from "./components/OutputHeader";
import { OutputActions } from "./components/OutputActions";
import { ExpandedOutputDialog } from "./components/ExpandedOutputDialog";

export interface UpdateExpected {
	answer: string;
}

interface OutputBlockProps {
	onSaveAsExpected: (content: UpdateExpected) => Promise<void>;
	onTestcaseAdded?: () => void;
	onRegisterClearFunction?: (clearFn: () => void) => void;
}

const OutputBlock: React.FC<OutputBlockProps> = ({
	onSaveAsExpected,
	onTestcaseAdded,
	onRegisterClearFunction,
}) => {
	// Route params
	const { id } = useParams<{ id: string }>();
	const promptId = id ? Number(id) : undefined;
	const [searchParams] = useSearchParams();
	const testcaseId = searchParams.get("testcaseId");

	// Store
	const { inputContent: inputValue, outputContent: content } = usePlaygroundContent();
	const { toast } = useToast();

	// Local UI state
	const [isOpenAssertion, setIsOpenAssertion] = useState(false);
	const [isExpanded, setIsExpanded] = useState(false);

	// Custom hooks
	const {
		modifiedValue,
		expectedMetrics,
		clearExpectedOutput,
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
	} = useAssertions({ promptId });

	const { isTestcaseLoading, createTestcase } = useTestcaseActions({
		promptId,
		onTestcaseAdded,
	});

	// Register clear function
	useEffect(() => {
		if (onRegisterClearFunction) {
			onRegisterClearFunction(clearExpectedOutput);
		}
	}, [onRegisterClearFunction, clearExpectedOutput]);

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
		<div>
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
						key={`diff-${!!content?.answer}`}
						original={content?.answer}
						modified={modifiedValue}
						onBlur={saveModifiedValue}
						className="rounded-b-[6px]"
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
				onSaveModifiedValue={saveModifiedValue}
				onSaveAsExpected={handleSaveAsExpected}
				onAddTestcase={handleAddTestcase}
			/>
		</div>
	);
};

export default memo(OutputBlock);
