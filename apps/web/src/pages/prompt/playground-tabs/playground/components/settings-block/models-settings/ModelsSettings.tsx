import { TooltipProvider } from "@/components/ui/tooltip";
import { Form } from "@/components/ui/form";
import JsonSchemaModal from "./components/ai-interface-editor/json-schema-editor/JsonSchemaModal";
import { useModelsSettings } from "./hooks/useModelsSettings";
import { ModelSelector } from "./components/ModelSelector";
import { ResponseFormatSection } from "./components/ResponseFormatSection";
import { ToolsSection } from "./components/ToolsSection";
import { ParameterFields } from "./components/ParameterFields";
import { FormSelectField } from "./components/FormSelectField";
import type { ModelsSettingsProps } from "./utils/types";

const ModelsSettings = ({
	prompt,
	models,
	promptId: propPromptId,
	onValidationChange,
	isUpdatingPromptContent,
}: ModelsSettingsProps) => {
	const {
		form,
		control,
		responseFormat,
		isUpdatingModel,
		isDataReady,
		loading,
		forceRenderKey,
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
	} = useModelsSettings({
		prompt,
		models,
		propPromptId,
		onValidationChange,
		isUpdatingPromptContent,
	});

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

	const reasoningEffortOptions = activeModelConfig?.parameters?.reasoning_effort?.allowed || [
		"none",
		"minimal",
		"low",
		"medium",
		"high",
		"xhigh",
	];

	return (
		<TooltipProvider>
			<Form {...form}>
				<form className="flex flex-col gap-2">
					<div className="flex flex-col gap-2">
						<ModelSelector
							models={models}
							groupedModels={groupedModels}
							selectedModelName={selectedModelName}
							onModelChange={handleModelChange}
							disabled={isUpdatingModel || loading}
							control={control}
						/>

						{activeModelConfig?.parameters?.response_format && (
							<ResponseFormatSection
								control={control}
								formatOptions={getResponseFormatOptions}
								onFormatChange={handleResponseFormatChange}
								disabled={isUpdatingModel || loading}
								showEditSchema={responseFormat === "json_schema"}
								onOpenSchemaDialog={() => setSchemaDialogOpen(true)}
							/>
						)}

						<ToolsSection
							tools={tools}
							editingToolIdx={editingToolIdx}
							setEditingToolIdx={setEditingToolIdx}
							editingTool={editingTool}
							setEditingTool={setEditingTool}
							toolsModalOpen={toolsModalOpen}
							setToolsModalOpen={setToolsModalOpen}
							promptId={promptId}
							llmConfig={prompt?.languageModelConfig}
							isUpdatingModel={isUpdatingModel}
							onToolDelete={handleToolDelete}
							onToolSave={handleToolSave}
						/>
					</div>

					<div key={`${forceRenderKey}-${selectedModelId}`} className="space-y-5 mt-2">
						{isCurrentModelReasoning && (
							<FormSelectField
								control={control}
								name="reasoningEffort"
								label="Reasoning Effort"
								options={reasoningEffortOptions}
								disabled={isUpdatingModel || loading}
								onChange={onFormChange}
							/>
						)}

						<ParameterFields
							parameters={activeModelConfig?.parameters || {}}
							excludedParams={excludedParams}
							disabled={isUpdatingModel || loading}
							control={control}
							onFormChange={onFormChange}
						/>
					</div>
				</form>

				{responseFormat === "json_schema" && !!prompt && (
					<JsonSchemaModal
						open={schemaDialogOpen}
						setOpen={setSchemaDialogOpen}
						promptId={promptId}
						modelParameters={prompt.languageModelConfig}
						onSave={onSaveSchema}
					/>
				)}
			</Form>
		</TooltipProvider>
	);
};

export default ModelsSettings;
