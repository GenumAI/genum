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
