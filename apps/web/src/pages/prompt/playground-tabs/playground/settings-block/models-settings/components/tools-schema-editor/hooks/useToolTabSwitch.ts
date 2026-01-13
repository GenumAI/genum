import {
	transformToJsonSchema,
	transformToVisualSchema,
	checkVisualDuplicates,
	type VisualSchema,
} from "../../shared/utils/schemaHelpers";
import validator from "../../shared/utils/validator";

import { TabsValue } from "../../shared/utils/types";

// Helper to create tool object from visual schema
const createToolObject = (name: string, description: string, visualSchema: VisualSchema) => {
	const jsonSchema = transformToJsonSchema(visualSchema);
	return {
		name,
		description,
		strict: visualSchema.strict,
		parameters: jsonSchema.schema,
	};
};

interface UseToolTabSwitchProps {
	toolName: string;
	toolDescription: string;
	schema: VisualSchema;
	code: string;
	setToolName: (name: string) => void;
	setToolDescription: (desc: string) => void;
	setSchema: (schema: VisualSchema) => void;
	setCode: (code: string) => void;
	setActiveTab: (tab: string) => void;
	setValidationErrors: (errors: string[]) => void;
	validateTool: (name: string, schema: VisualSchema, strict: boolean) => string[];
}

export const useToolTabSwitch = ({
	toolName,
	toolDescription,
	schema,
	code,
	setToolName,
	setToolDescription,
	setSchema,
	setCode,
	setActiveTab,
	setValidationErrors,
	validateTool,
}: UseToolTabSwitchProps) => {
	const handleTabChange = (value: string) => {
		if (value === TabsValue.CODE) {
			// Visual -> Code
			const toolObj = createToolObject(toolName, toolDescription, schema);
			setCode(JSON.stringify(toolObj, null, 2));
			setActiveTab(TabsValue.CODE);
			validateTool(toolName, schema, false);
		} else {
			// Code -> Visual
			try {
				const parsed = JSON.parse(code);

				if (typeof parsed !== "object" || !parsed) {
					throw new Error("Invalid JSON");
				}

				const newName = parsed.name || "";
				const newDesc = parsed.description || "";
				const newStrict = parsed.strict || false;
				const newParams = parsed.parameters || {};

				const schemaErrors = validator.validate(newParams, false);

				if (schemaErrors.length === 0) {
					const mockSchema = {
						name: newName,
						strict: newStrict,
						schema: newParams,
					};
					const visual = transformToVisualSchema(mockSchema);
					const dupErrors = checkVisualDuplicates(visual);

					if (dupErrors.length === 0) {
						setToolName(newName);
						setToolDescription(newDesc);
						setSchema(visual);
						setValidationErrors([]);
						setActiveTab(TabsValue.VISUAL);
						return;
					} else {
						setValidationErrors(dupErrors);
						return;
					}
				}

				// If invalid, revert to visual state
				setActiveTab(TabsValue.VISUAL);
				validateTool(toolName, schema, false);
			} catch {
				setActiveTab(TabsValue.VISUAL);
				validateTool(toolName, schema, false);
			}
		}
	};

	return { handleTabChange, createToolObject };
};

export { TabsValue };
