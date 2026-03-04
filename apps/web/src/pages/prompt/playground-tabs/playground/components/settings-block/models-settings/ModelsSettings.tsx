import { useCallback, useEffect, useRef } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Form } from "@/components/ui/form";
import JsonSchemaModal from "./components/ai-interface-editor/json-schema-editor/JsonSchemaModal";
import { useModelsSettings } from "./hooks/useModelsSettings";
import { ModelSelectorBlock } from "./components/ModelSelectorBlock";
import { ResponseFormatBlock } from "./components/ResponseFormatBlock";
import { ToolsBlock } from "./components/ToolsBlock";
import { ParametersBlock } from "./components/ParametersBlock";
import type { ModelsSettingsProps } from "./utils/types";

const ModelsSettings = ({
	prompt,
	models,
	promptId: propPromptId,
	onValidationChange,
	isUpdatingPromptContent,
	onToolsSectionVisibilityChange,
}: ModelsSettingsProps) => {
	const {
		form,
		control,
		responseFormat,
		isUpdatingModel,
		isDataReady,
		loading,
		forceRenderKey,
		effectiveModels,
		selectedModelName,
		selectedModelId,
		activeModelConfig,
		isCurrentModelReasoning,
		groupedModels,
		getResponseFormatOptions,
		excludedParams,
		promptId,
		tools,
		editingToolIdx,
		setEditingToolIdx,
		editingTool,
		setEditingTool,
		schemaDialogOpen,
		setSchemaDialogOpen,
		toolsModalOpen,
		setToolsModalOpen,
		handleModelChange,
		handleResponseFormatChange,
		onSaveSchema,
		onFormChange,
		handleToolDelete,
		handleToolSave,
		currentJsonSchema,
	} = useModelsSettings({
		prompt,
		models,
		propPromptId,
		onValidationChange,
		isUpdatingPromptContent,
	});

	const reasoningEffortOptions = activeModelConfig?.parameters?.reasoning_effort?.allowed || [
		"none",
		"minimal",
		"low",
		"medium",
		"high",
		"xhigh",
	];
	const toolsParam = activeModelConfig?.parameters as Record<string, unknown> | undefined;
	const toolsEnabled =
		typeof toolsParam?.tools === "object" &&
		toolsParam?.tools !== null &&
		(toolsParam.tools as { enabled?: boolean }).enabled === true;
	const isCustomVendor =
		activeModelConfig?.vendor === "CUSTOM_OPENAI_COMPATIBLE" ||
		prompt?.languageModel?.vendor === "CUSTOM_OPENAI_COMPATIBLE";
	const showAddFunction = !isCustomVendor || toolsEnabled;
	const hasOtherParameters = Boolean(
		activeModelConfig?.parameters &&
			Object.keys(activeModelConfig.parameters).some((key) => key !== "tools"),
	);
	const handleModelChangeRef = useRef(handleModelChange);
	const handleResponseFormatChangeRef = useRef(handleResponseFormatChange);

	useEffect(() => {
		onToolsSectionVisibilityChange?.(hasOtherParameters);
	}, [onToolsSectionVisibilityChange, hasOtherParameters]);

	useEffect(() => {
		handleModelChangeRef.current = handleModelChange;
	}, [handleModelChange]);

	useEffect(() => {
		handleResponseFormatChangeRef.current = handleResponseFormatChange;
	}, [handleResponseFormatChange]);

	const handleModelChangeStable = useCallback((value: string) => {
		void handleModelChangeRef.current(value);
	}, []);

	const handleOpenSchemaDialog = useCallback(() => {
		setSchemaDialogOpen(true);
	}, [setSchemaDialogOpen]);

	const handleResponseFormatChangeStable = useCallback((value: string) => {
		void handleResponseFormatChangeRef.current(value);
	}, []);

	if (!models || models.length === 0) {
		return (
			<div className="flex flex-col gap-2">
				<div className="text-sm text-muted-foreground">Loading models...</div>
			</div>
		);
	}

	if (!isDataReady) {
		return (
			<div className="flex flex-col gap-2">
				<div className="text-sm text-muted-foreground">Loading configuration...</div>
			</div>
		);
	}

	return (
		<TooltipProvider>
			<Form {...form}>
				<form className="flex flex-col gap-2">
					<div className="flex flex-col gap-2">
						<ModelSelectorBlock
							models={effectiveModels}
							groupedModels={groupedModels}
							selectedModelName={selectedModelName}
							onModelChange={handleModelChangeStable}
							disabled={isUpdatingModel || loading}
							control={control}
						/>

						<ResponseFormatBlock
							show={Boolean(activeModelConfig?.parameters?.response_format)}
							control={control}
							formatOptions={getResponseFormatOptions}
							onFormatChange={handleResponseFormatChangeStable}
							disabled={loading}
							showEditSchema={responseFormat === "json_schema"}
							onOpenSchemaDialog={handleOpenSchemaDialog}
						/>

						<ToolsBlock
							show={showAddFunction}
							tools={tools}
							editingToolIdx={editingToolIdx}
							setEditingToolIdx={setEditingToolIdx}
							editingTool={editingTool}
							setEditingTool={setEditingTool}
							toolsModalOpen={toolsModalOpen}
							setToolsModalOpen={setToolsModalOpen}
							promptId={promptId}
							llmConfig={prompt?.languageModelConfig}
							showAddFunction={showAddFunction}
							isUpdatingModel={isUpdatingModel}
							onToolDelete={handleToolDelete}
							onToolSave={handleToolSave}
						/>
					</div>

					<ParametersBlock
						forceRenderKey={forceRenderKey}
						selectedModelId={selectedModelId}
						isCurrentModelReasoning={isCurrentModelReasoning}
						reasoningEffortOptions={reasoningEffortOptions}
						disabled={isUpdatingModel || loading}
						onFormChange={onFormChange}
						parameters={activeModelConfig?.parameters || {}}
						excludedParams={excludedParams}
						control={control}
					/>
				</form>

				{responseFormat === "json_schema" && !!prompt && (
					<JsonSchemaModal
						open={schemaDialogOpen}
						setOpen={setSchemaDialogOpen}
						promptId={promptId}
						jsonSchema={currentJsonSchema}
						onSave={onSaveSchema}
					/>
				)}
			</Form>
		</TooltipProvider>
	);
};

export default ModelsSettings;
