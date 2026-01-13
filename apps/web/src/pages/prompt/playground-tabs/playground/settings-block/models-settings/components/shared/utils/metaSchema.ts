export const SIMPLIFIED_META_SCHEMA = {
	type: "object",
	properties: {
		name: { type: "string" },
		strict: { type: "boolean" },
		chainOfThoughts: { type: "boolean" },
		promptStatus: { type: "boolean" },
		schema: {
			type: "object",
			properties: {
				type: { type: "string" },
				properties: { type: "object" },
			},
			required: ["type", "properties"],
		},
	},
	required: ["name", "schema"],
};
