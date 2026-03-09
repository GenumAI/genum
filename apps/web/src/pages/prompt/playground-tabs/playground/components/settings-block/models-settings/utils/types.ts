import type { PromptSettings } from "@/types/Prompt";
import type { Model } from "@/types/AIModel";
import type { UseFormReturn } from "react-hook-form";
import type { ReactNode } from "react";

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
	onReadyStateChange?: (isReady: boolean) => void;
}

export interface RunMetricsProps {
	responseTime?: number | null;
	tokens?: TimeParam | null;
	cost?: TimeParam | null;
}

export interface ExecutionMetricsProps {
	responseTime?: number | null;
	totalTokens?: number;
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
	onToolsSectionVisibilityChange?: (visible: boolean) => void;
	loadingFallback?: ReactNode;
}

export interface FormSliderProps {
	name: keyof ModelSettingsFormValues;
	label: string;
	min: number;
	max: number;
	step: number;
	defaultValue?: number;
	disabled?: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
	onCommit?: (name: keyof ModelSettingsFormValues, value: number) => void;
}

export interface ToolItem {
	name: string;
	description?: string;
	parameters?: unknown;
	strict?: boolean;
}

export interface FormSelectFieldProps {
	name: keyof ModelSettingsFormValues;
	label: string;
	options: string[];
	defaultValue?: string;
	disabled?: boolean;
	control: UseFormReturn<ModelSettingsFormValues>["control"];
	onChange?: (name: keyof ModelSettingsFormValues, value: string) => void;
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
	showAddFunction: boolean;
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
	onFormChange: (
		overrides?: Partial<ModelSettingsFormValues>,
		options?: { immediate?: boolean },
	) => void;
}
