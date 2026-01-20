import { useState, useEffect } from "react";
import {
	transformToVisualSchema,
	baseSchema,
	type VisualSchema,
} from "../../shared/utils/schemaHelpers";
import { TabsValue } from "../../shared/utils/types";
import { validateStrictMode } from "../../shared/utils/schemaHelpers";

interface UseSchemaStateProps {
	jsonSchema: string | null;
	open: boolean;
}

export const useSchemaState = ({ jsonSchema, open }: UseSchemaStateProps) => {
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
		if (open) {
			try {
				const schemaToParse = jsonSchema ? JSON.parse(jsonSchema) : {};

				if (
					!schemaToParse ||
					typeof schemaToParse !== "object" ||
					Object.keys(schemaToParse).length === 0
				) {
					setSchema({ ...baseSchema, properties: [] });
				} else {
					let visualSchema = transformToVisualSchema(schemaToParse);
					visualSchema = validateStrictMode(visualSchema);
					setSchema(visualSchema);
				}
				setValidationErrors([]);
				setActiveTab(TabsValue.VISUAL);
				setCode("");
			} catch (error) {
				console.error("Error loading existing schema:", error);
				setSchema({ ...baseSchema, properties: [] });
				setValidationErrors(["Error loading existing schema"]);
			}
		}
	}, [open, jsonSchema]);

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
