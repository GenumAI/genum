import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableHead, TableBody, TableRow } from "@/components/ui/table";
import { useOrgAPIKeys, type OrgKey } from "../hooks/useOrgAPIKeys";
import { useSort } from "../hooks/useSort";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";
import { APIKeyTableRow } from "./shared/APIKeyTableRow";
import { compareStrings, compareDates } from "../utils/sorting";

type SortColumn = "projectName" | "name" | "publicKey" | "author" | "createdAt" | "lastUsed";

export default function OrgAPIKeys() {
	const { keys, isLoading, isDeleting, deleteKey } = useOrgAPIKeys();
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [keyToDelete, setKeyToDelete] = useState<OrgKey | null>(null);

	const { sortedData: sortedKeys, handleSort } = useSort<SortColumn, OrgKey>({
		data: keys,
		sortFn: (a, b, column) => {
			switch (column) {
				case "projectName":
					return compareStrings(a.project.name, b.project.name);
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

	const handleDeleteClick = (key: OrgKey) => {
		setKeyToDelete(key);
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!keyToDelete) return;
		try {
			await deleteKey(keyToDelete);
			setDeleteDialogOpen(false);
			setKeyToDelete(null);
		} catch (error) {}
	};

	return (
		<Card className="rounded-md shadow-none">
			<CardHeader className="flex items-center justify-between flex-row">
				<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
					Organization API Keys
				</CardTitle>
			</CardHeader>

			<div className="px-6 pb-4">
				<p className="text-sm text-muted-foreground">
					API keys are required to enable external prompt execution and integrations.{" "}
					<a
						href="https://docs.genum.ai/Integration/integration-api"
						target="_blank"
						rel="noopener noreferrer"
						className="text-blue-600 hover:text-blue-800 underline"
					>
						Learn more
					</a>
				</p>
			</div>

			<CardContent className="p-6 pt-0">
				<div className="relative overflow-x-auto rounded-md border-0">
					<Table className="rounded-md overflow-hidden">
						<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626] dark:text-[#fff] h-12 font-medium text-muted-foreground text-center">
							<TableRow>
								<TableHead
									className="cursor-pointer px-4"
									onClick={() => handleSort("projectName")}
								>
									Project Name
								</TableHead>
								<TableHead
									className="cursor-pointer px-4"
									onClick={() => handleSort("name")}
								>
									Key Name
								</TableHead>
								<TableHead
									className="cursor-pointer px-4"
									onClick={() => handleSort("publicKey")}
								>
									Key
								</TableHead>
								<TableHead
									className="cursor-pointer px-4"
									onClick={() => handleSort("author")}
								>
									Created by
								</TableHead>
								<TableHead
									className="cursor-pointer px-4"
									onClick={() => handleSort("createdAt")}
								>
									Created At
								</TableHead>
								<TableHead
									className="cursor-pointer px-4"
									onClick={() => handleSort("lastUsed")}
								>
									Last Used
								</TableHead>
								<TableHead className="px-4">Actions</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<td
										colSpan={7}
										className="py-8 text-center text-sm text-muted-foreground"
									>
										<div className="flex items-center justify-center gap-2">
											<div className="h-5 w-5 animate-spin rounded-full border-b-2 border-gray-500" />
											Loading…
										</div>
									</td>
								</TableRow>
							) : keys.length === 0 ? (
								<TableRow>
									<td
										colSpan={7}
										className="py-8 text-center text-sm text-muted-foreground"
									>
										No keys
									</td>
								</TableRow>
							) : (
								sortedKeys.map((key) => (
									<APIKeyTableRow
										key={key.id}
										keyData={key}
										onDelete={() => handleDeleteClick(key)}
										showProject={true}
										isDeleting={isDeleting}
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
				onConfirm={handleConfirmDelete}
				title="Delete API Key"
				description={
					<>
						Are you sure you want to delete the API key{" "}
						<strong>"{keyToDelete?.name}"</strong> from project{" "}
						<strong>{keyToDelete?.project.name}</strong>? This action cannot be undone.
					</>
				}
				isDeleting={isDeleting}
				confirmText="Delete Key"
			/>
		</Card>
	);
}
