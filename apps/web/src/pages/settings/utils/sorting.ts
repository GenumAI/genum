/**
 * Common sorting comparison functions
 */

/**
 * Compares two strings case-insensitively
 */
export const compareStrings = (a: string = "", b: string = "") => {
	return a.toLowerCase().localeCompare(b.toLowerCase());
};

/**
 * Compares two date strings
 */
export const compareDates = (a: string | undefined, b: string | undefined) => {
	const timeA = a ? new Date(a).getTime() : 0;
	const timeB = b ? new Date(b).getTime() : 0;
	return timeA - timeB;
};
