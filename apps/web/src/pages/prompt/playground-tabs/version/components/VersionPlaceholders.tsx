import type React from "react";
import { Card } from "@/components/ui/card";
import type { PlaceholderDefinition } from "@genum/placeholders";

/**
 * The placeholder definitions this commit froze, shown in full on the commit page.
 *
 * Placeholders are committed logic: the content of the selected value is spliced into the
 * prompt before it reaches the model, so a commit page that shows only the prompt text and
 * the model config is showing a prompt that will not run the way it reads. The content is
 * here, verbatim, for the same reason the prompt text is.
 *
 * `null`/absent and `[]` are deliberately different. A commit made before placeholders
 * existed carries no snapshot, and its `{{holes}}` render verbatim at run time -- saying
 * "no placeholders" there would be a claim the data does not support.
 */
export const VersionPlaceholders: React.FC<{ snapshot: unknown }> = ({ snapshot }) => {
	if (snapshot === null || snapshot === undefined) {
		return (
			<div>
				<h3 className="mb-3 text-lg font-semibold text-foreground">Placeholders</h3>
				<Card className="rounded-md border border-border p-4 text-sm text-muted-foreground shadow-sm">
					This commit was made before placeholders were recorded. Any{" "}
					<code className="rounded bg-muted px-1 py-[1px] text-xs">{"{{key}}"}</code> in
					its prompt is sent to the model as written.
				</Card>
			</div>
		);
	}

	if (!Array.isArray(snapshot)) return null;

	const definitions = snapshot as PlaceholderDefinition[];

	if (definitions.length === 0) {
		return (
			<div>
				<h3 className="mb-3 text-lg font-semibold text-foreground">Placeholders</h3>
				<Card className="rounded-md border border-border p-4 text-sm text-muted-foreground shadow-sm">
					This commit has no placeholders.
				</Card>
			</div>
		);
	}

	return (
		<div>
			<h3 className="mb-3 text-lg font-semibold text-foreground">Placeholders</h3>
			<div className="flex flex-col gap-4">
				{definitions.map((definition) => {
					const values = definition.values ?? [];
					const hasDefault = values.some((value) => value.isDefault);

					return (
						<Card
							key={definition.key}
							className="overflow-hidden rounded-md border border-border shadow-sm"
						>
							<div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/30 px-4 py-2">
								<code className="text-sm font-semibold text-foreground">
									{`{{${definition.key}}}`}
								</code>
								<span className="text-xs text-muted-foreground">
									{values.length} {values.length === 1 ? "value" : "values"}
									{hasDefault
										? ""
										: " · no default, so this key renders empty unless a value is selected"}
								</span>
							</div>

							<div className="divide-y divide-border">
								{values.map((value) => (
									<div key={value.name} className="px-4 py-3">
										<div className="mb-1 flex items-center gap-2">
											<span className="text-sm font-medium text-foreground">
												{value.name}
											</span>
											{value.isDefault && (
												<span className="rounded border border-success/40 bg-success-soft px-2 py-[1px] text-[11px] font-semibold text-success">
													default
												</span>
											)}
										</div>
										{value.content.trim() ? (
											<pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/40 p-3 text-xs text-foreground">
												{value.content}
											</pre>
										) : (
											<p className="text-xs italic text-muted-foreground">
												Empty — this value removes the block.
											</p>
										)}
									</div>
								))}
							</div>
						</Card>
					);
				})}
			</div>
		</div>
	);
};
