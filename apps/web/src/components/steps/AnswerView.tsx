import { useCallback, useState } from "react";

import CompareDiffEditor from "@/components/ui/DiffEditor";
import MonacoEditor from "@/components/ui/MonacoEditor";
import {
	ANSWER_MAX_HEIGHT,
	ANSWER_MIN_HEIGHT,
	answerLanguage,
	clampAnswerHeight,
} from "@/lib/answerView";
import { parseJson } from "@/lib/jsonUtils";
import { cn } from "@/lib/utils";

/**
 * One turn's answer, read-only.
 *
 * A `<div>` of `whitespace-pre-wrap` was honest but unreadable: a structured answer
 * arrives as one long line of JSON, and the author has to parse it by eye to see whether
 * the model returned the right shape. Monaco pretty-prints and highlights it, and -- being
 * the same editor the expectation is edited in -- the two never disagree about how a value
 * looks.
 */
export function ReadOnlyAnswer({ text, className }: { text: string; className?: string }) {
	const [height, setHeight] = useState<number>(ANSWER_MIN_HEIGHT);

	// The editor is sized by its content, not by a fixed box: a one-line answer must not
	// reserve a screenful, and a long one must not push the rest of the thread away.
	const measure = useCallback((editor: { getContentHeight: () => number }) => {
		setHeight(clampAnswerHeight(editor.getContentHeight()));
	}, []);

	return (
		<div
			className={cn("mt-1 overflow-hidden rounded-md border bg-background", className)}
			style={{ height }}
		>
			<MonacoEditor
				value={parseJson(text)}
				language={answerLanguage(text)}
				height="100%"
				options={{
					readOnly: true,
					// Without this the caret still lands in the box on a click, which
					// invites an edit that the read-only flag then silently refuses.
					domReadOnly: true,
					lineNumbers: "off",
					folding: false,
					renderLineHighlight: "none",
					minimap: { enabled: false },
					scrollBeyondLastLine: false,
					wordWrap: "on",
					fontSize: 13,
					padding: { top: 6, bottom: 6 },
				}}
				onMount={(editor) => {
					measure(editor);
					// Word wrap makes height depend on width, so a resize changes it too --
					// `onDidContentSizeChange` covers both, since a reflow changes the
					// content height Monaco reports.
					editor.onDidContentSizeChange(() => measure(editor));
				}}
			/>
		</div>
	);
}

/**
 * A turn's produced answer against its expectation, in one diff editor.
 *
 * Two `whitespace-pre-wrap` columns showed both values but aligned neither: the fifth line
 * of one sat beside the second line of the other, so finding the character that differs
 * meant reading both in full. The diff editor aligns them line for line and marks the
 * difference -- which is the entire question this row exists to answer.
 */
export function AnswerDiff({
	produced,
	expected,
	mismatched = false,
	onExpectedChange,
}: {
	produced: string;
	expected: string;
	/** Colours the expected side's heading, matching the row's outcome line. */
	mismatched?: boolean;
	/**
	 * Commits an edit to the expectation. Absent leaves the pair read-only -- a log's
	 * recorded trace, or a panel with nowhere to keep the value.
	 */
	onExpectedChange?: (text: string) => void;
}) {
	return (
		<div className="mt-1">
			{/*
			 * The diff editor labels neither pane, and which side is which is not
			 * guessable: both hold an answer to the same question. The headings are
			 * two halves of the same row so they line up with the panes below.
			 */}
			<div className="flex text-xs font-medium text-muted-foreground">
				<div className="w-1/2 min-w-0 pl-2">Produced</div>
				<div className={cn("w-1/2 min-w-0 pl-2", mismatched && "text-destructive")}>
					Expected
				</div>
			</div>
			<div
				className={cn(
					"output-diff-container relative mt-1 min-w-0 overflow-hidden rounded-md border",
					mismatched && "border-destructive/40",
				)}
			>
				{/*
				 * `onBlur`, deliberately NOT `onChange` -- the same contract `CompareDialog`
				 * documents. `onChange` fires once per keystroke; wired to the commit, each
				 * resolved write changes `expected`, and a changed `modified` prop makes the
				 * editor replace its whole model mid-word.
				 */}
				<CompareDiffEditor
					original={produced}
					modified={expected}
					onBlur={onExpectedChange}
					maxHeight={ANSWER_MAX_HEIGHT}
					minHeight={ANSWER_MIN_HEIGHT}
					renderOverviewRuler={false}
					surfaceToken="--background"
					className="output-diff-editor w-full min-w-0"
					options={{
						// Inline, in a box a few lines tall, a minimap is a stripe of noise
						// wider than the text it maps. The dialog behind "Compare" keeps
						// its own, where there is enough content for it to mean something.
						minimap: { enabled: false },
						fontSize: 13,
					}}
				/>
			</div>
		</div>
	);
}
