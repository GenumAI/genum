import type { BuiltModel } from "../builder";
import { ANTHROPIC_MODELS } from "./anthropic";
import { GEMINI_MODELS } from "./gemini";
import { OPENAI_MODELS } from "./openai";

export { ANTHROPIC_MODELS } from "./anthropic";
export { GEMINI_MODELS } from "./gemini";
export { OPENAI_MODELS } from "./openai";

/** All models from all vendors for ModelConfigService */
export const ALL_MODELS: BuiltModel[] = [
	...OPENAI_MODELS,
	...ANTHROPIC_MODELS,
	...GEMINI_MODELS,
];
