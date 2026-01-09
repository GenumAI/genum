import validator from "../shared/validator";
import {
	transformToJsonSchema,
	checkVisualDuplicates,
	type VisualSchema,
} from "../shared/schemaHelpers";

interface UseSchemaValidationProps {
	setValidationErrors: (errors: string[]) => void;
}

export const useSchemaValidation = ({ setValidationErrors }: UseSchemaValidationProps) => {
	const validateSchema = (
		jsonSchema: any,
		visualSchema?: VisualSchema,
		strict: boolean = false,
	) => {
		const errors = validator.validate(jsonSchema, strict);

		if (visualSchema) {
			const dupErrors = checkVisualDuplicates(visualSchema);
			errors.push(...dupErrors);
		}

		setValidationErrors(errors);
		return errors;
	};

	const handleVisualChange = (
		newSchema: VisualSchema,
		setSchema: (schema: VisualSchema) => void,
	) => {
		setSchema(newSchema);
		const jsonSchema = transformToJsonSchema(newSchema);
		validateSchema(jsonSchema.schema, newSchema, false);
	};

	const handleCodeChange = (value: string | undefined, setCode: (code: string) => void) => {
		const newCode = value || "";
		setCode(newCode);

		try {
			const parsed = JSON.parse(newCode);
			const errors = validator.validate(parsed.schema, false);
			setValidationErrors(errors);
		} catch {
			setValidationErrors(["Invalid JSON syntax"]);
		}
	};

	return {
		validateSchema,
		handleVisualChange,
		handleCodeChange,
	};
};
