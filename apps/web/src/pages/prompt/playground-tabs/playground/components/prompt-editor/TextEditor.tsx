import { useRef, memo, useMemo } from "react";
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
	onUpdatePrompt: (
		content: string,
		options?: {
			isEmpty?: boolean;
			isWithoutUpdate: boolean;
			isFormattingOnly?: boolean;
		},
	) => void;
	testcaseInput?: string;
	expectedContent?: any;
	metrics?: EditorMetrics;
	onAuditPrompt?: () => void;
	onOpenAuditModal?: () => void;
	isAuditLoading?: boolean;
	canAudit?: boolean;
	auditRate?: number;
}

const TextEditor = ({
	title,
	main,
	onUpdatePrompt,
	testcaseInput,
	expectedContent,
	metrics,
	onAuditPrompt,
	onOpenAuditModal,
	isAuditLoading = false,
	canAudit = false,
	auditRate,
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
		onUpdatePrompt,
		testcaseInput,
		expectedContent,
	});

	const {
		editorValueRef,
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

	return (
		<>
			<fieldset
				ref={editorContainerRef}
				tabIndex={-1}
				aria-label="Editor container"
				className="relative border-0 p-0 m-0"
				onBlur={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget)) {
						mainEditor.handleEditorBlur();
					}
				}}
			>
				<EditorCard
					title={title}
					editor={{
						value: editorValueRef.current,
						isEmpty: !editorValueRef.current.trim(),
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
							value={editorValueRef.current}
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
				original={mainEditor.editorValueRef.current}
				modified={promptTuneMutation.data?.prompt ?? ""}
				chainOfThoughts={promptTuneMutation.data?.chainOfThoughts ?? ""}
				isLoading={false}
				onSave={promptDiffDialog.onSaveTune}
			/>
		</>
	);
};

export default memo(TextEditor);
