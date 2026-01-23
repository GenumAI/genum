export const formatNotificationPreview = (content: string, maxLength: number | undefined = 120) => {
	const stripTables = (input: string) => {
		const lines = input.replace(/\\n/g, "\n").split("\n");
		const filtered = lines.filter((line) => {
			const trimmed = line.trim();
			if (!trimmed) return true;
			const isTableDivider = /^(\|?\s*:?-+:?\s*)+\|?$/.test(trimmed);
			const hasPipeCells = /\|/.test(trimmed) && trimmed.split("|").length >= 3;
			return !(isTableDivider || hasPipeCells);
		});
		return filtered.join("\n");
	};

	// Remove markdown formatting and clean up text for list preview
	let cleanContent = stripTables(content)
		.replace(/```[\s\S]*?```/g, "") // Remove code blocks
		.replace(/`([^`]*)`/g, "$1") // Remove inline code
		.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1") // Remove images
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // Remove links [text](url)
		.replace(/\[([^\]]+)\]\[[^\]]*\]/g, "$1") // Remove ref links [text][id]
		.replace(/<[^>]+>/g, "") // Remove HTML tags
		.replace(/^>\s?/gm, "") // Remove blockquotes
		.replace(/#{1,6}\s+/g, "") // Remove headers (# ## ### etc.)
		.replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold **text**
		.replace(/\*(.*?)\*/g, "$1") // Remove italic *text*
		.replace(/_{1,2}(.*?)_{1,2}/g, "$1") // Remove underline/italic _text_
		.replace(/\\n/g, " ") // Replace literal \n with space
		.replace(/\n/g, " ") // Replace actual newlines with space
		.replace(/^\s*[-*+]\s+/gm, "") // Remove list markers at start of line
		.replace(/\s*[-*+]\s+/g, ", ") // Replace remaining list markers with commas
		.replace(/^\s*\d+\.\s+/gm, "") // Remove numbered list markers at start of line
		.replace(/\s*\d+\.\s+/g, ", ") // Replace remaining numbered list markers with commas
		.replace(/\s+/g, " ") // Replace multiple spaces with single space
		.replace(/,\s*,/g, ",") // Remove double commas
		.replace(/,\s*$/, "") // Remove trailing comma
		.trim();

	if (typeof maxLength === "number" && Number.isFinite(maxLength) && maxLength > 0) {
		if (cleanContent.length > maxLength) {
			cleanContent = `${cleanContent.substring(0, maxLength)}...`;
		}
	}

	return cleanContent;
};
