// --- Interfaces ---

export interface VisualProperty {
	name: string;
	type: string;
	description?: string;
	required: boolean;
	isArray: boolean;
	properties?: VisualProperty[];
	enum?: string[];
}

export interface VisualSchema {
	name: string;
	type: string;
	properties: VisualProperty[];
	strict: boolean;
	chainOfThoughts: boolean;
	promptStatus: boolean;
}

// Helper interfaces for JSON Schema
export interface JsonSchemaProperty {
	type: string;
	description?: string;
	properties?: Record<string, JsonSchemaProperty>;
	required?: string[];
	items?: JsonSchemaProperty;
	enum?: string[];
	additionalProperties?: boolean;
}

export interface JsonSchemaRoot {
	name: string;
	strict: boolean;
	schema: {
		type: string;
		properties: Record<string, JsonSchemaProperty>;
		required: string[];
		additionalProperties: boolean;
	};
}

// --- Transform Functions ---

export const baseSchema: VisualSchema = {
	name: "output_schema",
	type: "object",
	properties: [],
	strict: false,
	chainOfThoughts: false,
	promptStatus: false,
};

export const transformToJsonSchema = (
	visualSchema: VisualSchema | { type: string; properties: VisualProperty[]; strict: boolean },
): JsonSchemaRoot => {
	// Base structure
	const jsonSchema: JsonSchemaRoot = {
		name: (visualSchema as VisualSchema).name || "output_schema",
		strict: visualSchema.strict || false,
		schema: {
			type: "object",
			properties: {},
			required: [],
			additionalProperties: !visualSchema.strict,
		},
	};

	const processProperties = (properties: VisualProperty[], strict: boolean) => {
		const propsObject: Record<string, JsonSchemaProperty> = {};
		const requiredList: string[] = [];

		const filteredProperties = properties.filter(
			(prop) => prop.name !== "chainOfThoughts" && prop.name !== "status",
		);

		filteredProperties.forEach((property) => {
			const propSchema: JsonSchemaProperty = {
				type: property.type,
				description: property.description,
			};

			if (property.isArray) {
				propSchema.type = "array";
				propSchema.items = {
					type: property.type,
					additionalProperties: !strict,
				};

				if (property.type === "object" && property.properties) {
					const nestedResult = processProperties(property.properties, strict);
					propSchema.items.properties = nestedResult.properties;
					propSchema.items.required = nestedResult.required;
					propSchema.items.type = "object";
				}
			} else {
				if (property.type === "object" && property.properties) {
					const nestedResult = processProperties(property.properties, strict);
					propSchema.properties = nestedResult.properties;
					propSchema.required = nestedResult.required;
					propSchema.additionalProperties = !strict;
				}

				if (property.type === "enum" && property.enum) {
					propSchema.type = "string";
					propSchema.enum = property.enum;
				}
			}

			if (property.required) {
				requiredList.push(property.name);
			}

			propsObject[property.name] = propSchema;
		});

		return { properties: propsObject, required: requiredList };
	};

	const result = processProperties(visualSchema.properties, visualSchema.strict);
	jsonSchema.schema.properties = result.properties;
	jsonSchema.schema.required = result.required;

	// Add chainOfThoughts
	if ("chainOfThoughts" in visualSchema && (visualSchema as VisualSchema).chainOfThoughts) {
		jsonSchema.schema.properties.chainOfThoughts = {
			type: "string",
			description: "Chain of Thoughts reasoning steps",
		};
		if (!jsonSchema.schema.required.includes("chainOfThoughts")) {
			jsonSchema.schema.required.push("chainOfThoughts");
		}
	}

	// Add status
	if ("promptStatus" in visualSchema && (visualSchema as VisualSchema).promptStatus) {
		jsonSchema.schema.properties.status = {
			type: "string",
			description:
				"Execution status of the prompt (OK, NOK); OK - if the prompt was executed successfully, NOK - if the prompt was not executed successfully or have some errors during the run. Give a short summary about the prompt execution",
		};
		if (!jsonSchema.schema.required.includes("status")) {
			jsonSchema.schema.required.push("status");
		}
	}

	return jsonSchema;
};

export const transformToVisualSchema = (jsonSchema: any): VisualSchema => {
	const visualSchema: VisualSchema = {
		name: jsonSchema.name || "output_schema",
		type: "object",
		properties: [],
		strict: jsonSchema.strict || false,
		chainOfThoughts: false,
		promptStatus: false,
	};

	if (jsonSchema.schema?.properties?.chainOfThoughts) {
		visualSchema.chainOfThoughts = true;
	}

	if (jsonSchema.schema?.properties?.status) {
		visualSchema.promptStatus = true;
	}

	const parseProperties = (
		props: Record<string, JsonSchemaProperty>,
		requiredList: string[] = [],
	): VisualProperty[] => {
		return Object.keys(props)
			.map((name) => {
				if (name === "chainOfThoughts" || name === "status") return null;

				const prop = props[name];
				const isArray = prop.type === "array";

				const property: VisualProperty = {
					name,
					description: prop.description,
					required: requiredList.includes(name),
					isArray: isArray,
					type: isArray && prop.items ? prop.items.type : prop.type,
				};

				if (isArray && prop.items) {
					if (prop.items.type === "object" && prop.items.properties) {
						property.properties = parseProperties(
							prop.items.properties,
							prop.items.required,
						);
					}
				} else {
					if (prop.type === "object" && prop.properties) {
						property.properties = parseProperties(prop.properties, prop.required);
					}

					if (prop.enum) {
						property.type = "enum";
						property.enum = prop.enum;
					}
				}
				return property;
			})
			.filter(Boolean) as VisualProperty[];
	};

	if (jsonSchema.schema?.properties) {
		visualSchema.properties = parseProperties(
			jsonSchema.schema.properties,
			jsonSchema.schema.required,
		);
	}

	return visualSchema;
};

export const checkVisualDuplicates = (
	visualSchema: Pick<VisualSchema, "properties"> | { properties: VisualProperty[] },
): string[] => {
	const errors: string[] = [];
	if (visualSchema.properties) {
		const names = new Set<string>();
		visualSchema.properties.forEach((p) => {
			if (names.has(p.name)) {
				errors.push(`Duplicate property name: "${p.name}"`);
			}
			names.add(p.name);

			if (p.properties) {
				const nestedErrors = checkVisualDuplicates({ properties: p.properties });
				errors.push(...nestedErrors);
			}
		});
	}
	return errors;
};
