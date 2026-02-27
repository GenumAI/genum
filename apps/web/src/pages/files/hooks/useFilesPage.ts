import { useCallback, useState } from "react";
import {
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
	type SortingState,
} from "@tanstack/react-table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { filesApi, type FileMetadata } from "@/api/files";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";
import { useFilesTableColumns } from "./useFilesTableColumns";
import { fileKeys } from "@/query-keys/files.keys";

export function useFilesPage() {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [selectedFile, setSelectedFile] = useState<FileMetadata | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const queryClient = useQueryClient();

	const { data: files = [], isLoading, refetch } = useQuery({
		queryKey: fileKeys.all(),
		queryFn: () => filesApi.listFiles(),
	});

	useRefetchOnWorkspaceChange(() => {
		void refetch();
	});

	const handleViewFile = useCallback(async (file: FileMetadata) => {
		try {
			const url = await filesApi.getFileUrl(file.id);
			window.open(url, "_blank");
		} catch (error) {
			console.error("Failed to get file URL:", error);
		}
	}, []);

	const handleDeleteRequest = useCallback((file: FileMetadata) => {
		setSelectedFile(file);
		setDeleteDialogOpen(true);
	}, []);

	const columns = useFilesTableColumns({
		onViewFile: handleViewFile,
		onDeleteFile: handleDeleteRequest,
	});

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

	const handleUpload = async (file: File) => {
		setIsUploading(true);
		try {
			await filesApi.uploadFile(file);
			await queryClient.invalidateQueries({ queryKey: fileKeys.all() });
		} finally {
			setIsUploading(false);
		}
	};

	const handleDelete = async () => {
		if (!selectedFile) return;

		setIsDeleting(true);
		try {
			await filesApi.deleteFile(selectedFile.id);
			await queryClient.invalidateQueries({ queryKey: fileKeys.all() });
			setDeleteDialogOpen(false);
			setSelectedFile(null);
		} catch (error) {
			console.error("Failed to delete file:", error);
		} finally {
			setIsDeleting(false);
		}
	};

	return {
		table,
		columnsCount: columns.length,
		isLoading,
		uploadDialogOpen,
		setUploadDialogOpen,
		deleteDialogOpen,
		setDeleteDialogOpen,
		isUploading,
		isDeleting,
		handleUpload,
		handleDelete,
	};
}
