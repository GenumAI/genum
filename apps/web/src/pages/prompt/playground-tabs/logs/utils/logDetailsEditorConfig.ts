export const EYE_ICON_STYLE = { width: "17px", height: "17px" };
export const EYE_ICON_STYLE_SMALL = { width: "16px", height: "16px" };
export const EXPAND_ICON_STYLE = { width: "20px", height: "20px" };

export const READONLY_EDITOR_OPTIONS = {
	readOnly: true,
	glyphMargin: false,
	folding: false,
	lineDecorationsWidth: 0,
} as const;

export const READONLY_EDITOR_WITH_LINE_NUMBERS_OPTIONS = {
	readOnly: true,
	lineNumbers: "off",
	glyphMargin: false,
	folding: false,
	lineDecorationsWidth: 0,
} as const;
