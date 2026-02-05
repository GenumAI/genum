import { useState, useMemo } from "react";
import {
	flexRender,
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	type ColumnDef,
} from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Eye, File, Image as ImageIcon } from "lucide-react";
import { filesApi, type FileMetadata } from "@/api/files";
import FileUploadDialog from "@/components/dialogs/FileUploadDialog";
import DeleteConfirmDialog from "@/components/dialogs/DeleteConfirmDialog";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import TableSortButton from "@/components/ui/TableSortButton";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";

const formatFileSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const getFileIcon = (contentType: string) => {
	if (contentType.startsWith("image/")) {
		return <ImageIcon className="h-5 w-5 text-blue-500" />;
	}
	if (contentType === "application/pdf") {
		return <File className="h-5 w-5 text-red-500" />;
	}
	return <File className="h-5 w-5 text-gray-500" />;
};

export default function FilesPage() {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const queryClient = useQueryClient();

	// Fetch files
	const {
		data: files = [],
		isLoading,
		refetch,
	} = useQuery({
		queryKey: ["files"],
		queryFn: () => filesApi.listFiles(),
	});

	useRefetchOnWorkspaceChange(() => {
		refetch();
	});

	// Define columns
	const columns = useMemo<ColumnDef<FileMetadata>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => <TableSortButton column={column} headerText="Name" />,
				cell: ({ row }) => {
					const file = row.original;
					return (
						<div className="flex items-center gap-3">
							{getFileIcon(file.contentType)}
							<span className="font-medium">{file.name}</span>
						</div>
					);
				},
				enableSorting: true,
			},
			{
				accessorKey: "contentType",
				header: ({ column }) => <TableSortButton column={column} headerText="Type" />,
				cell: ({ row }) => {
					const contentType = row.getValue("contentType") as string;
					if (contentType.startsWith("image/")) {
						return <span className="text-sm">Image</span>;
					}
					if (contentType === "application/pdf") {
						return <span className="text-sm">PDF</span>;
					}
					return <span className="text-sm">{contentType}</span>;
				},
				enableSorting: true,
			},
			{
				accessorKey: "size",
				header: ({ column }) => <TableSortButton column={column} headerText="Size" />,
				cell: ({ row }) => {
					const size = row.getValue("size") as number;
					return <span className="text-sm">{formatFileSize(size)}</span>;
				},
				enableSorting: true,
			},
			{
				accessorKey: "createdAt",
				header: ({ column }) => <TableSortButton column={column} headerText="Uploaded" />,
				cell: ({ row }) => {
					const date = new Date(row.getValue("createdAt"));
					return (
						<span className="text-sm">
							{formatDistanceToNow(date, { addSuffix: true })}
						</span>
					);
				},
				enableSorting: true,
			},
			{
				id: "actions",
				header: "Actions",
				cell: ({ row }) => {
					const file = row.original;
					return (
						<div className="flex items-center gap-2 justify-end">
							<Button
								variant="ghost"
								size="sm"
								onClick={async () => {
									try {
										const url = await filesApi.getFileUrl(file.id);
										window.open(url, "_blank");
									} catch (error) {
										console.error("Failed to get file URL:", error);
									}
								}}
							>
								<Eye className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setSelectedFile(file);
									setDeleteDialogOpen(true);
								}}
							>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					);
				},
			},
		],
		[],
	);

	// Setup table
	const table = useReactTable({
		data: files,
		columns,
		getCoreRowModel: getCoreRowModel(),
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
	});

	// Handle file upload
	const handleUpload = async (file: File) => {
		setIsUploading(true);
		try {
			await filesApi.uploadFile(file);
			await queryClient.invalidateQueries({ queryKey: ["files"] });
		} finally {
			setIsUploading(false);
		}
	};

	// Handle file deletion
	const handleDelete = async () => {
		if (!selectedFile) return;

		setIsDeleting(true);
		try {
			await filesApi.deleteFile(selectedFile.id);
			await queryClient.invalidateQueries({ queryKey: ["files"] });
			setDeleteDialogOpen(false);
			setSelectedFile(null);
		} catch (error) {
			console.error("Failed to delete file:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	return (
		<>
			<div className="space-y-6 max-w-[1232px] 2xl-plus:max-w-[70%] 2xl-plus:min-w-[1232px] 2xl-plus:w-[70%] ml-3 mr-6 w-full pt-6">
				<div className="flex justify-end">
					<Button onClick={() => setUploadDialogOpen(true)}>
						<Plus className="h-4 w-4 mr-2" />
						Add File
					</Button>
				</div>

				<div className="rounded-md overflow-hidden">
					<Table>
						<TableHeader className="bg-muted text-muted-foreground text-sm font-medium leading-5 h-[54px]">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow
									key={headerGroup.id}
									className="[&_th:first-child]:text-left [&_th:last-child]:text-right"
								>
									{headerGroup.headers.map((header) => (
										<TableHead
											key={header.id}
											className="h-auto py-[16px] px-[14px] whitespace-nowrap"
										>
											<div
												className={
													header.column.id === "name"
														? "w-full text-left"
														: "flex items-center justify-center w-full"
												}
											>
												{flexRender(
													header.column.columnDef.header,
													header.getContext(),
												)}
											</div>
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell
										colSpan={columns.length}
										className="text-center py-8"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : table.getRowModel().rows.length > 0 ? (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										className="[&_td:first-child]:text-left [&_td:last-child]:text-right"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="text-left">
												<div
													className={
														cell.column.id === "name"
															? "w-full text-left"
															: "flex items-center justify-center w-full"
													}
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</div>
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<TableRow className="transition-none border-0 hover:bg-transparent">
									<TableCell
										colSpan={columns.length}
										className="px-0 border-0 hover:bg-transparent"
									>
										<EmptyState
											title="No files found"
											description="Upload your first file to get started"
										/>
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{/* Upload Dialog */}
			<FileUploadDialog
				open={uploadDialogOpen}
				setOpen={setUploadDialogOpen}
				onUpload={handleUpload}
				loading={isUploading}
			/>

			{/* Delete Confirmation Dialog */}
			<DeleteConfirmDialog
				open={deleteDialogOpen}
				setOpen={setDeleteDialogOpen}
				confirmationHandler={handleDelete}
				loading={isDeleting}
			/>
		</>
	);
}
