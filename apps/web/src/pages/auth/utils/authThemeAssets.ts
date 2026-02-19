import localLogoLight from "@/assets/genum_logo/light_theme_logo.png";
import localLogoDark from "@/assets/genum_logo/dark_theme_logo.png";
import localBackgroundLight from "@/assets/background/light_theme_background.png";
import localBackgroundDark from "@/assets/background/dark_theme_background.png";

export const getAuthThemeAssets = (isDark: boolean) => ({
	logoSrc: isDark ? localLogoDark : localLogoLight,
	backgroundImage: isDark ? localBackgroundDark : localBackgroundLight,
});
