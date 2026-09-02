/**
 * Split a migration file into executable statements.
 *
 * Quote-aware on purpose: the splitter this replaces cut on every `;`, so a semicolon
 * inside a string literal silently truncated the statement around it. Comments are
 * stripped rather than carried, so what reaches the server is the statement alone.
 */
export function splitStatements(sql: string): string[] {
	const statements: string[] = [];
	let current = "";
	let inSingle = false;
	let quotedIdentifierChar: "`" | '"' | null = null;

	for (let i = 0; i < sql.length; i++) {
		const char = sql[i];
		const next = sql[i + 1];

		if (inSingle) {
			current += char;
			if (char === "\\" && next !== undefined) {
				// The escaped character belongs to the literal and can never delimit.
				current += next;
				i++;
			} else if (char === "'") {
				inSingle = false;
			}
			continue;
		}

		if (quotedIdentifierChar !== null) {
			current += char;
			if (char === quotedIdentifierChar) quotedIdentifierChar = null;
			continue;
		}

		if (char === "-" && next === "-") {
			while (i < sql.length && sql[i] !== "\n") i++;
			current += "\n";
			continue;
		}

		if (char === "/" && next === "*") {
			i += 2;
			while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
			i++;
			current += " ";
			continue;
		}

		if (char === "'") {
			inSingle = true;
			current += char;
			continue;
		}

		if (char === "`" || char === '"') {
			quotedIdentifierChar = char;
			current += char;
			continue;
		}

		if (char === ";") {
			const statement = current.trim();
			if (statement) statements.push(statement);
			current = "";
			continue;
		}

		current += char;
	}

	const trailing = current.trim();
	if (trailing) statements.push(trailing);

	return statements;
}
