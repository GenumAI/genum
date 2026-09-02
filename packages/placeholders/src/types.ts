export type PlaceholderValueDefinition = {
	name: string;
	content: string;
	isDefault: boolean;
};

export type PlaceholderDefinition = {
	key: string;
	values: PlaceholderValueDefinition[];
};

/** key -> the NAME of the chosen value. Never block text: the text lives in Lab. */
export type PlaceholderSelection = Record<string, string>;

export type RenderResult = {
	text: string;
	/** Only keys that occur in the text. `null` means nothing resolved (no selection, no default). */
	resolved: Record<string, string | null>;
	/** Selected keys with no `{{key}}` in the text, or naming a value that does not exist. */
	ignored: string[];
	/** `{{key}}` occurrences with no definition. Left in the text verbatim. */
	undefinedKeys: string[];
};
