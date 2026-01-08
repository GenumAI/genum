import { memo } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import EditorCard from "./EditorCard";
import TableOfContents from "@/components/ui/TableOfContents";
import MonacoEditor from "@/components/ui/MonacoEditor";
import type { MonacoEditorReturn } from "../hooks/useTextEditor";
import type { MarkdownTocItem } from "@/hooks/useTOC";

interface FullscreenEditorDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	mainEditor: MonacoEditorReturn;
	fullscreenEditor: MonacoEditorReturn;
	title: string;
	promptText: string;
	setPromptText: (value: string) => void;
	tuneText: string;
	setTuneText: (value: string) => void;
	promptTuneLoading: boolean;
	handleGenerate: () => void;
	handleTune: () => void;
	handleClearContent: () => void;
	isMarkdownPreview: boolean;
	handleMarkdownPreviewToggle: () => void;
	tocItems: MarkdownTocItem[];
	scrollToHeading: (id: string) => void;
}

const FullscreenEditorDialog = ({
	isOpen,
	onOpenChange,
	mainEditor,
	fullscreenEditor,
	title,
	promptText,
	setPromptText,
	tuneText,
	setTuneText,
	promptTuneLoading,
	handleGenerate,
	handleTune,
	handleClearContent,
	isMarkdownPreview,
	handleMarkdownPreviewToggle,
	tocItems,
	scrollToHeading,
}: FullscreenEditorDialogProps) => {
	const {
		editorValueRef,
		handleEditorChange,
		handleEditorDidMount,
		handleStyle,
		handleUppercase,
		handleUndo,
		handleRedo,
	} = fullscreenEditor;

	const handleDialogOpenChange = (open: boolean) => {
		if (open) {
			// Sync from main to fullscreen
			const val = mainEditor.editorValueRef.current;
			fullscreenEditor.editorRef.current?.setValue(val);
			fullscreenEditor.editorValueRef.current = val;
		} else {
			// Sync from fullscreen to main
			const val = fullscreenEditor.editorValueRef.current;
			mainEditor.editorRef.current?.setValue(val);
			mainEditor.editorValueRef.current = val;
			fullscreenEditor.handleEditorBlur();
			mainEditor.handleEditorBlur();
		}
		onOpenChange(open);
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
			<DialogContent
				onEscapeKeyDown={(e) => e.preventDefault()}
				className="max-w-6xl w-full h-[80vh] min-h-[500px] py-6 px-4 flex flex-col"
				onMouseDown={(e) => {
					const target = e.target as HTMLElement;
					const editorElement = fullscreenEditor.editorRef.current?.getDomNode();
					if (editorElement && !editorElement.contains(target)) {
						fullscreenEditor.handleEditorBlur();
					}
				}}
			>
				<VisuallyHidden>
					<DialogTitle>Editor Fullscreen</DialogTitle>
					<DialogDescription>Fullscreen editor view</DialogDescription>
				</VisuallyHidden>

				<div className="flex-1 flex flex-row w-full gap-6 min-h-0">
					<div className="flex flex-col h-full min-h-0" style={{ width: "80%" }}>
						<EditorCard
							title={title}
							editor={{
								value: editorValueRef.current,
								isEmpty: !editorValueRef.current.trim(),
								commands: {
									toggleBold: () => handleStyle("bold"),
									toggleItalic: () => handleStyle("italic"),
									toggleUnderline: () => handleStyle("underline"),
									toggleHeading: ({ level }: { level: number }) =>
										handleStyle("heading", level),
									toggleUppercase: handleUppercase,
									toggleList: () => handleStyle("list"),
									toggleOrderedList: () => handleStyle("orderedList"),
								},
							}}
							isExpanded={isOpen}
							setIsExpanded={onOpenChange}
							main={true}
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
							handleUppercase={handleUppercase}
							isMarkdownPreview={isMarkdownPreview}
							onToggleMarkdownPreview={handleMarkdownPreviewToggle}
							editorHeight={undefined}
							setEditorHeight={undefined}
						>
							{!isMarkdownPreview && (
								<MonacoEditor
									height="100%"
									defaultLanguage="markdown"
									value={editorValueRef.current}
									onChange={handleEditorChange}
									onMount={handleEditorDidMount}
									width="100%"
									ariaLabel={title}
								/>
							)}
						</EditorCard>
					</div>

					<div className="text-sm text-gray-800 flex flex-col gap-[6px] pt-16 max-w-[195px] w-full min-h-0 flex-1">
						<div className="flex-1 min-h-0 flex flex-col">
							<TableOfContents
								items={tocItems}
								onItemClick={scrollToHeading}
								className="max-h-[69vh] overflow-y-auto overflow-x-hidden"
							/>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};

export default memo(FullscreenEditorDialog);
