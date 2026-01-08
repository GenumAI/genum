import { useRef, useState, useEffect, useCallback } from "react";
import { useMonacoEditor } from "@/hooks/useMonacoEditor";
import { usePromptTune } from "@/hooks/usePromptTune";
import { useEditorViewState } from "@/hooks/useEditorViewState";
import { useMarkdownScrollToHeading } from "@/hooks/useMarkdownScrollToHeading";
import { usePromptDiffDialog } from "@/hooks/usePromptDiffDialog";
import { useAutoFocusEditorOnExpand } from "@/hooks/useEditorViewState";
import { useMarkdownTOC, useScrollToAnchor } from "@/hooks/useTOC";
import { usePlaygroundContent, usePlaygroundActions } from "@/stores/playground.store";
import { toast } from "@/hooks/useToast";

export type MonacoEditorReturn = ReturnType<typeof useMonacoEditor>;

interface UseTextEditorParams {
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
}

export function useTextEditor({
	onUpdatePrompt,
	testcaseInput,
	expectedContent,
}: UseTextEditorParams) {
	const { originalPromptContent, livePromptValue } = usePlaygroundContent();
	const { setOriginalPromptContent, setLivePromptValue } = usePlaygroundActions();

	const lastSavedValueRef = useRef<string>(originalPromptContent ?? "");
	const [editorHeight, setEditorHeight] = useState<number>(200);

	// Sync ref when content changes from outside
	useEffect(() => {
		if (originalPromptContent !== lastSavedValueRef.current) {
			lastSavedValueRef.current = originalPromptContent ?? "";
		}
	}, [originalPromptContent]);

	// Editor view state (expanded, markdown preview)
	const {
		isExpanded,
		setIsExpanded,
		handleExpandToggle,
		isMarkdownPreview,
		handleMarkdownPreviewToggle,
		hasSavedOnClose,
	} = useEditorViewState();

	// Content change handler
	const handleContentChange = useCallback(
		(value: string) => {
			setLivePromptValue(value);
		},
		[setLivePromptValue],
	);

	// Blur handler (save)
	const handleBlur = useCallback(
		(value: string) => {
			if (value !== lastSavedValueRef.current) {
				onUpdatePrompt(value, {
					isEmpty: !value.trim(),
					isWithoutUpdate: false,
				});
				lastSavedValueRef.current = value;
				setOriginalPromptContent(value);
			}
		},
		[onUpdatePrompt, setOriginalPromptContent],
	);

	// Main editor instance
	const mainEditor = useMonacoEditor({
		initialValue: originalPromptContent ?? "",
		onContentChange: handleContentChange,
		onBlur: handleBlur,
		onSaveOnCloseRef: hasSavedOnClose,
	});

	// Fullscreen editor instance
	const fullscreenEditor = useMonacoEditor({
		initialValue: originalPromptContent ?? "",
		onContentChange: handleContentChange,
		onBlur: handleBlur,
		onSaveOnCloseRef: hasSavedOnClose,
	});

	// Sync editors with external content changes
	useEffect(() => {
		if (isExpanded) return;
		const initialValue = originalPromptContent ?? "";
		setLivePromptValue(initialValue);
		if (mainEditor.editorValueRef.current !== initialValue) {
			mainEditor.handleEditorChange(initialValue);
		}
		if (fullscreenEditor.editorValueRef.current !== initialValue) {
			fullscreenEditor.handleEditorChange(initialValue);
		}
	}, [
		originalPromptContent,
		isExpanded,
		setLivePromptValue,
		mainEditor.handleEditorChange,
		mainEditor.editorValueRef,
		fullscreenEditor.handleEditorChange,
		fullscreenEditor.editorValueRef,
	]);

	// Prompt diff dialog
	const promptDiffDialog = usePromptDiffDialog(
		(value, options) => {
			setOriginalPromptContent(value);
			onUpdatePrompt(value, { isWithoutUpdate: false, ...options });
		},
		mainEditor.editorValueRef,
		mainEditor.editorRef,
		(value, options) => {
			onUpdatePrompt(value, { isWithoutUpdate: false, ...options });
		},
	);

	// Prompt tune functionality
	const {
		promptText,
		setPromptText,
		tuneText,
		setTuneText,
		handleGenerate,
		handleTune,
		loading: promptTuneLoading,
		promptTuneMutation,
	} = usePromptTune({
		editorValue: mainEditor.editorValueRef.current,
		testcaseInput,
		currentInputContent: originalPromptContent,
		expectedContent,
		onContentChange: (value: string) => {
			setOriginalPromptContent(value);
			onUpdatePrompt(value, { isWithoutUpdate: false });
		},
		setIsExpanded,
		toast,
		setIsOpenPromptDiff: promptDiffDialog.setIsOpenPromptDiff,
	});

	// Table of contents for markdown
	const tocItems = useMarkdownTOC(livePromptValue);
	const scrollToHeading = useMarkdownScrollToHeading({
		editorRef: fullscreenEditor.editorRef,
	});
	const scrollToAnchor = useScrollToAnchor({ block: "start" });

	// Auto focus on expand
	useAutoFocusEditorOnExpand(isExpanded, fullscreenEditor.editorRef);

	// Clear content handler
	const handleClearContent = useCallback(() => {
		mainEditor.handleEditorChange("");
		setOriginalPromptContent("");
		onUpdatePrompt("", { isEmpty: true, isWithoutUpdate: false });
	}, [mainEditor, setOriginalPromptContent, onUpdatePrompt]);

	return {
		// Store state
		originalPromptContent,
		livePromptValue,

		// Editor instances
		mainEditor,
		fullscreenEditor,

		// View state
		isExpanded,
		setIsExpanded,
		handleExpandToggle,
		isMarkdownPreview,
		handleMarkdownPreviewToggle,
		editorHeight,
		setEditorHeight,

		// Prompt tune
		promptText,
		setPromptText,
		tuneText,
		setTuneText,
		handleGenerate,
		handleTune,
		promptTuneLoading,
		promptTuneMutation,

		// Prompt diff
		promptDiffDialog,

		// TOC
		tocItems,
		scrollToHeading,
		scrollToAnchor,

		// Handlers
		handleClearContent,
		handleBlur,
	};
}
