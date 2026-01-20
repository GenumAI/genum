import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
	CornersOutIcon,
	TextBolderIcon,
	TextItalicIcon,
	TextHOneIcon,
	TextHTwoIcon,
	TextHThreeIcon,
	TextHFourIcon,
	TextHFiveIcon,
	TextHSixIcon,
	ListBulletsIcon,
	ListNumbersIcon,
	EyeIcon,
	EyeClosedIcon,
} from "@phosphor-icons/react";
import { Separator } from "@/components/ui/separator";
import { EditorContent } from "@tiptap/react";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useTooltipsEnabledOnExpand } from "@/hooks/useEditorViewState";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMarkdownHeadingComponentsWithScroll, getMarkdownTocItems } from "@/hooks/useTOC";
import { EditorToolbarButton } from "./EditorToolbarButton";
import { EditorActions } from "./EditorActions";
import { ResizeHandle } from "./ResizeHandle";
import { useEditorResize } from "../hooks/useEditorResize";

interface EditorCardProps {
	title: string;
	editor: any;
	isExpanded: boolean;
	setIsExpanded: (value: boolean) => void;
	main?: boolean;
	promptText?: string;
	setPromptText?: (value: string) => void;
	tuneText?: string;
	setTuneText?: (value: string) => void;
	loading?: boolean;
	handleUndo: () => void;
	handleRedo: () => void;
	handleGenerate?: () => void;
	handleTune?: () => void;
	clearContent?: () => void;
	tokens?: {
		prompt: number;
		completion: number;
		total: number;
	} | null;
	cost?: {
		prompt: number;
		completion: number;
		total: number;
	} | null;
	responseTime?: number | null;
	onAuditPrompt?: () => void;
	onOpenAuditModal?: () => void;
	isAuditLoading?: boolean;
	canAudit?: boolean;
	auditRate?: number;
	handleUppercase?: () => void;
	children?: React.ReactNode;
	isMarkdownPreview?: boolean;
	onToggleMarkdownPreview?: () => void;
	editorHeight?: number;
	setEditorHeight?: (height: number) => void;
}

