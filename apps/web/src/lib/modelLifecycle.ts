import type { Model, ModelLifecycle } from "@/types/AIModel";

/** "2026-11-30" as "Nov 30, 2026". The date is a calendar day, so it is read and shown as UTC. */
export function formatLifecycleDate(isoDate: string): string {
	return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		timeZone: "UTC",
	});
}

export function isRetired(model: Pick<Model, "lifecycle"> | undefined): boolean {
	return model?.lifecycle?.status === "retired";
}

function replacementName(lifecycle: ModelLifecycle) {
	return lifecycle.replacementDisplayName ?? lifecycle.replacement;
}

/** The short tag beside a model in the selector, or null for a current model. */
export function lifecycleTag(lifecycle: ModelLifecycle | null | undefined): string | null {
	if (!lifecycle) return null;
	if (lifecycle.status === "retired") return "Retired";
	return `Until ${formatLifecycleDate(lifecycle.retiresOn)}`;
}

/** One sentence on what is happening to the model and what to move to. */
export function lifecycleNotice(lifecycle: ModelLifecycle | null | undefined): string | null {
	if (!lifecycle) return null;
	const replacement = replacementName(lifecycle);
	const suggestion = replacement ? ` Switch to ${replacement} or another model.` : "";
	if (lifecycle.status === "retired") {
		return `The vendor shut this model down on ${formatLifecycleDate(lifecycle.retiredOn)}, so it can no longer run.${suggestion || " Select a different model."}`;
	}
	return `The vendor will shut this model down on ${formatLifecycleDate(lifecycle.retiresOn)}.${suggestion}`;
}
