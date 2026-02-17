import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Eye, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import TableSortButton from "@/components/ui/TableSortButton";
import type { FileMetadata } from "@/api/files";
import FileIcon from "../../../components/ui/icons-tsx/FileIcon";
import { formatFileSize, getFileTypeLabel } from "../utils/fileUtils";

interface UseFilesTableColumnsProps {
	onViewFile: (file: FileMetadata) => Promise<void>;
	onDeleteFile: (file: FileMetadata) => void;
}

export function useFilesTableColumns({
	onViewFile,
	onDeleteFile,
}: UseFilesTableColumnsProps): ColumnDef<FileMetadata>[] {
	return useMemo<ColumnDef<FileMetadata>[]>(
		() => [
			{
				accessorKey: "name",
				header: ({ column }) => <TableSortButton column={column} headerText="Name" />,
				cell: ({ row }) => {
					const file = row.original;
					return (
						<div className="flex items-center gap-3">
							<FileIcon contentType={file.contentType} />
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
					return <span className="text-sm">{getFileTypeLabel(contentType)}</span>;
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
							<Button variant="ghost" size="sm" onClick={() => onViewFile(file)}>
								<Eye className="h-4 w-4" />
							</Button>
							<Button variant="ghost" size="sm" onClick={() => onDeleteFile(file)}>
								<Trash2 className="h-4 w-4" />
							</Button>
						</div>
					);
				},
			},
		],
		[onDeleteFile, onViewFile],
	);
}
