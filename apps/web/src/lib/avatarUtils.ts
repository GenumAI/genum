import { isCloudAuth } from "./auth";

/**
 * Utility functions for avatar display and styling
 */

const AVATAR_BG = [
	"bg-[hsl(var(--avatar-1))]",
	"bg-[hsl(var(--avatar-2))]",
	"bg-[hsl(var(--avatar-3))]",
	"bg-[hsl(var(--avatar-4))]",
	"bg-[hsl(var(--avatar-5))]",
	"bg-[hsl(var(--avatar-6))]",
	"bg-[hsl(var(--avatar-7))]",
	"bg-[hsl(var(--avatar-8))]",
	"bg-[hsl(var(--avatar-9))]",
	"bg-[hsl(var(--avatar-10))]",
	"bg-[hsl(var(--avatar-11))]",
	"bg-[hsl(var(--avatar-12))]",
] as const;

const LETTER_COLOR_MAP: Record<string, string> = {
	A: AVATAR_BG[0],
	B: AVATAR_BG[1],
	C: AVATAR_BG[2],
	D: AVATAR_BG[3],
	E: AVATAR_BG[4],
	F: AVATAR_BG[5],
	G: AVATAR_BG[6],
	H: AVATAR_BG[7],
	I: AVATAR_BG[8],
	J: AVATAR_BG[9],
	K: AVATAR_BG[10],
	L: AVATAR_BG[11],
	M: AVATAR_BG[0],
	N: AVATAR_BG[1],
	O: AVATAR_BG[2],
	P: AVATAR_BG[3],
	Q: AVATAR_BG[4],
	R: AVATAR_BG[5],
	S: AVATAR_BG[6],
	T: AVATAR_BG[7],
	U: AVATAR_BG[8],
	V: AVATAR_BG[9],
	W: AVATAR_BG[10],
	X: AVATAR_BG[11],
	Y: AVATAR_BG[0],
	Z: AVATAR_BG[1],
};

/**
 * Checks if a character is a letter (A-Z, a-z)
 */
export function isLetter(char: string): boolean {
	return /^[a-zA-Z]$/.test(char);
}

/**
 * Gets the background color class for an avatar based on the first letter of a name
 */
export function getAvatarColorByFirstLetter(name: string): string {
	const firstLetter = name[0]?.toUpperCase() || "";
	return LETTER_COLOR_MAP[firstLetter] || AVATAR_BG[0];
}

/**
 * Gets avatar color class for a name, handling non-letter characters
 * @param name - The name to get color for
 * @returns Color class string. Returns inverted theme tokens for non-letter first characters
 */
export function getAvatarColor(name: string): string {
	const firstChar = name[0] ?? "";
	const isNonLetter = !firstChar || !isLetter(firstChar);
	return isNonLetter
		? "bg-foreground text-background"
		: `${getAvatarColorByFirstLetter(name)} text-foreground`;
}

/**
 * Tailwind classes for CommitAuthorAvatar fallback driven by global avatar tokens.
 */
export function getCommitAuthorAvatarFallbackClasses(name: string): string {
	const firstChar = name[0] ?? "";
	const isNonLetter = !firstChar || !isLetter(firstChar);
	if (isNonLetter) {
		return "bg-surface-strong text-foreground";
	}
	return getAvatarColor(name);
}

/**
 * Gets the initial character for an avatar fallback
 * @param name - The name to get initial from
 * @returns Single uppercase letter. Returns "G" for non-letter first characters
 */
export function getAvatarInitial(name: string): string {
	const firstChar = name[0] ?? "";
	const isNonLetter = !firstChar || !isLetter(firstChar);
	return isNonLetter ? "G" : firstChar.toUpperCase();
}

/**
 * Gets avatar URL from user object, checking both avatar and picture fields
 * On cloud: uses avatar from backend (prioritizes avatar field, falls back to picture from backend)
 * On local: uses picture field (local avatar) or falls back to avatar from backend
 * @param user - User object with optional avatar and picture fields (can be null)
 * @returns Avatar URL or undefined
 */
export function getAvatarUrl(
	user?: { avatar?: string | null; picture?: string | null } | null,
): string | undefined {
	if (!user) return undefined;
	const isCloud = isCloudAuth();

	// On cloud: use avatar from backend (both fields come from backend, prioritize avatar)
	if (isCloud) {
		return user.avatar || user.picture || undefined;
	}

	// On local: prefer picture (local avatar), then avatar from backend
	return user.picture || user.avatar || undefined;
}
