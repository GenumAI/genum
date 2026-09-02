import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { PlusCircleIcon } from "@phosphor-icons/react";
import { detectPlaceholderKeys } from "@genum/placeholders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchInput } from "@/components/ui/searchInput";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { DeleteConfirmDialog } from "@/pages/settings/components/shared/DeleteConfirmDialog";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { usePromptById } from "@/hooks/usePrompt";
import { usePromptPlaceholders } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePromptPlaceholders";
import { usePlaceholderMutations } from "@/pages/prompt/playground-tabs/placeholders/hooks/usePlaceholderMutations";
import PlaceholderList from "@/pages/prompt/playground-tabs/placeholders/components/PlaceholderList";
import PlaceholderValueList from "@/pages/prompt/playground-tabs/placeholders/components/PlaceholderValueList";
import PlaceholderValueEditor from "@/pages/prompt/playground-tabs/placeholders/components/PlaceholderValueEditor";
import type { PromptPlaceholder } from "@/api/prompt/placeholder.api";

export default function Placeholders() {
	const { id, tab } = useParams<{ id: string; tab: string }>();
	const promptId = id ? Number(id) : undefined;
	const isActive = tab === "placeholders";

	const { prompt } = usePromptById(promptId);
	const promptValue = prompt?.prompt?.value || "";
	const keysInPromptText = useMemo(
		() => new Set(detectPlaceholderKeys(promptValue)),
		[promptValue],
	);

	const {
		data: placeholders = [],
		isLoading,
		isError,
	} = usePromptPlaceholders(promptId, isActive);
	const {
		createPlaceholder,
		updatePlaceholder,
		deletePlaceholder,
		createValue,
		isCreatingPlaceholder,
		isUpdatingPlaceholder,
		isDeletingPlaceholder,
		isMutatingValue,
	} = usePlaceholderMutations(promptId);

	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
	const [selectedValueId, setSelectedValueId] = useState<number | undefined>(undefined);
	const [createOpen, setCreateOpen] = useState(false);
	const [newKey, setNewKey] = useState("");
	const [newDescription, setNewDescription] = useState("");
	const [placeholderPendingDelete, setPlaceholderPendingDelete] =
		useState<PromptPlaceholder | null>(null);
	const [placeholderBeingEdited, setPlaceholderBeingEdited] = useState<PromptPlaceholder | null>(
		null,
	);
	const [editKey, setEditKey] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [newValueOpen, setNewValueOpen] = useState(false);
	const [newValueName, setNewValueName] = useState("");
	const [newValueContent, setNewValueContent] = useState("");

	const filteredPlaceholders = useMemo(() => {
		const term = search.trim().toLowerCase();
		if (!term) return placeholders;
		return placeholders.filter(
			(placeholder) =>
				placeholder.key.toLowerCase().includes(term) ||
				(placeholder.description ?? "").toLowerCase().includes(term),
		);
	}, [placeholders, search]);

	// Keep the selection valid as the list changes -- a search that filters the
	// selected key out, or a delete removing it, must fall back rather than show a
	// stale detail pane for a key no longer in view.
	useEffect(() => {
		if (filteredPlaceholders.length === 0) {
			setSelectedId(undefined);
			return;
		}
		if (!filteredPlaceholders.some((placeholder) => placeholder.id === selectedId)) {
			setSelectedId(filteredPlaceholders[0].id);
		}
	}, [filteredPlaceholders, selectedId]);

	const selectedPlaceholder = filteredPlaceholders.find(
		(placeholder) => placeholder.id === selectedId,
	);

	// Derived, not stored: a value id selected under a previous placeholder must never
	// outlive it. If `selectedValueId` isn't among the CURRENT placeholder's values --
	// because the placeholder changed, the value was deleted, or nothing was ever
	// selected -- fall back to the first value instead of showing a stale or empty
	// editor. Loading holds off the fallback so it never fires before the real values
	// have arrived (loading is not emptiness, same rule as the panes below).
	const selectedValue = useMemo(() => {
		if (!selectedPlaceholder) return undefined;
		const explicit = selectedPlaceholder.values.find((value) => value.id === selectedValueId);
		if (explicit) return explicit;
		if (isLoading) return undefined;
		return selectedPlaceholder.values[0];
	}, [selectedPlaceholder, selectedValueId, isLoading]);

	const handleCreatePlaceholder = async () => {
		if (!newKey.trim()) return;
		try {
			const { placeholder } = await createPlaceholder({
				key: newKey.trim(),
				description: newDescription.trim() || null,
			});
			setNewKey("");
			setNewDescription("");
			setCreateOpen(false);
			setSelectedId(placeholder.id);
		} catch {
			// usePlaceholderMutations already surfaces a toast on failure.
		}
	};

	const handleConfirmDeletePlaceholder = async () => {
		if (!placeholderPendingDelete) return;
		try {
			await deletePlaceholder(placeholderPendingDelete.id);
			setPlaceholderPendingDelete(null);
		} catch {
			// usePlaceholderMutations already surfaces a toast on failure.
		}
	};

	const handleRequestEditPlaceholder = (placeholder: PromptPlaceholder) => {
		setPlaceholderBeingEdited(placeholder);
		setEditKey(placeholder.key);
		setEditDescription(placeholder.description ?? "");
	};

	const handleConfirmEditPlaceholder = async () => {
		if (!placeholderBeingEdited || !editKey.trim()) return;
		try {
			await updatePlaceholder(placeholderBeingEdited.id, {
				key: editKey.trim(),
				description: editDescription.trim() || null,
			});
			setPlaceholderBeingEdited(null);
		} catch {
			// usePlaceholderMutations already surfaces a toast on failure.
		}
	};

	const handleCreateValue = async () => {
		if (!selectedPlaceholder || !newValueName.trim()) return;
		try {
			const { value } = await createValue(selectedPlaceholder.id, {
				name: newValueName.trim(),
				content: newValueContent,
			});
			setNewValueName("");
			setNewValueContent("");
			setNewValueOpen(false);
			setSelectedValueId(value.id);
		} catch {
			// usePlaceholderMutations already surfaces a toast on failure.
		}
	};

	return (
		<div className="w-full min-w-0 space-y-6 bg-background px-3 pt-8 text-foreground lg:pr-6">
			{isError ? (
				// A failed load is not the same fact as genuine emptiness -- W1 fixed this
				// one screen over (the chips); this is the tab's own copy of that defect.
				<EmptyState
					title="Couldn't load placeholders"
					description="Something went wrong loading this prompt's placeholders. Try reloading the page."
				/>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_220px_minmax(0,1fr)]">
					<div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border p-3">
						<SearchInput
							placeholder="Search..."
							className="w-full"
							value={search}
							onChange={(e) => setSearch(e.target.value)}
						/>
						<Button className="w-full" onClick={() => setCreateOpen(true)}>
							<PlusCircleIcon className="mr-2 h-4 w-4" />
							New placeholder
						</Button>
						<PlaceholderList
							placeholders={filteredPlaceholders}
							keysInPromptText={keysInPromptText}
							selectedId={selectedId}
							isLoading={isLoading}
							onSelect={setSelectedId}
							onRequestDelete={setPlaceholderPendingDelete}
							onRequestEdit={handleRequestEditPlaceholder}
						/>
					</div>

					<PlaceholderValueList
						values={selectedPlaceholder?.values ?? []}
						hasSelectedPlaceholder={!!selectedPlaceholder}
						selectedValueId={selectedValue?.id}
						isLoading={isLoading}
						onSelect={setSelectedValueId}
						onRequestNew={() => setNewValueOpen(true)}
					/>

					<div className="min-w-0 rounded-xl border border-border p-4">
						{isLoading ? (
							// Loading is not emptiness -- the placeholders query still being in
							// flight must never render as "select a placeholder" or "no values",
							// the same rule PlaceholderList and the chips already apply.
							<div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
								Loading…
							</div>
						) : selectedPlaceholder && selectedValue && promptId ? (
							<PlaceholderValueEditor
								promptId={promptId}
								placeholder={selectedPlaceholder}
								value={selectedValue}
							/>
						) : selectedPlaceholder ? (
							<div className="flex min-h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
								No values yet. Add one to get started.
							</div>
						) : (
							<div className="flex min-h-[200px] items-center justify-center text-sm text-muted-foreground">
								Select a placeholder to manage its values.
							</div>
						)}
					</div>
				</div>
			)}

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New placeholder</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground">Key</p>
							<Input
								placeholder="e.g. tone"
								value={newKey}
								onChange={(e) => setNewKey(e.target.value)}
							/>
						</div>
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground">
								Description (optional)
							</p>
							<Textarea
								placeholder="What is this placeholder for?"
								value={newDescription}
								onChange={(e) => setNewDescription(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter className="mt-4">
						<Button variant="outline" onClick={() => setCreateOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={handleCreatePlaceholder}
							disabled={isCreatingPlaceholder || !newKey.trim()}
						>
							Create
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog
				open={!!placeholderBeingEdited}
				onOpenChange={(open) => {
					if (!open) setPlaceholderBeingEdited(null);
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit placeholder</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground">Key</p>
							<Input
								placeholder="e.g. tone"
								value={editKey}
								onChange={(e) => setEditKey(e.target.value)}
							/>
						</div>
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground">
								Description (optional)
							</p>
							<Textarea
								placeholder="What is this placeholder for?"
								value={editDescription}
								onChange={(e) => setEditDescription(e.target.value)}
							/>
						</div>
					</div>
					<DialogFooter className="mt-4">
						<Button variant="outline" onClick={() => setPlaceholderBeingEdited(null)}>
							Cancel
						</Button>
						<Button
							onClick={handleConfirmEditPlaceholder}
							disabled={isUpdatingPlaceholder || !editKey.trim()}
						>
							Save
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<DeleteConfirmDialog
				open={!!placeholderPendingDelete}
				onOpenChange={(open) => {
					if (!open) setPlaceholderPendingDelete(null);
				}}
				onConfirm={handleConfirmDeletePlaceholder}
				title={`Delete "${placeholderPendingDelete?.key ?? ""}"?`}
				description="This removes the placeholder and all of its values. Testcases pinning any of its values will lose that pin."
				isDeleting={isDeletingPlaceholder}
			/>

			<Dialog open={newValueOpen} onOpenChange={setNewValueOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New value</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div>
							<p className="mb-2 text-xs font-medium text-muted-foreground">Name</p>
							<Input
								placeholder="e.g. formal"
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
		</div>
	);
}
