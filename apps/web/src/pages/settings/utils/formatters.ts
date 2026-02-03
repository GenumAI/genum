/**
 * Utility functions for formatting data in settings pages
 */

/**
 * Formats a date string to a relative time (e.g., "2h ago", "3d ago")
 */
export function formatDate(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));

	if (diffInHours < 1) {
		return "Just now";
	} else if (diffInHours < 24) {
		return `${diffInHours}h ago`;
	} else if (diffInHours < 48) {
		return "1d ago";
	} else {
		const diffInDays = Math.floor(diffInHours / 24);
		return `${diffInDays}d ago`;
	}
}

/**
 * Formats a date string to a full localized date-time string
 */
export function formatFullDate(dateString: string): string {
	const date = new Date(dateString);
	return date.toLocaleString("en-GB", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	});
}

/**
 * Formats an API key to show only the first and last 8 characters
 */
export function formatAPIKey(key: string): string {
	if (!key) return "";

	const start = key.substring(0, 8);
	const end = key.substring(key.length - 8);
	return `${start}...${end}`;
}

/**
 * Gets user initials from a full name (up to 2 characters)
 */
export function getUserInitials(name: string): string {
	return name
		.split(" ")
		.map((word) => word.charAt(0))
		.join("")
		.toUpperCase()
		.substring(0, 2);
}
