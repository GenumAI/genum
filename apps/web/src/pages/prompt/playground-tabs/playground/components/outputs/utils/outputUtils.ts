import { checkIsJson } from "@/lib/jsonUtils";

/**
 * Converts milliseconds to seconds
 */
export const getSeconds = (ms?: number): number => {
	if (!ms) {
		return 0;
	}
	return ms / 1000;
};

/**
 * Formats a number to 4 decimal places if it's a float, otherwise returns the integer
 */
export const formatNumber = (num: number): number => {
	if (Number.isInteger(num)) {
		return num;
	} else {
		return parseFloat(num.toFixed(4));
	}
};

/**
 * Compares two values, handling JSON strings specially
 */
export const compareValues = (val1: string, val2: string | undefined): boolean => {
	if (val2 === undefined) {
		return false;
	}
	if (checkIsJson(val1) && checkIsJson(val2)) {
		try {
			return JSON.stringify(JSON.parse(val1)) === JSON.stringify(JSON.parse(val2));
		} catch {
			return val1 === val2;
		}
	}
	return val1 === val2;
};
