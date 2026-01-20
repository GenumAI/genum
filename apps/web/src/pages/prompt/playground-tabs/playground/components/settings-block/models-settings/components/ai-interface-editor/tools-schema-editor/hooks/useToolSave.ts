import { transformToJsonSchema, type VisualSchema } from "../../shared/utils/schemaHelpers";
import validator from "../../shared/utils/validator";

import { TabsValue } from "../../shared/utils/types";

import type { ToolItem } from "../../../../utils/types";

interface UseToolSaveProps {
	activeTab: string;
	code: string;
	toolName: string;
	toolDescription: string;
	schema: VisualSchema;
	setValidationErrors: (errors: string[]) => void;
	validateTool: (name: string, schema: VisualSchema, strict: boolean) => string[];
	setTools?: (tools: ToolItem[]) => void;
	onOpenChange: (open: boolean) => void;
}

export const useToolSave = ({
	activeTab,
	code,
	toolName,
	toolDescription,
	schema,
	setValidationErrors,
	validateTool,
	setTools,
	onOpenChange,
}: UseToolSaveProps) => {
	const handleSave = () => {
		let toolToSave: ToolItem;

		if (activeTab === TabsValue.CODE) {
			try {
				const parsed = JSON.parse(code);
				const params = parsed.parameters || {};
				const schemaErrors = validator.validate(params, true);

				if (!parsed.name) {
					setValidationErrors(["Tool name is required", ...schemaErrors]);
					return;
				}

				if (schemaErrors.length > 0) {
					setValidationErrors(schemaErrors);
					return;
				}
				toolToSave = parsed;
			} catch {
				setValidationErrors(["Invalid JSON"]);
				return;
			}
		} else {
			const errors = validateTool(toolName, schema, true);
			if (errors.length > 0) return;

			const jsonSchema = transformToJsonSchema(schema);
			toolToSave = {
				name: toolName,
				description: toolDescription,
				strict: schema.strict,
				parameters: jsonSchema.schema,
			};
		}

		if (setTools) {
			setTools([toolToSave]);
		}
		onOpenChange(false);
	};

	return { handleSave };
};
