import { useRef, useEffect, useState, memo } from "react";
import Editor, { OnMount, EditorProps, useMonaco } from "@monaco-editor/react";
import { useTheme } from "@/components/theme/theme-provider";
import type { editor } from "monaco-editor";
import { MONACO_THEME_NAMES, registerMonacoTheme } from "@/components/ui/monaco-theme";

let monacoSetup: Promise<unknown> | undefined;
let isMonacoSetupDone = false;

const ensureMonacoSetup = () => {
	if (!monacoSetup) {
		monacoSetup = import("@/lib/monaco-setup").then((setup) => {
			isMonacoSetupDone = true;
			return setup;
		});
	}

	return monacoSetup;
};

/**
 * Pulls monaco in on first use instead of at boot.
 *
 * Both <Editor> and useMonaco() call loader.init() when they mount, and the loader falls
 * back to fetching monaco from a CDN unless loader.config() ran first — so nothing may
 * touch @monaco-editor/react until monaco-setup has resolved.
 */
export const useMonacoSetup = () => {
	const [isReady, setIsReady] = useState(isMonacoSetupDone);

	useEffect(() => {
		if (isReady) {
			return;
		}

		let cancelled = false;
		ensureMonacoSetup().then(() => {
			if (!cancelled) {
				setIsReady(true);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [isReady]);

	return isReady;
};

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
	/**
	 * Which CSS token should be used for the editor surface.
	 */
	surfaceToken?: "--editor-input-background" | "--background";
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
const LoadedMonacoEditor = ({
	onMount,
	options,
	autoDispose = true,
	ariaLabel,
	surfaceToken = "--background",
	loading,
	...props
}: MonacoEditorProps) => {
	const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
	const monaco = useMonaco();
	const { resolvedTheme } = useTheme();
	const monacoTheme = resolvedTheme
		? surfaceToken === "--background"
			? MONACO_THEME_NAMES[`${resolvedTheme}Surface`]
			: MONACO_THEME_NAMES[resolvedTheme]
		: MONACO_THEME_NAMES.light;

	useEffect(() => {
		if (!monaco || !resolvedTheme) {
			return;
		}

		registerMonacoTheme(monaco, resolvedTheme, { surfaceToken });
	}, [monaco, resolvedTheme, surfaceToken]);

	useEffect(() => {
		return () => {
			if (autoDispose) {
				editorRef.current = null;
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
			loading={loading ?? null}
			options={mergedOptions}
			onMount={handleEditorDidMount}
			{...props}
		/>
	);
};

const MonacoEditor = (props: MonacoEditorProps) => {
	const isReady = useMonacoSetup();

	// Reserves the editor's box so the surrounding layout does not jump when monaco lands.
	if (!isReady) {
		return (
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
	}

	return <LoadedMonacoEditor {...props} />;
};

export default memo(MonacoEditor);
