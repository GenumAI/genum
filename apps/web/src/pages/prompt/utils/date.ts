export const formatCommitTime = (dateString: string) => {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMonths = Math.floor(diffMs / (1000 * 60 * 60 * 24 * 30));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
	const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
	const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

	if (diffMonths > 0) return `${diffMonths}mo ago`;
	if (diffDays > 0) return `${diffDays}d ago`;
	if (diffHours > 0) return `${diffHours}h ago`;
	if (diffMinutes > 0) return `${diffMinutes}m ago`;

	return "just now";
};

export const formatUpdatedDate = (dateString: string) =>
	new Date(dateString).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
