import {
	transformToJsonSchema,
	checkVisualDuplicates,
	type VisualSchema,
} from "../../shared/utils/schemaHelpers";
import validator from "../../shared/utils/validator";

import type { ToolItem } from "../../../../utils/types";

interface UseToolValidationProps {
	tools?: ToolItem[];
	editingTool?: ToolItem | null;
	setValidationErrors: (errors: string[]) => void;
	setNameExistsError: (exists: boolean) => void;
}

export const useToolValidation = ({
	tools,
	editingTool,
	setValidationErrors,
	setNameExistsError,
}: UseToolValidationProps) => {
	const validateTool = (
		currentName: string,
		currentSchema: VisualSchema,
		strict: boolean,
	): string[] => {
		const errors: string[] = [];

		if (!currentName.trim()) {
			errors.push("Tool name is required");
		}

		// Check for duplicate names in tools list
		if (tools && currentName.trim()) {
			const lowerName = currentName.trim().toLowerCase();
			const editingName = editingTool?.name?.trim().toLowerCase();
			const exists = tools.some(
				(t) => t.name?.trim().toLowerCase() === lowerName && lowerName !== editingName,
			);
			if (exists) {
				errors.push("Tool with this name already exists");
				setNameExistsError(true);
			} else {
				setNameExistsError(false);
			}
		}

		// Validate Schema
		const jsonSchema = transformToJsonSchema(currentSchema);
		const schemaErrors = validator.validate(jsonSchema.schema, strict);
		errors.push(...schemaErrors);

		// Check for duplicate property names
		const visualDupErrors = checkVisualDuplicates(currentSchema);
		errors.push(...visualDupErrors);

		setValidationErrors(errors);
		return errors;
	};

	const validateCodeTool = (code: string, strict: boolean): string[] => {
		try {
			const parsed = JSON.parse(code);
			const params = parsed.parameters || {};
			const schemaErrors = validator.validate(params, strict);

			const nameErrors: string[] = [];
			if (!parsed.name) {
				nameErrors.push("Name is missing in JSON");
			}

			const allErrors = [...nameErrors, ...schemaErrors];
			setValidationErrors(allErrors);
			return allErrors;
		} catch {
			const errors = ["Invalid JSON syntax"];
			setValidationErrors(errors);
			return errors;
		}
	};

	return {
		validateTool,
		validateCodeTool,
	};
};
