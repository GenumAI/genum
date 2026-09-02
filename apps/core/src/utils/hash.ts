import type { Prompt } from "@/prisma";
import { createHash } from "node:crypto";

/**
 * `placeholderFingerprint` is `null` when the prompt has no placeholders, and the key is
 * then omitted entirely rather than hashed as null -- that keeps the hashed object
 * byte-identical to what this function produced before placeholders existed, so adding
 * them here does not mark every placeholder-free prompt in the fleet as uncommitted.
 */
export function commitHash(
	prompt: Prompt,
	generations: number,
	placeholderFingerprint: string | null = null,
) {
	const values = {
		promptInstructions: prompt.value,
		promptLanguageModelId: prompt.languageModelId,
		promptLanguageModelConfig: prompt.languageModelConfig,
		generations: generations,
		...(placeholderFingerprint === null ? {} : { promptPlaceholders: placeholderFingerprint }),
	};

	const hash = createHash("sha256").update(JSON.stringify(values)).digest("hex");

	return hash as string;
}
