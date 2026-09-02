import { useState } from "react";
import { StarIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmDialog } from "@/pages/settings/components/shared/DeleteConfirmDialog";
import type { PromptPlaceholder, PromptPlaceholderValue } from "@/api/prompt/placeholder.api";
import { usePlaceholderMutations } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePlaceholderMutations";

interface PlaceholderValueEditorProps {
	promptId: number;
	placeholder: PromptPlaceholder;
	value: PromptPlaceholderValue;
}

export default function PlaceholderValueEditor({
	promptId,
	placeholder,
	value,
}: PlaceholderValueEditorProps) {
	const { updateValue, deleteValue, isMutatingValue } = usePlaceholderMutations(promptId);

	const [drafts, setDrafts] = useState<Record<number, string>>({});
	const [valuePendingDelete, setValuePendingDelete] = useState<PromptPlaceholderValue | null>(
		null,
	);

	const contentFor = (target: PromptPlaceholderValue) => drafts[target.id] ?? target.content;

	// Only clears the draft if it still equals what was submitted -- if the user
	// re-focused and kept typing before the request settled, `drafts[valueId]` has
	// since moved on, and wiping it back to the submitted (or pre-save) text would
	// discard their in-progress edit.
	const clearDraftIfUnchanged = (valueId: number, submittedContent: string) => {
		setDrafts((prev) => {
			if (prev[valueId] !== submittedContent) return prev;
			const next = { ...prev };
			delete next[valueId];
			return next;
		});
	};

	const handleContentChange = (valueId: number, content: string) => {
		setDrafts((prev) => ({ ...prev, [valueId]: content }));
	};

	const handleBlur = (target: PromptPlaceholderValue) => {
		const draft = drafts[target.id];
		if (draft === undefined || draft === target.content) return;
		const submittedContent = draft;
		// Clear the draft either way, but only if nothing changed underneath it (see
		// clearDraftIfUnchanged): on success `usePlaceholderMutations` has already
		// seeded the cache with this exact content, so `value.content` is current, not
		// stale, the instant the draft drops. On failure the toast already fired --
		// leaving the draft in place would keep the textarea showing content the
		// server rejected, permanently shadowing the real (server) value.
		updateValue(placeholder.id, target.id, { content: submittedContent })
			.then(() => clearDraftIfUnchanged(target.id, submittedContent))
			.catch(() => clearDraftIfUnchanged(target.id, submittedContent));
	};

	const handleMakeDefault = () => {
		updateValue(placeholder.id, value.id, { isDefault: true }).catch(() => {
			// usePlaceholderMutations already surfaces a toast on failure.
		});
	};

	const handleConfirmDelete = async () => {
		if (!valuePendingDelete) return;
		try {
			await deleteValue(placeholder.id, valuePendingDelete.id);
			setValuePendingDelete(null);
		} catch {
			// usePlaceholderMutations already surfaces a toast on failure.
		}
	};

	const pinnedCount = valuePendingDelete?._count?.testCases ?? 0;

	return (
		<div className="flex h-full min-w-0 flex-col gap-4">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div className="min-w-0">
					<p className="truncate text-xs text-muted-foreground">{placeholder.key}</p>
					<h3 className="truncate text-base font-semibold text-foreground">
						{value.name}
					</h3>
				</div>
				<div className="flex shrink-0 items-center gap-2">
					{value.isDefault ? (
						<Badge variant="secondary" className="gap-1">
							<StarIcon className="h-3 w-3" weight="fill" />
							Default
						</Badge>
					) : (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={handleMakeDefault}
							disabled={isMutatingValue}
						>
							Make default
						</Button>
					)}
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="h-8 w-8"
						onClick={() => setValuePendingDelete(value)}
						aria-label={`Delete ${value.name}`}
					>
						<TrashIcon className="h-4 w-4" />
					</Button>
				</div>
			</div>

			<Textarea
				key={value.id}
				value={contentFor(value)}
				onChange={(e) => handleContentChange(value.id, e.target.value)}
				onBlur={() => handleBlur(value)}
				className="min-h-[360px] w-full flex-1 resize-none"
				placeholder="Enter value content"
			/>

			<DeleteConfirmDialog
				open={!!valuePendingDelete}
				onOpenChange={(open) => {
					if (!open) setValuePendingDelete(null);
				}}
				onConfirm={handleConfirmDelete}
				title={`Delete "${valuePendingDelete?.name ?? ""}"?`}
				description={
					pinnedCount > 0
						? `${pinnedCount} testcase${pinnedCount === 1 ? "" : "s"} pin this value. Deleting it will clear ${pinnedCount === 1 ? "that pin" : "those pins"}.`
						: "No testcase pins this value."
				}
				isDeleting={isMutatingValue}
			/>
		</div>
	);
}
