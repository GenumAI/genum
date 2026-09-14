import type { SpanRow } from "@/types/spans";

export interface SessionSelections {
	/** Key -> the NAME of the value it resolved to. Empty when the session never said. */
	placeholders: Record<string, string>;
	/**
	 * The tools the model was offered, by name. `null` means the session never recorded a
	 * subset -- the replay then offers the prompt's whole list, which is what every
	 * recording did before these attributes existed.
	 */
	offeredTools: string[] | null;
	/** The `commitHash` the session rendered from, when its sender said. */
	promptVersion: string;
	/**
	 * A later turn was run with a different selection or a different tool subset than
	 * turn 0. Turn 0 is what gets pinned either way; this says the pin is only part of
	 * the truth, so the testcase can warn instead of letting the author read a replay
	 * that silently differs from the recording on turns they cannot see.
	 */
	drifted: boolean;
}

/**
 * What the recorded session was run with, as turn 0 ran it.
 *
 * Turn 0 wins because an app that runs its own agent loop derives these from the user's
 * role and holds them stable for the whole conversation -- a later turn disagreeing is the
 * exception, and pinning the LAST one would silently re-key a testcase on whichever turn
 * happened to arrive last in an append-only table. Disagreement is reported rather than
 * merged: merging two selections invents a third combination that no turn ever ran.
 *
 * A turn is a trace (`trace_id`), so turns are grouped by it and read in the order the
 * server returned them -- the same ordering the session panel renders. This side has no
 * `turn_index` on purpose and does not need one.
 *
 * EMPTY MEANS NOT RECORDED, never "none offered" and never "no selection made". A row
 * written before these columns existed reads back empty, and so does every span from a
 * sender that supplies no such attribute; treating that as "the model was offered no
 * tools" would stop every one of those replays at its first tool call. A sender that
 * genuinely offers no tools has to say so some other way, and until one needs to, this
 * ambiguity costs nothing and the other reading costs every existing recording.
 */
export function sessionSelections(spans: SpanRow[]): SessionSelections {
	let placeholders: Record<string, string> | null = null;
	let offeredTools: string[] | null = null;
	let promptVersion = "";
	let drifted = false;

	// One entry per trace, in the order the rows arrived: the first is turn 0.
	const turns = new Map<string, SpanRow[]>();
	for (const span of spans) {
		const rows = turns.get(span.trace_id);
		if (rows) rows.push(span);
		else turns.set(span.trace_id, [span]);
	}

	for (const rows of turns.values()) {
		const selection = firstNonEmpty(rows, (row) =>
			row.placeholders && Object.keys(row.placeholders).length > 0 ? row.placeholders : null,
		);
		const tools = firstNonEmpty(rows, (row) =>
			row.tools_offered && row.tools_offered.length > 0 ? row.tools_offered : null,
		);
		const version = firstNonEmpty(rows, (row) => row.prompt_version || null);

		if (selection) {
			if (placeholders === null) placeholders = selection;
			else if (!sameSelection(placeholders, selection)) drifted = true;
		}
		if (tools) {
			if (offeredTools === null) offeredTools = tools;
			else if (!sameTools(offeredTools, tools)) drifted = true;
		}
		if (version && !promptVersion) promptVersion = version;
	}

	return { placeholders: placeholders ?? {}, offeredTools, promptVersion, drifted };
}

function firstNonEmpty<T>(rows: SpanRow[], read: (row: SpanRow) => T | null): T | null {
	for (const row of rows) {
		const value = read(row);
		if (value !== null) return value;
	}
	return null;
}

function sameSelection(a: Record<string, string>, b: Record<string, string>): boolean {
	const keys = Object.keys(a);
	if (keys.length !== Object.keys(b).length) return false;
	return keys.every((key) => a[key] === b[key]);
}

/** Order is the sender's, not a meaning: two turns offering the same set agree. */
function sameTools(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const set = new Set(a);
	return b.every((name) => set.has(name));
}
