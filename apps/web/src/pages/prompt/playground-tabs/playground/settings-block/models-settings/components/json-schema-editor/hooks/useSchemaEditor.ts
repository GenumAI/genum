import { useCallback } from "react";
import type { VisualSchema, VisualProperty } from "../shared/schemaHelpers";
import { checkAllRequired, setAllRequired, hasDuplicates } from "../shared/schemaHelpers";
import { generateId } from "../shared/schemaHelpers";

interface UseSchemaEditorProps {
	schema: VisualSchema;
	onChange: (schema: VisualSchema) => void;
}

export const useSchemaEditor = ({ schema, onChange }: UseSchemaEditorProps) => {
	const handleAddProperty = useCallback(() => {
		const newProp: VisualProperty = {
			id: generateId(),
			name: "",
			type: "string",
			required: schema.strict,
			isArray: false,
		};
		onChange({ ...schema, properties: [...(schema.properties || []), newProp] });
	}, [schema, onChange]);

	const handleStrictToggle = useCallback(
		(val: boolean | "indeterminate") => {
			const isStrict = val === true;
			const updatedProperties = setAllRequired(schema.properties || [], isStrict);
			onChange({ ...schema, strict: isStrict, properties: updatedProperties });
		},
		[schema, onChange],
	);

	const handleUpdate = useCallback(
		(i: number, updated: VisualProperty) => {
			const updatedProps = [...schema.properties];
			updatedProps[i] = updated;

			let newStrict = schema.strict;

			if (schema.strict && !updated.required) {
				newStrict = false;
			} else if (!schema.strict && updated.required) {
				if (checkAllRequired(updatedProps)) {
					newStrict = true;
				}
			}

			if (newStrict) {
				if (!checkAllRequired(updatedProps)) {
					newStrict = false;
				}
			}

			onChange({ ...schema, properties: updatedProps, strict: newStrict });
		},
		[schema, onChange],
	);

	const handleRemove = useCallback(
		(i: number) => {
			const updatedProps = schema.properties.filter(
				(_: VisualProperty, idx: number) => idx !== i,
			);
			onChange({ ...schema, properties: updatedProps });
		},
		[schema, onChange],
	);

	const isAddDisabled = hasDuplicates(schema.properties || []);

	return {
		handleAddProperty,
		handleStrictToggle,
		handleUpdate,
		handleRemove,
		isAddDisabled,
	};
};
