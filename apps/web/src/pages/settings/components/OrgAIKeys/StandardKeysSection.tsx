import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
	Table,
	TableHeader,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AddAIKeyDialog } from "../dialogs/AddAIKeyDialog";
import { DeleteConfirmDialog } from "../shared/DeleteConfirmDialog";
import type { AIKey, StandardKeysSectionProps } from "../../utils/types";
import { useToast } from "@/hooks/useToast";

export function StandardKeysSection({
	keys,
	isLoading,
	onAddKey,
	onDeleteKey,
}: StandardKeysSectionProps) {
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [keyToDelete, setKeyToDelete] = useState<AIKey | null>(null);
	const [deletingKeyId, setDeletingKeyId] = useState<number | null>(null);
	const { toast } = useToast();

	const openDeleteDialog = (key: AIKey) => {
		setKeyToDelete(key);
		setDeleteDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!keyToDelete) return;

		try {
			setDeletingKeyId(keyToDelete.id);
			await onDeleteKey(keyToDelete.id);
			setDeleteDialogOpen(false);
			setKeyToDelete(null);
		} catch (error) {
			console.error("Error while deleting. Please, try again", error);
			toast({
				title: "Error",
				description: "Error while deleting. Please, try again",
				variant: "destructive",
			});
		} finally {
			setDeletingKeyId(null);
		}
	};

	return (
		<>
			<div className="flex items-center justify-between mb-4">
				<p className="text-sm text-muted-foreground">Add API keys for hosted providers.</p>
				<AddAIKeyDialog onAdd={onAddKey} />
			</div>

			{isLoading ? (
				<div className="p-6 text-sm text-muted-foreground">Loading…</div>
			) : keys.length === 0 ? (
				<div className="p-6 text-sm text-muted-foreground">No keys</div>
			) : (
				<div className="relative overflow-x-auto rounded-md border-0">
					<Table className="rounded-md overflow-hidden">
						<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626] dark:text-[#fff] h-12 font-medium text-muted-foreground">
							<TableRow>
								<TableHead className="text-left p-4">Vendor</TableHead>
								<TableHead className="text-left p-4">API Key</TableHead>
								<TableHead className="text-left p-4">Created At</TableHead>
								<TableHead className="w-[100px] text-center p-4">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{keys.map((k) => (
								<TableRow key={k.id}>
									<TableCell>{k.vendor}</TableCell>
									<TableCell>{k.publicKey}</TableCell>
									<TableCell>{new Date(k.createdAt).toLocaleString()}</TableCell>
									<TableCell className="text-center">
										<Button
											variant="ghost"
											className="size-8"
											onClick={() => openDeleteDialog(k)}
											disabled={deletingKeyId === k.id}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleDelete}
				title="Delete API Key"
				description={
					<>
						Are you sure you want to delete the <strong>{keyToDelete?.vendor}</strong>{" "}
						API key <strong>"{keyToDelete?.publicKey}"</strong>? This action cannot be
						undone.
					</>
				}
				isDeleting={deletingKeyId !== null}
				confirmText="Delete Key"
			/>
		</>
	);
}
