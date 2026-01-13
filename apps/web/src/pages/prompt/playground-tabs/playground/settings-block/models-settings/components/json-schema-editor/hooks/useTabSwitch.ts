import {
	transformToJsonSchema,
	transformToVisualSchema,
	checkVisualDuplicates,
	type VisualSchema,
} from "../../shared/utils/schemaHelpers";
import validator from "../../shared/utils/validator";
import { TabsValue } from "../../shared/utils/types";

interface UseTabSwitchProps {
	schema: VisualSchema;
	code: string;
	setSchema: (schema: VisualSchema) => void;
	setCode: (code: string) => void;
	setActiveTab: (tab: string) => void;
	setValidationErrors: (errors: string[]) => void;
	validateSchema: (jsonSchema: any, visualSchema?: VisualSchema, strict?: boolean) => string[];
}

export const useTabSwitch = ({
	schema,
	code,
	setSchema,
	setCode,
	setActiveTab,
	setValidationErrors,
	validateSchema,
}: UseTabSwitchProps) => {
	const handleTabChange = (value: string) => {
		if (value === TabsValue.CODE) {
			const jsonSchema = transformToJsonSchema(schema);
			setCode(JSON.stringify(jsonSchema, null, 2));
			setActiveTab(TabsValue.CODE);
			validateSchema(jsonSchema.schema, schema, false);
		} else {
			try {
				const parsed = JSON.parse(code);
				const errors = validator.validate(parsed.schema, false);

				if (errors.length === 0) {
					const visual = transformToVisualSchema(parsed);
					const dupErrors = checkVisualDuplicates(visual);

					if (dupErrors.length === 0) {
						setSchema(visual);
						setValidationErrors([]);
						setActiveTab(TabsValue.VISUAL);
						return;
					} else {
						setValidationErrors(dupErrors);
						return;
					}
				}

				setActiveTab(TabsValue.VISUAL);
				const currentJson = transformToJsonSchema(schema);
				validateSchema(currentJson.schema, schema, false);
			} catch {
				setActiveTab(TabsValue.VISUAL);
				const currentJson = transformToJsonSchema(schema);
				validateSchema(currentJson.schema, schema, false);
			}
		}
	};

	return {
		handleTabChange,
	};
};
