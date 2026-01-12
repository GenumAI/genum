/**
 * convert Markdown to XML, grouping by headers:
 * - "# Foo Bar" → <foo-bar> … </foo-bar>
 * - "## Baz"     → <baz> … </baz>
 * Nesting is determined by the header level: sections are closed when a header of the same or higher level is encountered.
 * @param {string} md — original Markdown
 * @returns {string} — string with result in XML style
 */
export function mdToXml(md: string): string {
	const lines = md.split("\n");
	const stack = []; // stack of open sections { level, tag }
	const output = [];

	for (const line of lines) {
		const headerMatch = line.match(/^(#{1,6})\s+(.*)$/);
		if (headerMatch) {
			const level = headerMatch[1].length;
			const text = headerMatch[2].trim();
			const tag = slugify(text);

			while (stack.length && stack[stack.length - 1].level >= level) {
				output.push(`</${stack.pop()?.tag}>`);
			}

			output.push(`<${tag}>`);
			stack.push({ level, tag });
		} else if (line.trim() === "---" || line.trim() === "") {
		} else {
			output.push(escapeXml(line));
		}
	}

	while (stack.length) {
		output.push(`</${stack.pop()?.tag}>`);
	}

	return `<instructions> ${output.join("\n")} </instructions>`;
}

/** convert string to XML tag: lowercase, spaces/non-alphabet → dashes */
function slugify(str: string) {
	return (
		str
			.toLowerCase()
			.trim()
			// replace everything that is not a letter/digit with a dash
			.replace(/[^a-z0-9]+/g, "-")
			// remove extra dashes at the edges
			.replace(/(^-+|-+$)/g, "")
	);
}

/** escape &, <, >, " and ' for insertion into XML */
function escapeXml(str: string) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export function objToXml(obj: Record<string, any>): string {
	return Object.entries(obj)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => {
			if (typeof value === "object" && value !== null) {
				return `<${key}>${objToXml(value)}</${key}>`;
			} else {
				return `<${key}>${value}</${key}>`;
			}
		})
		.join(" ");
}

export function xmlToObj(xml: string): Record<string, any> {
	try {
		const cleanXml = xml.trim().replace(/\s+/g, " ");

		function parseXml(xmlString: string): Record<string, any> {
			const result: Record<string, any> = {};

			const tagRegex = /<(\w+)([^>]*)>(.*?)<\/\1>/g;
			let match: RegExpExecArray | null;

			match = tagRegex.exec(xmlString);
			while (match !== null) {
				const [, tagName, _attributes, content] = match;
				const hasNestedTags = /<[^>]+>/.test(content);

				if (hasNestedTags) {
					result[tagName] = parseXml(content);
				} else {
					result[tagName] = content.trim();
				}

				match = tagRegex.exec(xmlString);
			}

			return result;
		}

		return parseXml(cleanXml);
	} catch (error) {
		console.error("Error parsing XML:", error);
		return {};
	}
}
