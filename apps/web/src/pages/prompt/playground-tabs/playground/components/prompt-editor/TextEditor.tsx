import { useRef, memo, useMemo, useEffect } from "react";
import EditorCard from "./components/EditorCard";
import PromptDiff from "@/components/dialogs/PromptDiffDialog";
import MonacoEditor from "@/components/ui/MonacoEditor";
import FullscreenEditorDialog from "./components/FullscreenEditorDialog";
import { useTextEditor } from "./hooks/useTextEditor";

export interface EditorMetrics {
	tokens: {
		prompt: number;
		completion: number;
		total: number;
	} | null;
	cost: {
		prompt: number;
		completion: number;
		total: number;
	} | null;
	responseTime: number | null;
}

interface TextEditorProps {
	title: string;
	main?: boolean;
	content: string;
	onUpdatePrompt: (
		content: string,
		options?: {
			isEmpty?: boolean;
			isWithoutUpdate: boolean;
			isFormattingOnly?: boolean;
		},
	) => void;
	onLivePromptChange?: (content: string) => void;
	testcaseInput?: string;
	expectedContent?: any;
	metrics?: EditorMetrics;
	onAuditPrompt?: () => void;
	onOpenAuditModal?: () => void;
	isAuditLoading?: boolean;
	canAudit?: boolean;
	auditRate?: number;
	onReadyStateChange?: (isReady: boolean) => void;
}

const TextEditor = ({
	title,
	main,
	content,
	onUpdatePrompt,
	onLivePromptChange,
	testcaseInput,
	expectedContent,
	metrics,
	onAuditPrompt,
	onOpenAuditModal,
	isAuditLoading = false,
	canAudit = false,
	auditRate,
	onReadyStateChange,
}: TextEditorProps) => {
	const editorContainerRef = useRef<HTMLFieldSetElement>(null);

	const {
		mainEditor,
		fullscreenEditor,
		isExpanded,
		setIsExpanded,
		handleExpandToggle,
		isMarkdownPreview,
		handleMarkdownPreviewToggle,
		editorHeight,
		setEditorHeight,
		livePromptValue,
		promptText,
		setPromptText,
		tuneText,
		setTuneText,
		handleGenerate,
		handleTune,
		promptTuneLoading,
		promptTuneMutation,
		promptDiffDialog,
		tocItems,
		scrollToHeading,
		handleClearContent,
	} = useTextEditor({
		content,
		onUpdatePrompt,
		onLivePromptChange,
		testcaseInput,
		expectedContent,
	});

	const {
		handleEditorChange,
		handleEditorDidMount,
		handleStyle,
		handleUppercase,
		handleUndo,
		handleRedo,
	} = mainEditor;

	const editorCommands = useMemo(
		() => ({
			toggleBold: () => handleStyle("bold"),
			toggleItalic: () => handleStyle("italic"),
			toggleUnderline: () => handleStyle("underline"),
			toggleHeading: ({ level }: { level: number }) => handleStyle("heading", level),
			toggleUppercase: handleUppercase,
			toggleList: () => handleStyle("list"),
			toggleOrderedList: () => handleStyle("orderedList"),
		}),
		[handleStyle, handleUppercase],
	);

	useEffect(() => {
		onReadyStateChange?.(false);
		const frameId = window.requestAnimationFrame(() => {
			onReadyStateChange?.(true);
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [content, onReadyStateChange]);

	return (
		<>
			<fieldset
				ref={editorContainerRef}
				tabIndex={-1}
				aria-label="Editor container"
				className="relative m-0 w-full min-w-0 border-0 p-0"
				onBlur={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget)) {
						mainEditor.handleEditorBlur();
					}
				}}
			>
				<EditorCard
					title={title}
					editor={{
						value: livePromptValue,
						isEmpty: !livePromptValue.trim(),
						commands: editorCommands,
					}}
					isExpanded={isExpanded}
					setIsExpanded={handleExpandToggle}
					main={main}
					promptText={promptText}
					setPromptText={setPromptText}
					tuneText={tuneText}
					setTuneText={setTuneText}
					loading={promptTuneLoading}
					handleUndo={handleUndo}
					handleRedo={handleRedo}
					handleGenerate={handleGenerate}
					handleTune={handleTune}
					clearContent={handleClearContent}
					tokens={metrics?.tokens}
					cost={metrics?.cost}
					responseTime={metrics?.responseTime}
					onAuditPrompt={onAuditPrompt}
					onOpenAuditModal={onOpenAuditModal}
					isAuditLoading={isAuditLoading}
					canAudit={canAudit}
					auditRate={auditRate}
					isMarkdownPreview={isMarkdownPreview}
					onToggleMarkdownPreview={handleMarkdownPreviewToggle}
					editorHeight={editorHeight}
					setEditorHeight={setEditorHeight}
				>
					{!isMarkdownPreview && (
						<MonacoEditor
							height={`${editorHeight}px`}
							defaultLanguage="markdown"
							value={livePromptValue}
							onChange={handleEditorChange}
							onMount={handleEditorDidMount}
							width="100%"
							ariaLabel={title}
						/>
					)}
				</EditorCard>
			</fieldset>

			<FullscreenEditorDialog
				isOpen={isExpanded}
				onOpenChange={setIsExpanded}
				mainEditor={mainEditor}
				fullscreenEditor={fullscreenEditor}
				title={title}
				promptText={promptText}
				setPromptText={setPromptText}
				tuneText={tuneText}
				setTuneText={setTuneText}
				promptTuneLoading={promptTuneLoading}
				handleGenerate={handleGenerate}
				handleTune={handleTune}
				handleClearContent={handleClearContent}
				isMarkdownPreview={isMarkdownPreview}
				handleMarkdownPreviewToggle={handleMarkdownPreviewToggle}
				tocItems={tocItems}
				scrollToHeading={scrollToHeading}
			/>

			<PromptDiff
				isOpen={promptDiffDialog.isOpenPromptDiff}
				onOpenChange={promptDiffDialog.setIsOpenPromptDiff}
				original={livePromptValue}
				modified={promptTuneMutation.data?.prompt ?? ""}
				chainOfThoughts={promptTuneMutation.data?.chainOfThoughts ?? ""}
				isLoading={false}
				onSave={promptDiffDialog.onSaveTune}
			/>
		</>
	);
};

export default memo(TextEditor);
