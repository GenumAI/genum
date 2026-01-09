import { transformToVisualSchema, type VisualSchema } from "../shared/schemaHelpers";
import { TabsValue } from "./types";
import { validateStrictMode } from "../shared/schemaHelpers";

interface UseAISchemaProps {
	setSchema: (schema: VisualSchema) => void;
	setValidationErrors: (errors: string[]) => void;
	setActiveTab: (tab: string) => void;
}

export const useAISchema = ({ setSchema, setValidationErrors, setActiveTab }: UseAISchemaProps) => {
	const handleSchemaReceived = (aiSchema: any) => {
		try {
			let parsedSchema: any;
			if (typeof aiSchema === "string") {
				parsedSchema = JSON.parse(aiSchema);
			} else if (aiSchema && typeof aiSchema === "object" && aiSchema.schema) {
				parsedSchema = aiSchema.schema;
			} else {
				parsedSchema = aiSchema;
			}

			if (!parsedSchema || typeof parsedSchema !== "object") {
				throw new Error("Invalid schema format");
			}

			const schemaToTransform = parsedSchema.schema
				? parsedSchema
				: {
						name: "ai_generated_schema",
						strict: false,
						schema: parsedSchema,
					};

			let visualSchema = transformToVisualSchema(schemaToTransform);
			visualSchema = validateStrictMode(visualSchema);

			setSchema(visualSchema);
			setValidationErrors([]);
			setActiveTab(TabsValue.VISUAL);
		} catch (error) {
			console.error("Error applying AI schema:", error);
			setValidationErrors(["Error applying AI-generated schema"]);
		}
	};

	return {
		handleSchemaReceived,
	};
};
