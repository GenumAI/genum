import type * as Monaco from "monaco-editor";

type ResolvedTheme = "dark" | "light";
type MonacoSurfaceToken = "--editor-input-background" | "--background";

export const MONACO_THEME_NAMES = {
	light: "genum-light",
	dark: "genum-dark",
	lightSurface: "genum-light-surface",
	darkSurface: "genum-dark-surface",
} as const;

let colorProbe: HTMLSpanElement | null = null;

const getColorProbe = () => {
	if (typeof document === "undefined") {
		return null;
	}

	if (colorProbe?.isConnected) {
		return colorProbe;
	}

	const probe = document.createElement("span");
	probe.setAttribute("aria-hidden", "true");
	probe.style.position = "absolute";
	probe.style.width = "0";
	probe.style.height = "0";
	probe.style.opacity = "0";
	probe.style.pointerEvents = "none";
	document.body.appendChild(probe);
	colorProbe = probe;

	return colorProbe;
};

const clampToByte = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

const toHex = (value: number) => clampToByte(value).toString(16).padStart(2, "0");

const rgbStringToHex = (value: string, fallback: string) => {
	const matches = value.match(/[\d.]+/g);

	if (!matches || matches.length < 3) {
		return fallback;
	}

	const [r, g, b, alpha] = matches.map(Number);
	const alphaHex = typeof alpha === "number" && !Number.isNaN(alpha) ? toHex(alpha * 255) : "";

	return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`;
};

const normalizeCssColor = (value: string, fallback: string) => {
	if (typeof window === "undefined") {
		return fallback;
	}

	const probe = getColorProbe();

	if (!probe) {
		return fallback;
	}

	probe.style.color = "";
	probe.style.color = value;

	const resolvedColor = window.getComputedStyle(probe).color;

	return resolvedColor ? rgbStringToHex(resolvedColor, fallback) : fallback;
};

const getThemeTokenColor = (
	styles: CSSStyleDeclaration,
	tokenName: string,
	fallback: string,
) => {
	const tokenValue = styles.getPropertyValue(tokenName).trim();

	if (!tokenValue) {
		return fallback;
	}

	return normalizeCssColor(`hsl(${tokenValue})`, fallback);
};

const withOpacity = (hexColor: string, alpha: number) => {
	const normalized = hexColor.replace("#", "").slice(0, 6);
	return `#${normalized}${toHex(alpha * 255)}`;
};

export const registerMonacoTheme = (
	monaco: typeof Monaco,
	resolvedTheme: ResolvedTheme,
	options?: { surfaceToken?: MonacoSurfaceToken },
) => {
	if (typeof window === "undefined") {
		return;
	}

	const styles = window.getComputedStyle(document.documentElement);
	const surfaceToken = options?.surfaceToken ?? "--editor-input-background";
	const themeName =
		surfaceToken === "--background"
			? MONACO_THEME_NAMES[`${resolvedTheme}Surface`]
			: MONACO_THEME_NAMES[resolvedTheme];
	const editorBackground = getThemeTokenColor(styles, surfaceToken, "#111827");
	const editorForeground = getThemeTokenColor(styles, "--foreground", "#e5e7eb");
	const border = getThemeTokenColor(styles, "--border", "#374151");
	const mutedForeground = getThemeTokenColor(styles, "--muted-foreground", "#9ca3af");
	const selection = getThemeTokenColor(styles, "--selection", "#3b82f6");
	const surfaceMuted = getThemeTokenColor(styles, "--surface-muted", "#1f2937");
	const surfaceStrong = getThemeTokenColor(styles, "--surface-strong", "#374151");
	const success = getThemeTokenColor(styles, "--success", "#34d399");
	const destructive = getThemeTokenColor(styles, "--destructive", "#f87171");

	monaco.editor.defineTheme(themeName, {
		base: resolvedTheme === "dark" ? "vs-dark" : "vs",
		inherit: true,
		rules: [],
		colors: {
			"editor.background": editorBackground,
			"editor.foreground": editorForeground,
			"editorLineNumber.foreground": withOpacity(mutedForeground, 0.78),
			"editorLineNumber.activeForeground": editorForeground,
			"editorCursor.foreground": editorForeground,
			"editor.selectionBackground": withOpacity(selection, resolvedTheme === "dark" ? 0.5 : 0.35),
			"editor.selectionHighlightBackground": withOpacity(selection, 0.18),
			"editor.lineHighlightBackground": withOpacity(surfaceMuted, 0.55),
			"editor.lineHighlightBorder": withOpacity(border, 0.35),
			"editorGutter.background": editorBackground,
			"editorWidget.background": editorBackground,
			"editorWidget.border": border,
			"editorIndentGuide.background1": withOpacity(surfaceStrong, 0.45),
			"editorIndentGuide.activeBackground1": withOpacity(border, 0.9),
			"editorWhitespace.foreground": withOpacity(mutedForeground, 0.24),
			"editorOverviewRuler.border": border,
			"scrollbarSlider.background": withOpacity(mutedForeground, 0.24),
			"scrollbarSlider.hoverBackground": withOpacity(mutedForeground, 0.34),
			"scrollbarSlider.activeBackground": withOpacity(mutedForeground, 0.44),
			"minimap.background": editorBackground,
			"minimap.selectionHighlight": withOpacity(selection, 0.24),
			"diffEditor.insertedTextBackground": withOpacity(success, 0.18),
			"diffEditor.removedTextBackground": withOpacity(destructive, 0.16),
			"diffEditor.insertedLineBackground": withOpacity(success, 0.08),
			"diffEditor.removedLineBackground": withOpacity(destructive, 0.08),
			"diffEditor.border": border,
		},
	});

	monaco.editor.setTheme(themeName);
};
