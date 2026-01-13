export type FieldType = "string" | "number" | "boolean" | "object" | "enum";

export interface VisualProperty {
	id?: string;
	name: string;
	type: FieldType;
	description?: string;
	required: boolean;
	isArray: boolean;
	enum?: string[];
	properties?: VisualProperty[];
}

export interface VisualSchema {
	name?: string;
	type: "object";
	properties: VisualProperty[];
	strict: boolean;
	chainOfThoughts?: boolean;
	promptStatus?: boolean;
}

export interface JsonSchemaRoot {
	name: string;
	strict: boolean;
	schema: {
		type: "object";
		properties: Record<string, any>;
		required?: string[];
		additionalProperties: boolean;
	};
}

export const baseSchema: VisualSchema = {
	type: "object",
	properties: [],
	strict: false,
	chainOfThoughts: false,
	promptStatus: false,
};

export const generateId = (): string => Math.random().toString(36).substring(2, 9);

/**
 * Recursively checks if all properties are required
 */
export const checkAllRequired = (props: VisualProperty[]): boolean => {
	return props.every((p) => {
		if (!p.required) return false;
		if (p.properties && p.properties.length > 0) {
			return checkAllRequired(p.properties);
		}
		return true;
	});
};

/**
 * Recursively sets all properties as required or not required based on strict mode
 */
export const setAllRequired = (props: VisualProperty[], isStrict: boolean): VisualProperty[] => {
	return props.map((prop) => {
		const updatedProp = { ...prop, required: isStrict };
		if (updatedProp.properties) {
			updatedProp.properties = setAllRequired(updatedProp.properties, isStrict);
		}
		return updatedProp;
	});
};

/**
 * Recursively checks for duplicate property names and returns an array of error messages
 */
export const checkVisualDuplicates = (schema: VisualSchema | VisualProperty[]): string[] => {
	const errors: string[] = [];

	const check = (props: VisualProperty[], path: string = "") => {
		const names = props.map((p) => p.name);
		const duplicates = names.filter((name, index) => names.indexOf(name) !== index);

		if (duplicates.length > 0) {
			const uniqueDuplicates = [...new Set(duplicates)];
			uniqueDuplicates.forEach((name) => {
				errors.push(`Duplicate property name "${name}"${path ? ` in ${path}` : ""}`);
			});
		}

		props.forEach((prop) => {
			if (prop.properties && prop.properties.length > 0) {
				check(prop.properties, path ? `${path}.${prop.name}` : prop.name);
			}
		});
	};

	const properties = Array.isArray(schema) ? schema : schema.properties;
	check(properties);
	return errors;
};

/**
 * Checks if there are duplicate property names
 */
export const hasDuplicates = (props: VisualProperty[]): boolean => {
	const names = props.map((p) => p.name);
	return names.some((name, index) => names.indexOf(name) !== index);
};

/**
 * Validates and corrects strict mode based on whether all properties are required
 * If strict is true but not all properties are required, sets strict to false
 */
export const validateStrictMode = <T extends { strict: boolean; properties: VisualProperty[] }>(
	schema: T,
): T => {
	if (schema.strict && schema.properties.length > 0) {
		const allRequired = checkAllRequired(schema.properties);
		if (!allRequired) {
			return { ...schema, strict: false };
		}
	}
	return schema;
};

const convertToVisualProperty = (
	key: string,
	value: any,
	required: string[] = [],
): VisualProperty => {
	const isArray = value.type === "array";
	let effectiveType = isArray ? value.items?.type || "string" : value.type;

	if ((value.enum || value.items?.enum) && effectiveType === "string") {
		effectiveType = "enum";
	}

	const prop: VisualProperty = {
		id: generateId(),
		name: key,
		type: effectiveType as FieldType,
		description: value.description,
		required: required.includes(key),
		isArray: isArray,
	};

	if (value.enum) {
		prop.enum = value.enum;
	}

	const nestedPropsObj = isArray ? value.items?.properties : value.properties;
	const nestedRequired = isArray ? value.items?.required : value.required;

	if (nestedPropsObj) {
		prop.properties = Object.entries(nestedPropsObj).map(([k, v]) =>
			convertToVisualProperty(k, v, nestedRequired || []),
		);
	}

	return prop;
};

export const transformToVisualSchema = (schema: any): VisualSchema => {
	const targetSchema = schema.schema || schema;

	const properties = targetSchema.properties
		? Object.entries(targetSchema.properties).map(([k, v]) =>
				convertToVisualProperty(k, v as any, targetSchema.required || []),
			)
		: [];

	return {
		name: schema.name || "output_schema",
		type: "object",
		strict: schema.strict ?? false,
		properties: properties,
		chainOfThoughts: false,
		promptStatus: false,
	};
};

const convertToJsonProperty = (prop: VisualProperty): any => {
	const isEnum = prop.type === "enum";
	const base: any = {
		type: prop.isArray ? "array" : isEnum ? "string" : prop.type,
		description: prop.description,
	};

	if (prop.enum && prop.enum.length > 0) {
		base.enum = prop.enum;
	}

	if (prop.properties && prop.properties.length > 0) {
		const propsObj: any = {};
		const required: string[] = [];

		prop.properties.forEach((p) => {
			propsObj[p.name] = convertToJsonProperty(p);
			if (p.required) required.push(p.name);
		});

		if (prop.isArray) {
			base.items = {
				type: "object",
				properties: propsObj,
				required: required.length > 0 ? required : undefined,
				additionalProperties: false,
			};
		} else {
			base.properties = propsObj;
			if (required.length > 0) base.required = required;
			base.additionalProperties = false;
		}
	} else if (prop.isArray) {
		base.items = {
			type: prop.type,
		};
		if (prop.enum && prop.enum.length > 0) {
			base.items.enum = prop.enum;
			delete base.enum;
		}
	}

	return base;
};

export const transformToJsonSchema = (visual: VisualSchema): JsonSchemaRoot => {
	const properties: any = {};
	const required: string[] = [];

	visual.properties.forEach((p) => {
		properties[p.name] = convertToJsonProperty(p);
		if (p.required) required.push(p.name);
	});

	const schemaStructure: any = {
		type: "object",
		properties,
		additionalProperties: false,
	};

	if (required.length > 0) {
		schemaStructure.required = required;
	}

	return {
		name: visual.name || "output_schema",
		strict: visual.strict,
		schema: schemaStructure,
	};
};
