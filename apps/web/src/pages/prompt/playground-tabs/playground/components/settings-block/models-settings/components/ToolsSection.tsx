import { memo, useCallback } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ToolsModal from "./ai-interface-editor/tools-schema-editor/ToolsDialog";
import type { ToolsSectionProps } from "../utils/types";

export const ToolsSection = memo(
	({
		tools,
		editingToolIdx,
		setEditingToolIdx,
		editingTool,
		setEditingTool,
		toolsModalOpen,
		setToolsModalOpen,
		promptId,
		isUpdatingModel,
		onToolDelete,
		onToolSave,
	}: Omit<ToolsSectionProps, "setTools" | "selectedModelId">) => {
		const handleToolClick = useCallback(
			(idx: number) => {
				setEditingToolIdx(idx);
				setEditingTool(tools[idx]);
				setToolsModalOpen(true);
			},
			[tools, setEditingToolIdx, setEditingTool, setToolsModalOpen],
		);

		const handleModalOpenChange = useCallback(
			(open: boolean) => {
				setToolsModalOpen(open);
				if (!open) {
					setEditingToolIdx(null);
					setEditingTool(null);
				}
			},
			[setToolsModalOpen, setEditingToolIdx, setEditingTool],
		);

		const handleSetTools = useCallback(
			async (newTools: typeof tools) => {
				await onToolSave(newTools, editingToolIdx);
				setEditingToolIdx(null);
				setEditingTool(null);
			},
			[onToolSave, editingToolIdx, setEditingToolIdx, setEditingTool],
		);

		return (
			<div className="flex flex-col mt-2 gap-2">
				<span className="text-[14px] font-medium leading-none">Tools</span>
				<Button
					type="button"
					variant="secondary"
					size="sm"
					className="w-full self-start px-1 py-1 gap-1 transition-colors"
					onClick={() => setToolsModalOpen(true)}
				>
					Add Function
				</Button>
				<div className="rounded-lg bg-trasparent mt-2 flex flex-col items-center justify-center">
					{Array.isArray(tools) && tools.length > 0 && (
						<div className="w-full flex flex-col gap-2">
							{tools.map((tool) => (
								<button
									key={tool.name}
									type="button"
									className="flex items-center justify-between px-3 py-2 mt-1 border rounded-lg hover:bg-muted h-9 cursor-pointer transition-colors w-full text-left"
									onClick={() => handleToolClick(tools.indexOf(tool))}
								>
									<span className="text-[14px]" title={tool.name}>
										{tool.name.length > 20
											? `${tool.name.slice(0, 20)}…`
											: tool.name}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="w-7 h-7 text-foreground hover:text-red-600 transition-colors"
										onClick={(e) => {
											e.stopPropagation();
											if (!isUpdatingModel) {
												onToolDelete(tools.indexOf(tool));
											}
										}}
									>
										<Trash2 className="w-4 h-4" />
									</Button>
								</button>
							))}
						</div>
					)}
				</div>
				<ToolsModal
					open={toolsModalOpen}
					onOpenChange={handleModalOpenChange}
					promptId={promptId}
					tools={tools}
					setTools={handleSetTools}
					editingTool={editingTool}
				/>
			</div>
		);
	},
);

ToolsSection.displayName = "ToolsSection";
