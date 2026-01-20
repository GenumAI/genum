import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSchemaState } from "./hooks/useSchemaState";
import { useSchemaValidation } from "./hooks/useSchemaValidation";
import { useTabSwitch } from "./hooks/useTabSwitch";
import { useSchemaSave } from "./hooks/useSchemaSave";
import { useAISchema } from "./hooks/useAISchema";

import VisualSchemaEditor from "../shared/visual-editor/VisualSchemaEditor";
import CodeSchemaEditor from "./../shared/code-editor/CodeSchemaEditor";
import { TabsValue, type SchemaEditDialogProps } from "../shared/utils/types";
import { transformToJsonSchema, type VisualSchema } from "../shared/utils/schemaHelpers";
import { ValidationAlert } from "./../shared/code-editor/components/ValidationAlert";
import AIGenerateButton from "../shared/AIGenerateButton";

const JsonSchemaModal = ({
	open,
	setOpen,
	promptId,
	jsonSchema,
	onSave,
}: SchemaEditDialogProps) => {
	const {
		schema,
		setSchema,
		validationErrors,
		setValidationErrors,
		activeTab,
		setActiveTab,
		code,
		setCode,
	} = useSchemaState({ jsonSchema, open });

	const { validateSchema, handleVisualChange, handleCodeChange } = useSchemaValidation({
		setValidationErrors,
	});

	const { handleTabChange } = useTabSwitch({
		schema,
		code,
		setSchema,
		setCode,
		setActiveTab,
		setValidationErrors,
		validateSchema,
	});

	const { handleSave } = useSchemaSave({
		promptId,
		activeTab,
		code,
		schema,
		setValidationErrors,
		validateSchema,
		onSave,
		setOpen,
	});

	const { handleSchemaReceived } = useAISchema({
		setSchema,
		setValidationErrors,
		setActiveTab,
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="max-w-[800px] h-[800px] max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>JSON Schema</DialogTitle>
				</DialogHeader>

				<div className="flex-1 flex flex-col overflow-hidden">
					<ValidationAlert errors={validationErrors} />

					<Tabs
						value={activeTab}
						onValueChange={handleTabChange}
						className="flex-1 flex flex-col overflow-hidden"
					>
						<div className="flex items-center justify-between mb-4 flex-shrink-0">
							<TabsList>
								<TabsTrigger value={TabsValue.VISUAL}>Visual Editor</TabsTrigger>
								<TabsTrigger value={TabsValue.CODE}>Code Editor</TabsTrigger>
							</TabsList>
							{promptId && (
								<AIGenerateButton
									mode="schema"
									promptId={promptId}
									onReceived={handleSchemaReceived}
									existingData={transformToJsonSchema(schema)}
								/>
							)}
						</div>

						<TabsContent
							value={TabsValue.VISUAL}
							className="flex-1 min-h-0 data-[state=active]:flex flex-col"
						>
							<VisualSchemaEditor
								schema={schema}
								onChange={(newSchema: VisualSchema) =>
									handleVisualChange(newSchema, setSchema)
								}
								enableChainOfThoughts={true}
								enablePromptStatus={true}
							/>
						</TabsContent>

						<TabsContent
							value={TabsValue.CODE}
							className="flex-1 min-h-0 data-[state=active]:flex flex-col"
						>
							<CodeSchemaEditor
								code={code}
								onChange={(val) => handleCodeChange(val, setCode)}
								height="100%"
							/>
						</TabsContent>
					</Tabs>
				</div>

				<DialogFooter className="flex-shrink-0">
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={validationErrors.length > 0}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default JsonSchemaModal;
