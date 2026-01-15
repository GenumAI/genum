import type { PromptSettings, TLanguageModel } from "@/types/Prompt";
import type { Model } from "@/types/AIModel";
import type { UseFormReturn } from "react-hook-form";

export type TimeParam = {
	prompt: number;
	completion: number;
	total: number;
};

export interface SettingsBarProps {
	prompt?: PromptSettings;
	models: Model[];
	tokens?: TimeParam | null;
	cost?: TimeParam | null;
	responseTime?: number | null;
	updatePromptContent: (value: string) => void;
	isUpdatingPromptContent?: boolean;
}

export interface RunMetricsProps {
	responseTime?: number | null;
	tokens?: TimeParam | null;
	cost?: TimeParam | null;
}

export interface ExecutionMetricsProps {
	settings?: TLanguageModel;
	responseTime?: number | null;
	promptTokens?: number;
	completionTokens?: number;
}

export interface CostBreakdownMetricsProps {
	promptCost?: number;
	completionCost?: number;
	totalCost?: number;
}

// ModelsSettings types
export interface ModelSettingsFormValues {
	selectedModel: string;
	selectedModelId: number | null;
	maxTokens: number | null;
	temperature: number | null;
	topP: number | null;
	frequencyPenalty: number | null;
	presencePenalty: number | null;
	responseFormat: string;
	verbosity?: "low" | "medium" | "high" | null;
	reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | null;
}

export interface ModelsSettingsProps {
	models?: Model[];
	promptId?: number;
	prompt?: PromptSettings;
	onValidationChange?: (isValid: boolean) => void;
	isUpdatingPromptContent?: boolean;
}

export interface FormSliderProps {
	name: keyof ModelSettingsFormValues;
	label: string;
	min: number;
	max: number;
	step: number;
	disabled?: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
}

export interface ToolItem {
	name: string;
	description?: string;
	parameters?: unknown;
}

export interface FormSelectFieldProps {
	name: keyof ModelSettingsFormValues;
	label: string;
	options: string[];
	disabled?: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
	onChange?: (value: string) => void;
}

export interface ToolsSectionProps {
	tools: ToolItem[];
	setTools: (tools: ToolItem[]) => void;
	editingToolIdx: number | null;
	setEditingToolIdx: (idx: number | null) => void;
	editingTool: ToolItem | null;
	setEditingTool: (tool: ToolItem | null) => void;
	toolsModalOpen: boolean;
	setToolsModalOpen: (open: boolean) => void;
	promptId?: number;
	llmConfig?: unknown;
	selectedModelId: number | null;
	isUpdatingModel: boolean;
	onToolDelete: (idx: number) => Promise<void>;
	onToolSave: (newTools: ToolItem[], editingIdx: number | null) => Promise<void>;
}

export interface ParameterFieldsProps {
	parameters: Record<string, unknown>;
	excludedParams: string[];
	disabled: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
	onFormChange: () => void;
}
