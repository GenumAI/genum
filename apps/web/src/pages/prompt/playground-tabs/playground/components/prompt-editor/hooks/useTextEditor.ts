import { useState, useEffect, useCallback } from "react";
import { useMonacoEditor } from "@/hooks/useMonacoEditor";
import { usePromptTune } from "@/hooks/usePromptTune";
import { useEditorViewState } from "@/hooks/useEditorViewState";
import { useMarkdownScrollToHeading } from "@/hooks/useMarkdownScrollToHeading";
import { usePromptDiffDialog } from "@/hooks/usePromptDiffDialog";
import { useAutoFocusEditorOnExpand } from "@/hooks/useEditorViewState";
import { useMarkdownTOC, useScrollToAnchor } from "@/hooks/useTOC";
import { toast } from "@/hooks/useToast";

export type MonacoEditorReturn = ReturnType<typeof useMonacoEditor>;

interface UseTextEditorParams {
	content: string;
	onUpdatePrompt: (
		content: string,
		options?: {
			isEmpty?: boolean;
			isWithoutUpdate: boolean;
			isFormattingOnly?: boolean;
		},
	) => void;
	onLivePromptChange?: (value: string) => void;
	testcaseInput?: string;
	expectedContent?: any;
}

export function useTextEditor({
	content,
	onUpdatePrompt,
	onLivePromptChange,
	testcaseInput,
	expectedContent,
}: UseTextEditorParams) {
	const [editorHeight, setEditorHeight] = useState<number>(200);

	const {
		isExpanded,
		setIsExpanded,
		handleExpandToggle,
		isMarkdownPreview,
		handleMarkdownPreviewToggle,
		hasSavedOnClose,
	} = useEditorViewState();

	const handleContentChange = useCallback(
		(value: string) => {
			onLivePromptChange?.(value);
		},
		[onLivePromptChange],
	);

	const handleBlur = useCallback(
		(value: string) => {
			onUpdatePrompt(value, {
				isEmpty: !value.trim(),
				isWithoutUpdate: false,
			});
			onLivePromptChange?.(value);
		},
		[onUpdatePrompt, onLivePromptChange],
	);

	const mainEditor = useMonacoEditor({
		initialValue: content,
		onContentChange: handleContentChange,
		onBlur: handleBlur,
		onSaveOnCloseRef: hasSavedOnClose,
	});

	const fullscreenEditor = useMonacoEditor({
		initialValue: content,
		onContentChange: handleContentChange,
		onBlur: handleBlur,
		onSaveOnCloseRef: hasSavedOnClose,
	});

	useEffect(() => {
		if (isExpanded) return;
		if (mainEditor.editorValueRef.current !== content) {
			mainEditor.handleEditorChange(content);
		}
		if (fullscreenEditor.editorValueRef.current !== content) {
			fullscreenEditor.handleEditorChange(content);
		}
	}, [
		content,
		isExpanded,
		mainEditor.handleEditorChange,
		mainEditor.editorValueRef,
		fullscreenEditor.handleEditorChange,
		fullscreenEditor.editorValueRef,
	]);

	const promptDiffDialog = usePromptDiffDialog(
		(value, options) => {
			onLivePromptChange?.(value);
			onUpdatePrompt(value, { isWithoutUpdate: false, ...options });
		},
		mainEditor.editorValueRef,
		mainEditor.editorRef,
		(value, options) => {
			onUpdatePrompt(value, { isWithoutUpdate: false, ...options });
		},
	);

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
		currentInputContent: content,
		expectedContent,
		onContentChange: (value: string) => {
			onLivePromptChange?.(value);
			onUpdatePrompt(value, { isWithoutUpdate: false });
		},
		setIsExpanded,
		toast,
		setIsOpenPromptDiff: promptDiffDialog.setIsOpenPromptDiff,
	});

	const tocItems = useMarkdownTOC(content);
	const scrollToHeading = useMarkdownScrollToHeading({
		editorRef: fullscreenEditor.editorRef,
	});
	const scrollToAnchor = useScrollToAnchor({ block: "start" });

	useAutoFocusEditorOnExpand(isExpanded, fullscreenEditor.editorRef);

	const handleClearContent = useCallback(() => {
		mainEditor.handleEditorChange("");
		onLivePromptChange?.("");
		onUpdatePrompt("", { isEmpty: true, isWithoutUpdate: false });
	}, [mainEditor, onLivePromptChange, onUpdatePrompt]);

	return {
		livePromptValue: content,
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
		scrollToAnchor,
		handleClearContent,
		handleBlur,
	};
}