const EditorCard = ({
	title,
	editor,
	isExpanded,
	setIsExpanded,
	main,
	promptText = "",
	setPromptText = () => {},
	tuneText = "",
	setTuneText = () => {},
	loading = false,
	handleGenerate = () => {},
	handleTune = () => {},
	clearContent = () => {},
	onAuditPrompt,
	onOpenAuditModal,
	isAuditLoading = false,
	canAudit = false,
	auditRate,
	children,
	isMarkdownPreview = false,
	onToggleMarkdownPreview,
	editorHeight,
	setEditorHeight,
}: EditorCardProps) => {
	const [isGeneratePopoverOpen, setIsGeneratePopoverOpen] = useState(false);
	const [isTunePopoverOpen, setIsTunePopoverOpen] = useState(false);
	const [wasLoading, setWasLoading] = useState(false);
	const tooltipsEnabled = useTooltipsEnabledOnExpand(isExpanded, 300);

	const { handleResizeStart } = useEditorResize({
		isExpanded,
		editorHeight,
		setEditorHeight,
	});

	useEffect(() => {
		if (wasLoading && !loading) {
			setIsGeneratePopoverOpen(false);
			setIsTunePopoverOpen(false);
		}
		setWasLoading(loading);
	}, [loading, wasLoading]);

	const tocItems = editor?.value ? getMarkdownTocItems(editor.value) : [];
	const headingComponents = useMarkdownHeadingComponentsWithScroll(tocItems);

	const toolbarButtons = [
		{
			icon: <TextBolderIcon style={{ width: "15px", height: "15px" }} />,
			tooltip: "Bold",
			onClick: () => editor.commands.toggleBold(),
		},
		{
			icon: <TextItalicIcon style={{ width: "15px", height: "15px" }} />,
			tooltip: "Italic",
			onClick: () => editor.commands.toggleItalic(),
		},
	];

	const headingButtons = [
		{
			icon: <TextHOneIcon style={{ width: "19px", height: "19px" }} />,
			tooltip: "Heading 1",
			onClick: () => editor.commands.toggleHeading({ level: 1 }),
		},
		{
			icon: <TextHTwoIcon style={{ width: "19px", height: "19px" }} />,
			tooltip: "Heading 2",
			onClick: () => editor.commands.toggleHeading({ level: 2 }),
		},
		{
			icon: <TextHThreeIcon style={{ width: "19px", height: "19px" }} />,
			tooltip: "Heading 3",
			onClick: () => editor.commands.toggleHeading({ level: 3 }),
		},
		{
			icon: <TextHFourIcon style={{ width: "19px", height: "19px" }} />,
			tooltip: "Heading 4",
			onClick: () => editor.commands.toggleHeading({ level: 4 }),
		},
		{
			icon: <TextHFiveIcon style={{ width: "19px", height: "19px" }} />,
			tooltip: "Heading 5",
			onClick: () => editor.commands.toggleHeading({ level: 5 }),
		},
		{
			icon: <TextHSixIcon style={{ width: "19px", height: "19px" }} />,
			tooltip: "Heading 6",
			onClick: () => editor.commands.toggleHeading({ level: 6 }),
		},
	];

	const listButtons = [
		{
			icon: <ListBulletsIcon style={{ width: "18px", height: "18px" }} />,
			tooltip: "Bullet List",
			onClick: () => editor.commands.toggleList(),
		},
		{
			icon: <ListNumbersIcon style={{ width: "18px", height: "18px" }} />,
			tooltip: "Numbered List",
			onClick: () => editor.commands.toggleOrderedList(),
		},
	];

	return (
		<div
			className={cn(
				"w-full tailwind-list-reset",
				!editorHeight && "h-full flex flex-col min-h-0",
			)}
		>
			<Card
				className={cn(
					"border-0 rounded-lg shadow-none",
					!editorHeight && "h-full flex flex-col min-h-0 dark:bg-[#313135]",
				)}
			>
				<CardHeader className="flex flex-row items-center justify-between p-0 pb-2 bg-background space-y-0 dark:bg-transparent">
					<div className="flex items-center gap-3">
						<CardTitle className="text-sm font-medium">{title}</CardTitle>
					</div>

					<div>
						{!isExpanded && (
							<TooltipProvider>
								<Tooltip>
									<TooltipTrigger asChild>
										<Button
											variant="ghost"
											size="icon"
											className="h-6 w-6 [&_svg]:size-3 text-[#09090B] dark:text-[#FAFAFA]"
											onClick={() => setIsExpanded(true)}
										>
											<CornersOutIcon
												style={{ width: "20px", height: "20px" }}
											/>
										</Button>
									</TooltipTrigger>
									<TooltipContent>
										<p>Expand</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						)}
					</div>
				</CardHeader>

				<div
					className={cn(
						"border shadow-sm rounded-md",
						!editorHeight && "flex flex-col h-full min-h-0",
					)}
				>
					<div className="px-2 py-1.5 bg-muted dark:bg-[#27272A] rounded-t-md">
						<div className="flex flex-wrap items-center gap-1">
							<div className="flex justify-between w-full">
								<div className="flex">
									{/* Text Formatting Buttons */}
									{toolbarButtons.map((button) => (
										<EditorToolbarButton
											key={button.tooltip}
											{...button}
											showTooltip={tooltipsEnabled}
										/>
									))}

									<Separator orientation="vertical" className="mx-1 h-6" />

									{/* Heading Buttons */}
									{headingButtons.map((button) => (
										<EditorToolbarButton key={button.tooltip} {...button} />
									))}

									<Separator orientation="vertical" className="mx-1 h-6" />

									{/* List Buttons */}
									{listButtons.map((button) => (
										<EditorToolbarButton key={button.tooltip} {...button} />
									))}

									<Separator orientation="vertical" className="mx-1 h-6" />

									{/* Preview Toggle Button */}
									<EditorToolbarButton
										icon={
											isMarkdownPreview ? (
												<EyeClosedIcon
													style={{ width: "18px", height: "18px" }}
												/>
											) : (
												<EyeIcon
													style={{ width: "18px", height: "18px" }}
												/>
											)
										}
										tooltip={
											isMarkdownPreview ? "Hide Preview" : "Show Preview"
										}
										onClick={onToggleMarkdownPreview || (() => {})}
									/>
								</div>

								<EditorActions
									main={main}
									editorIsEmpty={editor?.isEmpty || false}
									onAuditPrompt={onAuditPrompt}
									onOpenAuditModal={onOpenAuditModal}
									isAuditLoading={isAuditLoading}
									canAudit={canAudit}
									auditRate={auditRate}
									promptText={promptText}
									setPromptText={setPromptText}
									handleGenerate={handleGenerate}
									isGeneratePopoverOpen={isGeneratePopoverOpen}
									setIsGeneratePopoverOpen={setIsGeneratePopoverOpen}
									tuneText={tuneText}
									setTuneText={setTuneText}
									handleTune={handleTune}
									isTunePopoverOpen={isTunePopoverOpen}
									setIsTunePopoverOpen={setIsTunePopoverOpen}
									clearContent={clearContent}
									loading={loading}
								/>
							</div>
						</div>
					</div>

					<CardContent
						className={cn(
							"p-0 text-xs overflow-hidden rounded-bl-lg",
							!editorHeight && "flex-1 h-full min-h-0 flex flex-col",
						)}
						style={
							editorHeight
								? {
										height: `${editorHeight}px`,
										minHeight: 130,
										paddingTop: 0,
										paddingBottom: 0,
									}
								: {
										minHeight: 130,
										paddingTop: 0,
										paddingBottom: 0,
									}
						}
					>
						{isMarkdownPreview ? (
							<div
								className={cn(
									"text-sm max-w-full min-w-0 break-words break-all whitespace-pre-wrap overflow-auto [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_code]:break-words",
									!editorHeight && "h-full min-h-0 flex-1",
								)}
								style={editorHeight ? { height: `${editorHeight}px` } : {}}
							>
								<ReactMarkdown
									remarkPlugins={[remarkGfm]}
									components={headingComponents}
								>
									{editor.value || ""}
								</ReactMarkdown>
							</div>
						) : (
							<div
								className={cn(
									!editorHeight && "h-full min-h-0 flex-1 flex flex-col",
								)}
							>
								{children ? children : <EditorContent editor={editor} />}
							</div>
						)}
					</CardContent>

					<ResizeHandle isExpanded={isExpanded} onResizeStart={handleResizeStart} />
				</div>
			</Card>
		</div>
	);
};

export default EditorCard;
