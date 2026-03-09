import localLogoLight from "@/assets/genum_logo/light_theme_logo.png";
import localLogoDark from "@/assets/genum_logo/dark_theme_logo.png";
import localBackgroundLight from "@/assets/background/light_theme_background.png";
import localBackgroundDark from "@/assets/background/dark_theme_background.png";

const cloudThemeAssets = {
	light: {
		logoSrc: "https://cdn.genum.ai/logo/ai_logo.png",
		backgroundImage: "https://cdn.genum.ai/background/auth_background.png?=1",
	},
	dark: {
		logoSrc: "https://cdn.genum.ai/logo/ai_logo.png",
		backgroundImage: "https://cdn.genum.ai/background/auth_background.png?=1",
	},
} as const;

const localThemeAssets = {
	light: {
		logoSrc: localLogoLight,
		backgroundImage: localBackgroundLight,
	},
	dark: {
		logoSrc: localLogoDark,
		backgroundImage: localBackgroundDark,
	},
} as const;

export const getInviteThemeAssets = (isDark: boolean, isCloud: boolean) => {
	const mode = isDark ? "dark" : "light";
	return isCloud ? cloudThemeAssets[mode] : localThemeAssets[mode];
};
