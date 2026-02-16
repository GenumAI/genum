export function timeAgo(value: string): string {
	const diff = Date.now() - new Date(value).getTime();
	const minute = 60e3;
	const hour = 60 * minute;
	const day = 24 * hour;

	if (diff >= day) return `${Math.floor(diff / day)} day(s) ago`;
	if (diff >= hour) return `${Math.floor(diff / hour)} hour(s) ago`;
	if (diff >= minute) return `${Math.floor(diff / minute)} minute(s) ago`;
	return "just now";
}
