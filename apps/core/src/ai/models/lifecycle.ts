import { AiVendor } from "@/prisma";
import type { ModelLifecycle } from "./builder";
import { findRegistryModel } from "./pricing";

/** A model as the API lists it: the registry's lifecycle, with the replacement's display name. */
export type ListedLifecycle = ModelLifecycle & { replacementDisplayName?: string };

type NamedModel = { vendor: AiVendor; name: string };

const VENDOR_NAMES: Record<AiVendor, string> = {
	[AiVendor.OPENAI]: "OpenAI",
	[AiVendor.ANTHROPIC]: "Anthropic",
	[AiVendor.GOOGLE]: "Google",
	[AiVendor.DEEPSEEK]: "DeepSeek",
	[AiVendor.CUSTOM_OPENAI_COMPATIBLE]: "its provider",
};

/** The registry's lifecycle for a model; null while it is current or outside the registry. */
export function getModelLifecycle(model: NamedModel): ModelLifecycle | null {
	return findRegistryModel(model.vendor, model.name)?.lifecycle ?? null;
}

function replacementDisplayName(model: NamedModel, lifecycle: ModelLifecycle) {
	if (!lifecycle.replacement) return undefined;
	const replacement = findRegistryModel(model.vendor, lifecycle.replacement);
	return replacement?.displayName ?? lifecycle.replacement;
}

/**
 * Why a run, or a switch to this model, is refused; null when the model is not retired. The
 * vendor would refuse the call anyway, with an error that names neither a date nor a way out.
 */
export function retiredModelMessage(model: NamedModel): string | null {
	const lifecycle = getModelLifecycle(model);
	if (lifecycle?.status !== "retired") return null;

	const name = findRegistryModel(model.vendor, model.name)?.displayName ?? model.name;
	const replacement = replacementDisplayName(model, lifecycle);
	return (
		`${name} was shut down by ${VENDOR_NAMES[model.vendor]} on ` +
		`${lifecycle.retiredOn} and can no longer run. Switch this prompt to another model` +
		(replacement ? `, such as ${replacement}.` : ".")
	);
}

export function isModelRetired(model: NamedModel): boolean {
	return getModelLifecycle(model)?.status === "retired";
}

/** A model row with its lifecycle, for display. `null` while the model is current. */
export function withLifecycle<T extends NamedModel>(
	model: T,
): T & { lifecycle: ListedLifecycle | null } {
	const lifecycle = getModelLifecycle(model);
	if (!lifecycle) return { ...model, lifecycle: null };

	const displayName = replacementDisplayName(model, lifecycle);
	return {
		...model,
		lifecycle: displayName ? { ...lifecycle, replacementDisplayName: displayName } : lifecycle,
	};
}
