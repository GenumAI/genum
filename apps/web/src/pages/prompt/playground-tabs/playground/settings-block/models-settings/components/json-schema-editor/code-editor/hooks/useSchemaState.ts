import { useState, useEffect } from "react";
import type { PromptSettings } from "@/types/Prompt";
import { transformToVisualSchema, baseSchema, type VisualSchema } from "../../shared/schemaHelpers";
import { TabsValue } from "../../hooks/types";
import { validateStrictMode } from "../../shared/schemaHelpers";

interface UseSchemaStateProps {
	modelParameters: PromptSettings["languageModelConfig"];
}

export const useSchemaState = ({ modelParameters }: UseSchemaStateProps) => {
	const [schema, setSchema] = useState<VisualSchema>({
		name: "output_schema",
		type: "object",
		properties: [],
		strict: false,
		chainOfThoughts: false,
		promptStatus: false,
	});
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const [activeTab, setActiveTab] = useState<string>(TabsValue.VISUAL);
	const [code, setCode] = useState<string>("");

	useEffect(() => {
		try {
			const schemaToParse =
				typeof modelParameters.json_schema === "string"
					? JSON.parse(modelParameters.json_schema)
					: modelParameters.json_schema || {};

			if (Object.keys(schemaToParse).length === 0) {
				setSchema({ ...baseSchema, properties: [] });
			} else {
				let visualSchema = transformToVisualSchema(schemaToParse);
				visualSchema = validateStrictMode(visualSchema);
				setSchema(visualSchema);
			}
			setValidationErrors([]);
		} catch (error) {
			console.error("Error loading existing schema:", error);
			setSchema({ ...baseSchema, properties: [] });
			setValidationErrors(["Error loading existing schema"]);
		}
	}, [modelParameters.json_schema]);

	return {
		schema,
		setSchema,
		validationErrors,
		setValidationErrors,
		activeTab,
		setActiveTab,
		code,
		setCode,
	};
};
