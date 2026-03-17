import { memo } from "react";
import { ToolsSection } from "./ToolsSection";
import type { ToolItem } from "../utils/types";

interface ToolsBlockProps {
	show: boolean;
	tools: ToolItem[];
	editingToolIdx: number | null;
	setEditingToolIdx: (idx: number | null) => void;
	editingTool: ToolItem | null;
	setEditingTool: (tool: ToolItem | null) => void;
	toolsModalOpen: boolean;
	setToolsModalOpen: (open: boolean) => void;
	promptId?: number;
	llmConfig?: unknown;
	showAddFunction: boolean;
	isUpdatingModel: boolean;
	onToolDelete: (idx: number) => Promise<void>;
	onToolSave: (newTools: ToolItem[], editingIdx: number | null) => Promise<void>;
}

const areToolsEqual = (a: ToolItem[], b: ToolItem[]) => {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	return a.every((tool, index) => {
		const other = b[index];
		if (!other) return false;
		return (
			tool.name === other.name &&
			tool.description === other.description &&
			tool.strict === other.strict &&
			JSON.stringify(tool.parameters) === JSON.stringify(other.parameters)
		);
	});
};

const areToolItemsEqual = (a: ToolItem | null, b: ToolItem | null) => {
	if (a === b) return true;
	if (!a || !b) return false;
	return (
		a.name === b.name &&
		a.description === b.description &&
		a.strict === b.strict &&
		JSON.stringify(a.parameters) === JSON.stringify(b.parameters)
	);
};

export const ToolsBlock = memo(
	({
		show,
		tools,
		editingToolIdx,
		setEditingToolIdx,
		editingTool,
		setEditingTool,
		toolsModalOpen,
		setToolsModalOpen,
		promptId,
		llmConfig,
		showAddFunction,
		isUpdatingModel,
		onToolDelete,
		onToolSave,
	}: ToolsBlockProps) => {
		if (!show) return null;

		return (
			<ToolsSection
				tools={tools}
				editingToolIdx={editingToolIdx}
				setEditingToolIdx={setEditingToolIdx}
				editingTool={editingTool}
				setEditingTool={setEditingTool}
				toolsModalOpen={toolsModalOpen}
				setToolsModalOpen={setToolsModalOpen}
				promptId={promptId}
				llmConfig={llmConfig}
				showAddFunction={showAddFunction}
				isUpdatingModel={isUpdatingModel}
				onToolDelete={onToolDelete}
				onToolSave={onToolSave}
			/>
		);
	},
	(prev, next) => {
		return (
			prev.show === next.show &&
			areToolsEqual(prev.tools, next.tools) &&
			prev.editingToolIdx === next.editingToolIdx &&
			prev.setEditingToolIdx === next.setEditingToolIdx &&
			areToolItemsEqual(prev.editingTool, next.editingTool) &&
			prev.setEditingTool === next.setEditingTool &&
			prev.toolsModalOpen === next.toolsModalOpen &&
			prev.setToolsModalOpen === next.setToolsModalOpen &&
			prev.promptId === next.promptId &&
			prev.llmConfig === next.llmConfig &&
			prev.showAddFunction === next.showAddFunction &&
			prev.isUpdatingModel === next.isUpdatingModel &&
			prev.onToolDelete === next.onToolDelete &&
			prev.onToolSave === next.onToolSave
		);
	},
);

ToolsBlock.displayName = "ToolsBlock";
