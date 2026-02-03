import { useState } from "react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProjectAPIKeys } from "../hooks/useProjectAPIKeys";
import { useSort } from "../hooks/useSort";
import { CreateAPIKeyDialog } from "./shared/CreateAPIKeyDialog";
import { APIKeyTableRow } from "./shared/APIKeyTableRow";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";
import { compareStrings, compareDates } from "../utils/sorting";
import type { ProjectAPIKey } from "@/api/project";

type SortColumn = "name" | "publicKey" | "author" | "createdAt" | "lastUsed";

export default function ProjectAPIKeys() {
	const {
		apiKeys,
		isLoading,
		isCreating,
		deletingId,
		newKeyResponse,
		createAPIKey,
		deleteAPIKey,
		clearNewKeyResponse,
		refresh,
	} = useProjectAPIKeys();

	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [keyToDelete, setKeyToDelete] = useState<ProjectAPIKey | null>(null);

	const { sortedData: sortedApiKeys, handleSort } = useSort<SortColumn, ProjectAPIKey>({
		data: apiKeys,
		sortFn: (a, b, column) => {
			switch (column) {
				case "name":
					return compareStrings(a.name, b.name);
				case "publicKey":
					return compareStrings(a.publicKey, b.publicKey);
				case "author":
					return compareStrings(a.author?.name || "", b.author?.name || "");
				case "createdAt":
					return compareDates(a.createdAt, b.createdAt);
				case "lastUsed":
					return compareDates(a.lastUsed, b.lastUsed);
				default:
					return 0;
			}
		},
	});

	const handleCreate = async (name: string) => {
		return await createAPIKey(name);
	};

	const handleDone = () => {
		clearNewKeyResponse();
		refresh();
	};

	const openDeleteDialog = (apiKey: ProjectAPIKey) => {
		setKeyToDelete(apiKey);
		setDeleteDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!keyToDelete) return;
		await deleteAPIKey(keyToDelete.id);
		setDeleteDialogOpen(false);
		setKeyToDelete(null);
	};

	return (
		<Card className="rounded-md shadow-none">
			<div className="flex items-center justify-between p-6">
				<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
					Project API Keys
				</CardTitle>

				<CreateAPIKeyDialog
					open={isDialogOpen}
					onOpenChange={setIsDialogOpen}
					onCreate={handleCreate}
					isCreating={isCreating}
					newKeyResponse={newKeyResponse}
					onDone={handleDone}
				/>
			</div>

			<div className="px-6 pb-4">
				<p className="text-sm text-muted-foreground">
					API keys are required to enable external prompt execution and integrations.{" "}
					<a
						href="https://docs.genum.ai/Integration/integration-api"
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-600 underline hover:text-blue-800"
					>
						Learn more
					</a>
				</p>
			</div>

			<CardContent>
				<div className="relative overflow-x-auto rounded-md">
					<Table className="rounded-md overflow-hidden">
						<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626] dark:text-[#fff] h-12 font-medium text-muted-foreground text-center">
							<TableRow>
								<TableHead
									onClick={() => handleSort("name")}
									className="cursor-pointer px-4"
								>
									Name
								</TableHead>
								<TableHead
									onClick={() => handleSort("publicKey")}
									className="cursor-pointer px-4"
								>
									Key
								</TableHead>
								<TableHead
									onClick={() => handleSort("author")}
									className="cursor-pointer px-4"
								>
									Created by
								</TableHead>
								<TableHead
									onClick={() => handleSort("createdAt")}
									className="cursor-pointer px-4"
								>
									Created At
								</TableHead>
								<TableHead
									onClick={() => handleSort("lastUsed")}
									className="cursor-pointer px-4"
								>
									Last Used
								</TableHead>
								<TableHead className="px-4">Actions</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody>
							{isLoading ? (
								<TableRow>
									<td colSpan={6} className="py-8 text-center">
										<div className="flex items-center justify-center gap-2">
											<div className="h-5 w-5 animate-spin rounded-full border-b-2 border-gray-500" />
											Loading...
										</div>
									</td>
								</TableRow>
							) : apiKeys.length === 0 ? (
								<TableRow>
									<td colSpan={6} className="py-8 text-center text-gray-500">
										No API keys found
									</td>
								</TableRow>
							) : (
								sortedApiKeys.map((apiKey) => (
									<APIKeyTableRow
										key={apiKey.id}
										keyData={apiKey}
										onDelete={() => openDeleteDialog(apiKey)}
										isDeleting={deletingId === apiKey.id}
									/>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>

			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleDelete}
				title="Delete API Key"
				description={
					<>
						Are you sure you want to delete the API key{" "}
						<strong>"{keyToDelete?.name}"</strong>? This action cannot be undone.
					</>
				}
				isDeleting={deletingId !== null}
			/>
		</Card>
	);
}
