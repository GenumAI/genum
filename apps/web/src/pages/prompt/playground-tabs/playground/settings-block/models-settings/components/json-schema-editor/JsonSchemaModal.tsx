import { useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useSchemaState } from "./code-editor/hooks/useSchemaState";
import { useSchemaValidation } from "./hooks/useSchemaValidation";
import { useTabSwitch } from "./hooks/useTabSwitch";
import { useSchemaSave } from "./hooks/useSchemaSave";
import { useAISchema } from "./code-editor/hooks/useAISchema";

import VisualSchemaEditor from "./visual-editor/VisualSchemaEditor";
import CodeSchemaEditor from "./code-editor/CodeSchemaEditor";
import { TabsValue, type SchemaEditDialogProps } from "./hooks/types";
import { transformToJsonSchema, type VisualSchema } from "./shared/schemaHelpers";
import { ValidationAlert } from "./code-editor/components/ValidationAlert";
import AISchemaButton from "../AISchemaButton";

const JsonSchemaModal = ({
	open,
	setOpen,
	promptId,
	modelParameters,
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
	} = useSchemaState({ modelParameters });

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

	useEffect(() => {
		if (open) {
			setActiveTab(TabsValue.VISUAL);
		}
	}, [open, setActiveTab]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent 
				className="max-w-[800px] h-[700px] max-h-[90vh] flex flex-col"
			>
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
								<AISchemaButton
									promptId={promptId}
									onSchemaReceived={handleSchemaReceived}
									existingSchema={transformToJsonSchema(schema)}
								/>
							)}
						</div>

						<TabsContent 
							value={TabsValue.VISUAL} 
							className="flex-1 min-h-0 data-[state=active]:flex flex-col"
						>
							<VisualSchemaEditor
								schema={schema}
								onChange={(newSchema: VisualSchema) => handleVisualChange(newSchema, setSchema)}
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