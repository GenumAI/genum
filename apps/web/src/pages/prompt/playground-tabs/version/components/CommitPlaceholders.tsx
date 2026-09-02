import type { PlaceholderDefinition } from "@genum/placeholders";

/**
 * What a commit froze, shown on the commit itself.
 *
 * Placeholders are committed logic: a value's content is part of what the model
 * receives, so a commit that shows only its text is showing half of what it carries.
 *
 * The three states are distinct on purpose. `null` is a commit made before placeholders
 * existed -- its holes render verbatim at run time, which is not the same as having none
 * -- and an empty array is a commit that genuinely had none. Collapsing the two would
 * tell an author a pre-feature commit is placeholder-free when its text may be full of
 * `{{keys}}` that resolve to nothing.
 */
export function CommitPlaceholders({ snapshot }: { snapshot: unknown }) {
	if (snapshot === null || snapshot === undefined) {
		return (
			<span className="text-[12px] text-muted-foreground/70">placeholders not recorded</span>
		);
	}

	if (!Array.isArray(snapshot) || snapshot.length === 0) return null;

	const definitions = snapshot as PlaceholderDefinition[];

	return (
		<div className="mt-1 flex flex-wrap items-center gap-1.5">
			{definitions.map((definition) => {
				const count = definition.values?.length ?? 0;
				const fallback = definition.values?.find((value) => value.isDefault);
				return (
					<span
						key={definition.key}
						className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-[1px] text-[11px]"
						title={
							`${count} ${count === 1 ? "value" : "values"}. ` +
							(fallback
								? `Default: ${fallback.name}.`
								: "No default — this key renders empty unless a value is selected.")
						}
					>
						<span className="font-semibold text-foreground">{definition.key}</span>
						<span className="text-muted-foreground">
							{fallback ? fallback.name : "no default"}
						</span>
					</span>
				);
			})}
		</div>
	);
}
