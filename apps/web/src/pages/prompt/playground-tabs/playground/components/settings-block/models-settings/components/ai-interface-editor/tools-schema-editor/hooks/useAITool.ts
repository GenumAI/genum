import { transformToVisualSchema, type VisualSchema } from "../../shared/utils/schemaHelpers";

interface UseAIToolProps {
	setToolName: (name: string) => void;
	setToolDescription: (desc: string) => void;
	setSchema: (schema: VisualSchema) => void;
	setValidationErrors: (errors: string[]) => void;
	setActiveTab: (tab: string) => void;
}

import { TabsValue } from "../../shared/utils/types";
import type { ToolItem } from "../../../../utils/types";

export const useAITool = ({
	setToolName,
	setToolDescription,
	setSchema,
	setValidationErrors,
	setActiveTab,
}: UseAIToolProps) => {
	const handleToolReceived = (aiTool: string | (ToolItem & { function?: ToolItem })) => {
		try {
			const parsedTool = typeof aiTool === "string" ? JSON.parse(aiTool) : aiTool;

			// Support both { type: 'function', function: {...} } and direct { name, ... }
			const toolData = parsedTool.function || parsedTool;

			if (!toolData || typeof toolData !== "object") {
				throw new Error("Invalid tool format");
			}

			const newName = toolData.name || "";
			const newDesc = toolData.description || "";
			const newStrict = toolData.strict || false;
			const newParams = toolData.parameters || {};

			const mockSchema = {
				name: newName,
				strict: newStrict,
				schema: newParams,
			};
			const visual = transformToVisualSchema(mockSchema);

			setToolName(newName);
			setToolDescription(newDesc);
			setSchema(visual);
			setValidationErrors([]);
			setActiveTab(TabsValue.VISUAL);
		} catch (e) {
			console.error("Error applying AI tool:", e);
			setValidationErrors(["Error applying AI-generated tool"]);
		}
	};

	return { handleToolReceived };
};
