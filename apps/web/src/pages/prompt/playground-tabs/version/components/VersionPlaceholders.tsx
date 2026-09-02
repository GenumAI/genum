import type React from "react";
import { useMemo, useState } from "react";
import { detectPlaceholderKeys } from "@genum/placeholders";
import { Card } from "@/components/ui/card";
import PlaceholderList from "@/pages/prompt/playground-tabs/placeholders/components/PlaceholderList";
import PlaceholderValueList from "@/pages/prompt/playground-tabs/placeholders/components/PlaceholderValueList";
import PlaceholderValueEditor from "@/pages/prompt/playground-tabs/placeholders/components/PlaceholderValueEditor";
import type { PromptPlaceholder } from "@/api/prompt/placeholder.api";

/**
 * The placeholder definitions this commit froze, in the same three-pane view the author
 * edits them in — read-only.
 *
 * Deliberately the SAME components as the Placeholders tab rather than a bespoke preview:
 * a second rendering of the same data drifts from the first, and then the page you check
 * history in no longer looks like the page you author in.
 *
 * A snapshot is a plain JSON array with no row ids, so ids are synthesised from position
 * purely to drive selection. They are local to this render and never sent anywhere.
 */

type SnapshotValue = { name?: unknown; content?: unknown; isDefault?: unknown };
type SnapshotDefinition = { key?: unknown; values?: unknown };

function toPlaceholders(snapshot: unknown[]): PromptPlaceholder[] {
	return snapshot.map((entry, index) => {
		const definition = (entry ?? {}) as SnapshotDefinition;
		const values = Array.isArray(definition.values) ? definition.values : [];

		return {
			// Positional, and offset per placeholder so two values in different
			// placeholders can never collide on the id the value list selects by.
			id: index + 1,
			key: typeof definition.key === "string" ? definition.key : "",
			description: null,
			values: values.map((raw, valueIndex) => {
				const value = (raw ?? {}) as SnapshotValue;
				return {
					id: (index + 1) * 1000 + valueIndex,
					name: typeof value.name === "string" ? value.name : "",
					content: typeof value.content === "string" ? value.content : "",
					isDefault: value.isDefault === true,
				};
			}),
		};
	});
}

interface VersionPlaceholdersProps {
	snapshot: unknown;
	/** This commit's own prompt text, so a key can be marked as used by THIS commit. */
	promptText: string;
	promptId: number | undefined;
}

export const VersionPlaceholders: React.FC<VersionPlaceholdersProps> = ({
	snapshot,
	promptText,
	promptId,
}) => {
	const placeholders = useMemo(
		() => (Array.isArray(snapshot) ? toPlaceholders(snapshot) : []),
		[snapshot],
	);
	const keysInPromptText = useMemo(
		() => new Set(detectPlaceholderKeys(promptText)),
		[promptText],
	);

	const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
	const [selectedValueId, setSelectedValueId] = useState<number | undefined>(undefined);

	const selectedPlaceholder =
		placeholders.find((placeholder) => placeholder.id === selectedId) ?? placeholders[0];

	// Derived, never stored raw: a value id picked under one placeholder must not survive
	// a switch to another and show that one's content under this one's name.
	const selectedValue = useMemo(() => {
		if (!selectedPlaceholder) return undefined;
		return (
			selectedPlaceholder.values.find((value) => value.id === selectedValueId) ??
			selectedPlaceholder.values[0]
		);
	}, [selectedPlaceholder, selectedValueId]);

	const heading = <h3 className="mb-3 text-lg font-semibold text-foreground">Placeholders</h3>;

	// A commit with no snapshot predates the feature. Saying "no placeholders" here would
	// be a claim the data does not support: its holes are sent to the model as written.
	if (snapshot === null || snapshot === undefined) {
		return (
			<div>
				{heading}
				<Card className="rounded-md border border-border p-4 text-sm text-muted-foreground shadow-sm">
					This commit was made before placeholders were recorded. Any placeholder in its
					prompt is sent to the model as written.
				</Card>
			</div>
		);
	}

	if (!Array.isArray(snapshot)) return null;

	if (placeholders.length === 0) {
		return (
			<div>
				{heading}
				<Card className="rounded-md border border-border p-4 text-sm text-muted-foreground shadow-sm">
					This commit has no placeholders.
				</Card>
			</div>
		);
	}

	return (
		<div>
			{heading}
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_220px_minmax(0,1fr)]">
				<div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3">
					<PlaceholderList
						placeholders={placeholders}
						keysInPromptText={keysInPromptText}
						selectedId={selectedPlaceholder?.id}
						readOnly
						onSelect={(id) => {
							setSelectedId(id);
							setSelectedValueId(undefined);
						}}
					/>
				</div>

				<PlaceholderValueList
					values={selectedPlaceholder?.values ?? []}
					hasSelectedPlaceholder={!!selectedPlaceholder}
					selectedValueId={selectedValue?.id}
					readOnly
					onSelect={setSelectedValueId}
					emptyLabel="This placeholder had no values."
				/>

				<div className="min-w-0 rounded-xl border border-border p-4">
					{selectedPlaceholder && selectedValue && promptId ? (
						<PlaceholderValueEditor
							promptId={promptId}
							placeholder={selectedPlaceholder}
							value={selectedValue}
							readOnly
						/>
					) : (
						<div className="flex min-h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
							This placeholder had no values, so it rendered empty on every run of
							this commit.
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
