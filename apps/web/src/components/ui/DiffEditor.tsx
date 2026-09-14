import React, { useEffect, useMemo, useRef, useState } from "react";
import {
	DiffEditor,
	type DiffEditorProps,
	type DiffOnMount,
	useMonaco,
} from "@monaco-editor/react";
import { parseJson } from "@/lib/jsonUtils";
import type { editor } from "monaco-editor";
import { useTheme } from "@/components/theme/theme-provider";
import { MONACO_THEME_NAMES, registerMonacoTheme } from "@/components/ui/monaco-theme";
import { useMonacoSetup } from "@/hooks/useMonacoSetup";

type DisposableHandle = {
	dispose: () => void;
};

type DiffSurfaceToken = "--editor-input-background" | "--background";

type CompareDiffEditorProps = DiffEditorProps & {
	onChange?: (value: string) => void;
	onBlur?: (value: string) => void;
	renderOverviewRuler?: boolean;
	maxHeight?: number;
	/**
	 * Floor for the auto-grown height, paired with `maxHeight`. Without one, a one-line
	 * diff sizes itself to a single line of content and the editor's own chrome -- ruler,
	 * scrollbar, padding -- has nowhere to go, which reads as a broken box rather than a
	 * short answer. Ignored unless `maxHeight` is set, since only then is the height ours.
	 */
	minHeight?: number;
	surfaceToken?: DiffSurfaceToken;
};

const LoadedCompareDiffEditor = ({
	onChange,
	onBlur,
	renderOverviewRuler = true,
	maxHeight,
	minHeight = 0,
	loading,
	surfaceToken = "--background",
	...props
}: CompareDiffEditorProps) => {
	const { resolvedTheme } = useTheme();
	const monaco = useMonaco();
	const monacoTheme = resolvedTheme
		? surfaceToken === "--background"
			? MONACO_THEME_NAMES[`${resolvedTheme}Surface`]
			: MONACO_THEME_NAMES[resolvedTheme]
		: MONACO_THEME_NAMES.light;

	const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
	const changeListenerRef = useRef<DisposableHandle | null>(null);
	const originalChangeListenerRef = useRef<DisposableHandle | null>(null);
	const blurListenerRef = useRef<DisposableHandle | null>(null);
	const layoutListenerRef = useRef<DisposableHandle | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const onChangeRef = useRef(onChange);
	const onBlurRef = useRef(onBlur);
	// `"100%"` fills whatever box the caller gave the editor -- the dialogs' behaviour, and
	// the reason this default stays. Auto-grown instances (`maxHeight`) have no such box:
	// their parent's height IS this number, so starting at `"100%"` would resolve against
	// an auto-height parent, lay the editor out at zero, and leave nothing for the content
	// listener to measure. They start at a real height instead and are corrected on mount.
	const [editorHeight, setEditorHeight] = useState<number | string>(
		maxHeight ? minHeight || maxHeight : "100%",
	);

	const original = useMemo(() => parseJson(props.original || ""), [props.original]);
	const modified = useMemo(() => parseJson(props.modified || ""), [props.modified]);

	useEffect(() => {
		onChangeRef.current = onChange;
	}, [onChange]);

	useEffect(() => {
		onBlurRef.current = onBlur;
	}, [onBlur]);

	useEffect(() => {
		if (!monaco || !resolvedTheme) {
			return;
		}

		registerMonacoTheme(monaco, resolvedTheme, { surfaceToken });
	}, [monaco, resolvedTheme, surfaceToken]);

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
		const calculatedHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);

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
			onChangeRef.current?.(newValue);
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

		if (onBlurRef.current) {
			blurListenerRef.current = modifiedEditor.onDidBlurEditorText(() => {
				const newValue = modifiedEditor.getValue();
				onBlurRef.current?.(newValue);
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
			{...props}
			// AFTER the spread, and merged rather than replaced. A caller passing `options`
			// means "these few, on top of the house style"; taking the prop as-is would
			// silently drop every default below -- word wrap, layout, the lot -- for
			// whoever asked to turn off a minimap.
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
				...props.options,
			}}
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

const CompareDiffEditor = (props: CompareDiffEditorProps) => {
	const isReady = useMonacoSetup();

	if (isReady) {
		return <LoadedCompareDiffEditor {...props} />;
	}

	// Reserves the editor's box so the surrounding layout does not jump when monaco lands.
	const placeholder = (
		<section
			style={{
				display: "flex",
				position: "relative",
				textAlign: "initial",
				width: props.width ?? "100%",
				height: props.height ?? "100%",
			}}
		>
			{props.loading}
		</section>
	);

	if (props.maxHeight) {
		return <div className="overflow-hidden">{placeholder}</div>;
	}

	return placeholder;
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
