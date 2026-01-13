import { useState, useEffect } from "react";
import {
	transformToVisualSchema,
	baseSchema,
	type VisualSchema,
} from "../../shared/utils/schemaHelpers";

import { TabsValue } from "../../shared/utils/types";

interface UseToolStateProps {
	editingTool?: any;
	open: boolean;
}

export const useToolState = ({ editingTool, open }: UseToolStateProps) => {
	const [toolName, setToolName] = useState("");
	const [toolDescription, setToolDescription] = useState("");
	const [schema, setSchema] = useState<VisualSchema>({ ...baseSchema, properties: [] });
	const [code, setCode] = useState<string>("");
	const [activeTab, setActiveTab] = useState<string>(TabsValue.VISUAL);
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const [nameExistsError, setNameExistsError] = useState(false);

	useEffect(() => {
		if (open) {
			if (editingTool) {
				setToolName(editingTool.name || "");
				setToolDescription(editingTool.description || "");

				try {
					const params = editingTool.parameters || {};
					const mockSchemaForTransform = {
						name: editingTool.name,
						strict: editingTool.strict,
						schema: params,
					};
					const visual = transformToVisualSchema(mockSchemaForTransform);
					setSchema(visual);
				} catch (e) {
					console.error("Error parsing tool parameters", e);
					setSchema({ ...baseSchema, properties: [] });
				}
			} else {
				setToolName("");
				setToolDescription("");
				setSchema({ ...baseSchema, properties: [] });
			}
			setActiveTab(TabsValue.VISUAL);
			setValidationErrors([]);
			setNameExistsError(false);
			setCode("");
		}
	}, [open, editingTool]);

	return {
		toolName,
		setToolName,
		toolDescription,
		setToolDescription,
		schema,
		setSchema,
		code,
		setCode,
		activeTab,
		setActiveTab,
		validationErrors,
		setValidationErrors,
		nameExistsError,
		setNameExistsError,
	};
};

export { TabsValue };
