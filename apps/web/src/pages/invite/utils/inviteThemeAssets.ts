const cloudThemeAssets = {
	logoSrc: "https://cdn.genum.ai/logo/ai_logo.png",
	backgroundImage: "https://cdn.genum.ai/background/auth_background.png?=1",
} as const;

const localThemeAssets = {
	logoSrc: "var(--invite-logo-image)",
	backgroundImage: "var(--invite-background-image)",
} as const;

export const getInviteThemeAssets = (isCloud: boolean) =>
	isCloud ? cloudThemeAssets : localThemeAssets;

export const isCssVariableImage = (value: string) => value.startsWith("var(");

export const resolveBackgroundImage = (value: string) =>
	value.startsWith("var(") || value.startsWith("url(") ? value : `url('${value}')`;
