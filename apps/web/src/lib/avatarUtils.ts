import { isCloudAuth } from "./auth";

/**
 * Utility functions for avatar display and styling
 */

const LETTER_COLOR_MAP: Record<string, string> = {
	A: "bg-[#D6CFFF]",
	B: "bg-[#BBCAFF]",
	C: "bg-[#BFDEFF]",
	D: "bg-[#D5F0FF]",
	E: "bg-[#D7EFEB]",
	F: "bg-[#D6F6E6]",
	G: "bg-[#DEEADE]",
	H: "bg-[#E7F5C8]",
	I: "bg-[#FFE4F2]",
	J: "bg-[#FFD7D8]",
	K: "bg-[#FFE6B1]",
	L: "bg-[#F9ECDB]",
	M: "bg-[#D6CFFF]",
	N: "bg-[#BBCAFF]",
	O: "bg-[#BFDEFF]",
	P: "bg-[#D5F0FF]",
	Q: "bg-[#D7EFEB]",
	R: "bg-[#D6F6E6]",
	S: "bg-[#DEEADE]",
	T: "bg-[#E7F5C8]",
	U: "bg-[#FFE4F2]",
	V: "bg-[#FFD7D8]",
	W: "bg-[#FFE6B1]",
	X: "bg-[#F9ECDB]",
	Y: "bg-[#D6CFFF]",
	Z: "bg-[#BBCAFF]",
};

/** Light + dark fallback styles for commit/member avatars (pastel on light, muted saturated on dark). */
const COMMIT_AUTHOR_FALLBACK_CLASS: Record<string, string> = {
	A: "bg-[#D6CFFF] dark:bg-[#4D4872] text-[#18181B] dark:text-white",
	B: "bg-[#BBCAFF] dark:bg-[#3F4A78] text-[#18181B] dark:text-white",
	C: "bg-[#BFDEFF] dark:bg-[#355A72] text-[#18181B] dark:text-white",
	D: "bg-[#D5F0FF] dark:bg-[#355868] text-[#18181B] dark:text-white",
	E: "bg-[#D7EFEB] dark:bg-[#355856] text-[#18181B] dark:text-white",
	F: "bg-[#D6F6E6] dark:bg-[#355648] text-[#18181B] dark:text-white",
	G: "bg-[#DEEADE] dark:bg-[#455848] text-[#18181B] dark:text-white",
	H: "bg-[#E7F5C8] dark:bg-[#556238] text-[#18181B] dark:text-white",
	I: "bg-[#FFE4F2] dark:bg-[#624858] text-[#18181B] dark:text-white",
	J: "bg-[#FFD7D8] dark:bg-[#624848] text-[#18181B] dark:text-white",
	K: "bg-[#FFE6B1] dark:bg-[#685838] text-[#18181B] dark:text-white",
	L: "bg-[#F9ECDB] dark:bg-[#585040] text-[#18181B] dark:text-white",
	M: "bg-[#D6CFFF] dark:bg-[#4D4872] text-[#18181B] dark:text-white",
	N: "bg-[#BBCAFF] dark:bg-[#3F4A78] text-[#18181B] dark:text-white",
	O: "bg-[#BFDEFF] dark:bg-[#355A72] text-[#18181B] dark:text-white",
	P: "bg-[#D5F0FF] dark:bg-[#355868] text-[#18181B] dark:text-white",
	Q: "bg-[#D7EFEB] dark:bg-[#355856] text-[#18181B] dark:text-white",
	R: "bg-[#D6F6E6] dark:bg-[#355648] text-[#18181B] dark:text-white",
	S: "bg-[#DEEADE] dark:bg-[#455848] text-[#18181B] dark:text-white",
	T: "bg-[#E7F5C8] dark:bg-[#556238] text-[#18181B] dark:text-white",
	U: "bg-[#FFE4F2] dark:bg-[#624858] text-[#18181B] dark:text-white",
	V: "bg-[#FFD7D8] dark:bg-[#624848] text-[#18181B] dark:text-white",
	W: "bg-[#FFE6B1] dark:bg-[#685838] text-[#18181B] dark:text-white",
	X: "bg-[#F9ECDB] dark:bg-[#585040] text-[#18181B] dark:text-white",
	Y: "bg-[#D6CFFF] dark:bg-[#4D4872] text-[#18181B] dark:text-white",
	Z: "bg-[#BBCAFF] dark:bg-[#3F4A78] text-[#18181B] dark:text-white",
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
	return LETTER_COLOR_MAP[firstLetter] || "bg-[#D6CFFF]";
}

/**
 * Gets avatar color class for a name, handling non-letter characters
 * @param name - The name to get color for
 * @returns Color class string. Returns "bg-black text-white" for non-letter first characters
 */
export function getAvatarColor(name: string): string {
	const firstChar = name[0] ?? "";
	const isNonLetter = !firstChar || !isLetter(firstChar);
	return isNonLetter ? "bg-black text-white" : getAvatarColorByFirstLetter(name);
}

/**
 * Tailwind classes for CommitAuthorAvatar fallback: pastel backgrounds in light mode,
 * deeper hues with light text in dark mode.
 */
export function getCommitAuthorAvatarFallbackClasses(name: string): string {
	const firstChar = name[0] ?? "";
	const isNonLetter = !firstChar || !isLetter(firstChar);
	if (isNonLetter) {
		return "bg-[#27272A] text-white dark:bg-[#52525B] dark:text-white";
	}
	const letter = firstChar.toUpperCase();
	return (
		COMMIT_AUTHOR_FALLBACK_CLASS[letter] ??
		"bg-[#D6CFFF] dark:bg-[#4D4872] text-[#18181B] dark:text-white"
	);
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
