import { useState } from "react";
import { PlusCircleIcon, StarIcon, TrashIcon } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/pages/settings/components/shared/DeleteConfirmDialog";
import type { PromptPlaceholder, PromptPlaceholderValue } from "@/api/prompt/placeholder.api";
import { usePlaceholderMutations } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePlaceholderMutations";

interface PlaceholderValueEditorProps {
	promptId: number;
	placeholder: PromptPlaceholder;
}

export default function PlaceholderValueEditor({
	promptId,
	placeholder,
}: PlaceholderValueEditorProps) {
	const { createValue, updateValue, deleteValue, isMutatingValue } =
		usePlaceholderMutations(promptId);

	const [drafts, setDrafts] = useState<Record<number, string>>({});
	const [newValueOpen, setNewValueOpen] = useState(false);
	const [newValueName, setNewValueName] = useState("");
	const [newValueContent, setNewValueContent] = useState("");
	const [valuePendingDelete, setValuePendingDelete] = useState<PromptPlaceholderValue | null>(
		null,
	);

	const contentFor = (value: PromptPlaceholderValue) => drafts[value.id] ?? value.content;

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

	const handleBlur = (value: PromptPlaceholderValue) => {
		const draft = drafts[value.id];
		if (draft === undefined || draft === value.content) return;
		const submittedContent = draft;
		// Clear the draft either way, but only if nothing changed underneath it (see
		// clearDraftIfUnchanged): on success `usePlaceholderMutations` has already
		// seeded the cache with this exact content, so `value.content` is current, not
		// stale, the instant the draft drops. On failure the toast already fired --
		// leaving the draft in place would keep the textarea showing content the
		// server rejected, permanently shadowing the real (server) value.
		updateValue(placeholder.id, value.id, { content: submittedContent })
			.then(() => clearDraftIfUnchanged(value.id, submittedContent))
			.catch(() => clearDraftIfUnchanged(value.id, submittedContent));
	};

	const handleMakeDefault = (value: PromptPlaceholderValue) => {
		updateValue(placeholder.id, value.id, { isDefault: true }).catch(() => {
			// usePlaceholderMutations already surfaces a toast on failure.
		});
	};

	const handleCreateValue = async () => {
		if (!newValueName.trim()) return;
		try {
			await createValue(placeholder.id, {
				name: newValueName.trim(),
				content: newValueContent,
			});
			setNewValueName("");
			setNewValueContent("");
			setNewValueOpen(false);
		} catch {
			// usePlaceholderMutations already surfaces a toast on failure.
		}
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
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<h3 className="truncate text-sm font-semibold text-foreground">
						{placeholder.key}
					</h3>
					{placeholder.description && (
						<p className="truncate text-xs text-muted-foreground">
							{placeholder.description}
						</p>
					)}
				</div>
				<Button type="button" size="sm" onClick={() => setNewValueOpen(true)}>
					<PlusCircleIcon className="mr-2 h-4 w-4" />
					Add value
				</Button>
			</div>

			{placeholder.values.length === 0 && (
				<div className="flex min-h-[160px] items-center justify-center rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
					No values yet. Add one to get started.
				</div>
			)}

			<div className="flex flex-col gap-3">
				{placeholder.values.map((value) => (
					<Card key={value.id}>
						<CardContent className="space-y-3 p-4">
							<div className="flex items-center justify-between gap-2">
								<span className="min-w-0 truncate text-sm font-semibold text-foreground">
									{value.name}
								</span>
								<div className="flex shrink-0 items-center gap-2">
									{value.isDefault ? (
										<Badge variant="secondary" className="gap-1">
											<StarIcon className="h-3 w-3" weight="fill" />
											Default
										</Badge>
									) : (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											onClick={() => handleMakeDefault(value)}
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
								value={contentFor(value)}
								onChange={(e) => handleContentChange(value.id, e.target.value)}
								onBlur={() => handleBlur(value)}
								className="min-h-[100px] w-full"
								placeholder="Enter value content"
							/>
						</CardContent>
					</Card>
				))}
			</div>

			<Dialog open={newValueOpen} onOpenChange={setNewValueOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Add value</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground">Name</p>
							<Input
								placeholder="e.g. admin"
								value={newValueName}
								onChange={(e) => setNewValueName(e.target.value)}
							/>
						</div>
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground">
								Content
							</p>
							<Textarea
								placeholder="Enter value content"
								value={newValueContent}
								onChange={(e) => setNewValueContent(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter className="mt-4">
						<Button variant="outline" onClick={() => setNewValueOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleCreateValue}
							disabled={isMutatingValue || !newValueName.trim()}
						>
							Add
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

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
