import { mdToXml } from "@/utils/xml";

/**
 * Mirrors Prisma's `InstructionFormat`. Restated as a union rather than imported so this
 * module stays usable from a caller that has a string, not a Prompt row -- the render
 * endpoint's query, say.
 */
export type InstructionShape = "XML" | "RAW";

/**
 * The last thing done to an instruction before a model sees it.
 *
 * This transform used to live inline at the one place that called a provider, which made
 * it invisible to everyone else: an external app that fetches a prompt and runs its own
 * agent loop sent the raw rendered text, while a Lab replay of that same session sent the
 * XML-shaped version. The two ran differently shaped instructions and the replay was
 * quietly not a replay. One function, called by the runner and returned verbatim by the
 * render endpoint, is what keeps production and replay identical by construction.
 *
 * `XML` is what every prompt has had until now and stays the default: changing the shape
 * of an instruction changes what the model answers, and doing that to every existing
 * prompt at once is not a migration anyone asked for.
 */
export function shapeInstruction(
	instruction: string,
	format: InstructionShape,
	options: { systemPrompt?: boolean } = {},
): string {
	// RAW means raw: not even the wrapper. A caller asking for the text as written and
	// getting it inside a tag it did not write is back where it started.
	const shaped = format === "RAW" ? instruction : mdToXml(instruction);

	return options.systemPrompt ? `<system_prompt>${shaped}</system_prompt>` : shaped;
}
