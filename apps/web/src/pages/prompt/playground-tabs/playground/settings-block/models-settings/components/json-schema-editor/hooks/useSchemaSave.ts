import {
	transformToJsonSchema,
	type VisualSchema,
	type JsonSchemaRoot,
} from "../shared/schemaHelpers";
import { TabsValue } from "./types";

interface UseSchemaSaveProps {
	promptId: number | undefined;
	activeTab: string;
	code: string;
	schema: VisualSchema;
	setValidationErrors: (errors: string[]) => void;
	validateSchema: (jsonSchema: any, visualSchema?: VisualSchema, strict?: boolean) => string[];
	onSave: (data: { response_format: "json_schema"; json_schema: string }) => void;
	setOpen: (open: boolean) => void;
}

export const useSchemaSave = ({
	promptId,
	activeTab,
	code,
	schema,
	setValidationErrors,
	validateSchema,
	onSave,
	setOpen,
}: UseSchemaSaveProps) => {
	const handleSave = async () => {
		let jsonSchemaToSave: JsonSchemaRoot;

		if (activeTab === TabsValue.CODE) {
			try {
				const parsed = JSON.parse(code);
				const errors = validateSchema(parsed.schema, undefined, true);
				if (errors.length > 0) {
					setValidationErrors(errors);
					return;
				}
				jsonSchemaToSave = parsed;
			} catch {
				setValidationErrors(["Invalid JSON"]);
				return;
			}
		} else {
			const jsonSchema = transformToJsonSchema(schema);
			const errors = validateSchema(jsonSchema.schema, schema, true);
			if (errors.length > 0) {
				return;
			}
			jsonSchemaToSave = jsonSchema;
		}

		if (!promptId) {
			console.error("Prompt ID is missing");
			return;
		}

		try {
			onSave({
				response_format: "json_schema",
				json_schema: JSON.stringify(jsonSchemaToSave),
			});
			setOpen(false);
		} catch (error) {
			console.error("Error saving structured output config:", error);
			setValidationErrors(["Error saving configuration."]);
		}
	};

	return {
		handleSave,
	};
};
