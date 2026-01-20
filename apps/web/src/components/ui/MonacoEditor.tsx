import { useRef, useEffect, memo } from "react";
import Editor, { OnMount, EditorProps } from "@monaco-editor/react";
import { useTheme } from "@/components/theme/theme-provider";
import type { editor } from "monaco-editor";

export interface MonacoEditorProps extends Omit<EditorProps, "theme"> {
	/**
	 * Callback when editor is mounted
	 */
	onMount?: OnMount;
	/**
	 * Override default options
	 */
	options?: editor.IStandaloneEditorConstructionOptions;
	/**
	 * Auto dispose editor on unmount (default: true)
	 */
	autoDispose?: boolean;
	/**
	 * Aria label for accessibility
	 */
	ariaLabel?: string;
}

/**
 * Base Monaco Editor configuration options
 * These are the default settings used across the application
 */
const BASE_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
	minimap: { enabled: false },
	wordWrap: "on",
	fontSize: 14,
	lineNumbers: "off",
	scrollBeyondLastLine: false,
	padding: { top: 8, bottom: 8 },
	overviewRulerBorder: false,
	renderLineHighlight: "none",
	scrollbar: {
		vertical: "auto",
		horizontal: "auto",
		verticalScrollbarSize: 5,
	},
	tabSize: 2,
	cursorBlinking: "smooth",
	renderValidationDecorations: "off",
	contextmenu: false,
	hideCursorInOverviewRuler: true,
	cursorStyle: "line-thin",
	fontFamily: "Inter, sans-serif",
	accessibilitySupport: "off",
	stickyScroll: {
		enabled: false,
	},
	quickSuggestions: false,
	suggestOnTriggerCharacters: false,
	parameterHints: {
		enabled: false,
	},
	automaticLayout: true,
};

/**
 * Reusable Monaco Editor component with consistent defaults
 * Used across the application for code/JSON editing
 */
const MonacoEditor = ({
	onMount,
	options,
	autoDispose = true,
	ariaLabel,
	...props
}: MonacoEditorProps) => {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

	// Auto-dispose editor on unmount
	useEffect(() => {
		return () => {
			if (autoDispose && editorRef.current) {
				setTimeout(() => {
					if (editorRef.current?.dispose) {
						editorRef.current.dispose();
					}
					editorRef.current = null;
				}, 500);
			}
		};
	}, [autoDispose]);

	const handleEditorDidMount: OnMount = (editor, monaco) => {
		editorRef.current = editor;
		onMount?.(editor, monaco);
	};

	// Merge base options with custom options
	const mergedOptions: editor.IStandaloneEditorConstructionOptions = {
		...BASE_EDITOR_OPTIONS,
		...options,
		...(ariaLabel && { ariaLabel }),
	};

	return (
		<Editor
			theme={monacoTheme}
			options={mergedOptions}
			onMount={handleEditorDidMount}
			{...props}
		/>
	);
};

export default memo(MonacoEditor);

