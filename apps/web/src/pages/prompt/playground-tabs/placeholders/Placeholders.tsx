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

	const { data: placeholders = [], isLoading } = usePromptPlaceholders(promptId, isActive);
	const {
		createPlaceholder,
		updatePlaceholder,
		deletePlaceholder,
		isCreatingPlaceholder,
		isUpdatingPlaceholder,
		isDeletingPlaceholder,
	} = usePlaceholderMutations(promptId);

	const [search, setSearch] = useState("");
	const [selectedId, setSelectedId] = useState<number | undefined>(undefined);
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

	return (
		<div className="w-full min-w-0 space-y-6 bg-background px-3 pt-8 text-foreground lg:pr-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="w-full sm:w-auto">
					<SearchInput
						placeholder="Search..."
						className="w-full sm:w-[241px]"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</div>
				<Button className="w-full px-7 sm:w-auto" onClick={() => setCreateOpen(true)}>
					<PlusCircleIcon className="mr-2 h-4 w-4" />
					New placeholder
				</Button>
			</div>

			{!isLoading && placeholders.length === 0 ? (
				<EmptyState
					title="No data"
					description="No placeholders found. Create one to begin."
				/>
			) : (
				<div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
					<PlaceholderList
						placeholders={filteredPlaceholders}
						keysInPromptText={keysInPromptText}
						selectedId={selectedId}
						isLoading={isLoading}
						onSelect={setSelectedId}
						onRequestDelete={setPlaceholderPendingDelete}
						onRequestEdit={handleRequestEditPlaceholder}
					/>
					<div className="min-w-0 rounded-xl border border-border p-4">
						{selectedPlaceholder && promptId ? (
							<PlaceholderValueEditor
								promptId={promptId}
								placeholder={selectedPlaceholder}
							/>
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
								placeholder="e.g. admin_role"
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
								placeholder="e.g. admin_role"
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
		</div>
	);
}
