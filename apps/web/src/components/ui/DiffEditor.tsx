import React, { useEffect, useMemo, useRef, useState } from "react";
import { DiffEditor, DiffEditorProps, DiffOnMount } from "@monaco-editor/react";
import { parseJson } from "@/lib/jsonUtils";
import { editor } from "monaco-editor";
import { useTheme } from "@/components/theme/theme-provider";

const CompareDiffEditor = ({
	onChange,
	onBlur,
	renderOverviewRuler = true,
	maxHeight,
	loading,
	...props
}: DiffEditorProps & {
	onChange?: (value: string) => void;
	onBlur?: (value: string) => void;
	renderOverviewRuler?: boolean;
	maxHeight?: number;
}) => {
	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

	const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
	const changeListenerRef = useRef<any>(null);
	const originalChangeListenerRef = useRef<any>(null);
	const blurListenerRef = useRef<any>(null);
	const layoutListenerRef = useRef<any>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [editorHeight, setEditorHeight] = useState<number | string>("100%");

	const original = useMemo(() => parseJson(props.original || ""), [props.original]);
	const modified = useMemo(() => parseJson(props.modified || ""), [props.modified]);

	useEffect(() => {
		return () => {
			if (changeListenerRef.current) {
				changeListenerRef.current.dispose();
				changeListenerRef.current = null;
			}

			if (originalChangeListenerRef.current) {
				originalChangeListenerRef.current.dispose();
				originalChangeListenerRef.current = null;
			}

			if (blurListenerRef.current) {
				blurListenerRef.current.dispose();
				blurListenerRef.current = null;
			}

			if (layoutListenerRef.current) {
				layoutListenerRef.current.dispose();
				layoutListenerRef.current = null;
			}

			if (editorRef.current) {
				editorRef.current.dispose();
				editorRef.current = null;
			}
		};
	}, []);

	const updateEditorHeight = () => {
		if (!editorRef.current || !maxHeight) return;

		const originalEditor = editorRef.current.getOriginalEditor();
		const modifiedEditor = editorRef.current.getModifiedEditor();
		const originalHeight = originalEditor.getContentHeight();
		const modifiedHeight = modifiedEditor.getContentHeight();
		const contentHeight = Math.max(originalHeight, modifiedHeight);
		const calculatedHeight = Math.min(contentHeight, maxHeight);

		setEditorHeight((prevHeight) => {
			if (calculatedHeight !== prevHeight) {
				return calculatedHeight;
			}
			return prevHeight;
		});
	};

	const handleEditorDidMount: DiffOnMount = (editor) => {
		editorRef.current = editor;
		const modifiedEditor = editor.getModifiedEditor();

		if (changeListenerRef.current) {
			changeListenerRef.current.dispose();
		}
		if (originalChangeListenerRef.current) {
			originalChangeListenerRef.current.dispose();
		}
		if (blurListenerRef.current) {
			blurListenerRef.current.dispose();
		}
		if (layoutListenerRef.current) {
			layoutListenerRef.current.dispose();
		}

		changeListenerRef.current = modifiedEditor.onDidChangeModelContent(() => {
			const newValue = modifiedEditor.getValue();
			onChange?.(newValue);
			if (maxHeight) {
				requestAnimationFrame(() => {
					updateEditorHeight();
				});
			}
		});

		// Also listen to original editor changes
		if (maxHeight) {
			const originalEditor = editor.getOriginalEditor();
			originalChangeListenerRef.current = originalEditor.onDidChangeModelContent(() => {
				requestAnimationFrame(() => {
					updateEditorHeight();
				});
			});
		}

		if (onBlur) {
			blurListenerRef.current = modifiedEditor.onDidBlurEditorText(() => {
				const newValue = modifiedEditor.getValue();
				onBlur(newValue);
			});
		}

		if (maxHeight) {
			const originalEditor = editor.getOriginalEditor();
			const originalLayoutListener = originalEditor.onDidLayoutChange(() => {
				updateEditorHeight();
			});
			const modifiedLayoutListener = modifiedEditor.onDidLayoutChange(() => {
				updateEditorHeight();
			});

			layoutListenerRef.current = {
				dispose: () => {
					originalLayoutListener.dispose();
					modifiedLayoutListener.dispose();
				},
			};

			requestAnimationFrame(() => {
				updateEditorHeight();
			});
		}
	};

	const originalData = detectLanguageFromContent(original);

	const editorElement = (
		<DiffEditor
			className="DiffEditor"
			language={originalData.language}
			theme={monacoTheme}
			height={typeof editorHeight === "number" ? `${editorHeight}px` : editorHeight}
			loading={loading ?? null}
			options={{
				renderSideBySide: true,
				enableSplitViewResizing: false,
				readOnly: false,
				domReadOnly: true,
				originalEditable: false,
				useInlineViewWhenSpaceIsLimited: false,
				scrollBeyondLastLine: false,
				wordWrap: "on",
				accessibilitySupport: "off",
				scrollbar: { vertical: "auto", horizontal: "auto", verticalScrollbarSize: 5 },
				automaticLayout: true,
				lineNumbers: "on",
				contextmenu: false,
				lineNumbersMinChars: 1,
				lineDecorationsWidth: 10,
				renderOverviewRuler,
				renderIndicators: false,
				overviewRulerBorder: false,
				minimap: { enabled: true },
				glyphMargin: true,
				folding: false,
				renderGutterMenu: false,
				fontFamily: "Inter, sans-serif",
				stickyScroll: {
					enabled: false,
				},
				padding: { top: 0, bottom: 0 },
				lineHeight: 18,
			}}
			{...props}
			original={original}
			modified={modified}
			onMount={handleEditorDidMount}
		/>
	);

	// Only wrap in div when maxHeight is specified to avoid breaking existing layouts
	if (maxHeight) {
		return (
			<div ref={containerRef} className="overflow-hidden">
				{editorElement}
			</div>
		);
	}

	return editorElement;
};

export default CompareDiffEditor;

function detectLanguageFromContent(content: string): {
	value: string;
	language: "json" | "plaintext";
} {
	try {
		const parsed = JSON.parse(content);
		if (typeof parsed === "object" && parsed !== null) {
			return { value: JSON.stringify(parsed, null, 2), language: "json" };
		}
		return { value: content, language: "plaintext" };
	} catch {
		return { value: content, language: "plaintext" };
	}
}
