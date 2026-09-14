import { checkIsJson } from "@/lib/jsonUtils";

/**
 * The inline answer editor grows with its content between these bounds. A floor, because
 * Monaco reports a one-line content height of ~18px and an editor that short reads as a
 * rendering glitch rather than a field. A ceiling, because a turn's answer sits inside a
 * thread of other turns -- one long answer must not push the rest of the conversation off
 * the page, so past this it scrolls inside its own box.
 */
export const ANSWER_MIN_HEIGHT = 48;
export const ANSWER_MAX_HEIGHT = 320;

/**
 * Which language the answer should be highlighted as.
 *
 * Only an object or an array counts as JSON. `42`, `"Paris"` and `true` are all valid
 * JSON documents, so a bare `JSON.parse` check would colour an ordinary one-word answer
 * as a JSON literal -- saying something false about what the model returned.
 */
export function answerLanguage(text: string): "json" | "plaintext" {
	if (!checkIsJson(text)) return "plaintext";
	const parsed = JSON.parse(text);
	return typeof parsed === "object" && parsed !== null ? "json" : "plaintext";
}

/** Content height reported by Monaco, held between the bounds above. */
export function clampAnswerHeight(contentHeight: number): number {
	// Monaco reports 0 before its first layout, and a NaN has been seen from a disposed
	// editor. Both must land on the floor rather than collapsing the box to nothing.
	if (!Number.isFinite(contentHeight)) return ANSWER_MIN_HEIGHT;
	return Math.min(Math.max(contentHeight, ANSWER_MIN_HEIGHT), ANSWER_MAX_HEIGHT);
}
