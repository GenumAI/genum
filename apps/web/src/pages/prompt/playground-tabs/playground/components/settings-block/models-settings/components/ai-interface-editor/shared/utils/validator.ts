/**
 * Validates a JSON Schema object according to JSON Schema specification
 * @param schema - The JSON Schema object to validate
 * @param strict - Whether to perform strict validation (e.g. checking for empty names) - intended for Save action
 * @returns Array of error messages
 */

const validator = {
	validate: (schema: any, strict: boolean = false): string[] => {
		const errors: string[] = [];

		if (!schema || typeof schema !== "object") {
			errors.push("Schema must be an object");
			return errors;
		}

		if (schema.type) {
			if (typeof schema.type !== "string") {
				errors.push('Schema "type" must be a string');
			} else if (
				!["object", "array", "string", "number", "integer", "boolean", "null"].includes(
					schema.type,
				)
			) {
				errors.push(
					`Schema "type" must be one of: object, array, string, number, integer, boolean, null. Got: ${schema.type}`,
				);
			}
		}

		if (schema.properties) {
			if (typeof schema.properties !== "object" || Array.isArray(schema.properties)) {
				errors.push('Schema "properties" must be an object');
			} else {
				Object.keys(schema.properties).forEach((propName) => {
					if (strict && (!propName || propName.trim() === "")) {
						errors.push("Property name cannot be empty");
					}

					const prop = schema.properties[propName];
					if (!prop || typeof prop !== "object") {
						errors.push(`Property "${propName}" must be an object`);
						return;
					}

					const nestedErrors = validator.validate(prop, strict);
					nestedErrors.forEach((error) => {
						errors.push(`Property "${propName}": ${error}`);
					});
				});
			}
		}

		if (schema.type === "array") {
			if (schema.items) {
				if (typeof schema.items !== "object" || Array.isArray(schema.items)) {
					errors.push('Schema "items" must be an object');
				} else {
					const itemsErrors = validator.validate(schema.items, strict);
					itemsErrors.forEach((error) => {
						errors.push(`Array items: ${error}`);
					});
				}
			}
		}

		if (schema.required !== undefined) {
			if (!Array.isArray(schema.required)) {
				errors.push('Schema "required" must be an array');
			} else {
				schema.required.forEach((reqProp: any) => {
					if (typeof reqProp !== "string") {
						errors.push(
							`Required property name must be a string. Got: ${typeof reqProp}`,
						);
					} else if (schema.properties && !schema.properties[reqProp]) {
						errors.push(`Required property "${reqProp}" is not defined in properties`);
					}
				});
			}
		}

		if (schema.enum) {
			if (!Array.isArray(schema.enum)) {
				errors.push('Schema "enum" must be an array');
			} else if (strict && schema.enum.length === 0) {
				errors.push('Schema "enum" must have at least one value');
			}
		}

		if (
			schema.additionalProperties !== undefined &&
			typeof schema.additionalProperties !== "boolean" &&
			typeof schema.additionalProperties !== "object"
		) {
			errors.push('Schema "additionalProperties" must be a boolean or an object');
		}

		return errors;
	},
};

export default validator;
