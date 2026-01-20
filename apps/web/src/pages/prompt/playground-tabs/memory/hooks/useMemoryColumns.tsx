import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Ellipsis, Trash2, Edit } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useState } from "react";

export interface MemoryTypes {
	id: number;
	key: string;
	value: string;
	promptId?: number;
	createdAt?: string;
	updatedAt?: string;
}

const useMemoryColumns = ({
	setConfirmModalOpen,
	setSelectedMemory,
	onEditClick,
}: {
	setConfirmModalOpen: (open: boolean) => void;
	setSelectedMemory: (memory: MemoryTypes) => void;
	onEditClick: (memory: MemoryTypes) => void;
}) => {
	const [openPromptId, setOpenPromptId] = useState<number | null>(null);

	const columns: ColumnDef<MemoryTypes>[] = [
		{
			accessorKey: "key",
			header: "Key",
			enableSorting: true,
			sortingFn: "alphanumeric",
			cell: (info) => {
				return (
					<span className="text-foreground text-[14px] leading-[20px]">
						{info.getValue() as string}
					</span>
				);
			},
		},
		{
			accessorKey: "value",
			header: "Value",
			enableSorting: true,
			sortingFn: "alphanumeric",
			cell: (info) => {
				const value = info.getValue() as string;
				return (
					<span
						className="text-foreground text-[14px] leading-[20px] max-w-md truncate block"
						title={value}
					>
						{value}
					</span>
				);
			},
		},
		{
			accessorKey: "createdAt",
			header: "Created",
			enableSorting: true,
			sortingFn: "datetime",
			cell: ({ row }) => {
				const date = new Date(row.getValue("createdAt"));
				const formattedDate = date.toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				});

				return (
					<div className="text-foreground text-[14px] leading-[20px]">
						<div>{formattedDate}</div>
					</div>
				);
			},
		},
		{
			accessorKey: "updatedAt",
			header: "Updated",
			enableSorting: true,
			sortingFn: "datetime",
			cell: ({ row }) => {
				const date = new Date(row.getValue("updatedAt"));
				const formattedDate = date.toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				});

				return (
					<div className="text-foreground text-[14px] leading-[20px]">
						<div>{formattedDate}</div>
					</div>
				);
			},
		},
		{
			id: "actions",
			header: "Actions",
			enableSorting: false,
			cell: ({ row }) => {
				const memory = row.original;

				return (
					<div className="flex justify-end">
						<Popover
							open={openPromptId === memory.id}
							onOpenChange={(open) => setOpenPromptId(open ? memory.id : null)}
						>
							<PopoverTrigger asChild>
								<Button variant="ghost" size="icon" className="h-7 w-7">
									<Ellipsis className="w-4 h-4" />
								</Button>
							</PopoverTrigger>
							<PopoverContent align="end" className="w-44 p-1">
								<div className="flex flex-col">
									<Button
										variant="ghost"
										className="justify-start"
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											onEditClick(row.original);
											setOpenPromptId(null);
										}}
									>
										<Edit className="w-4 h-4 mr-2" />
										Edit
									</Button>
									<Button
										variant="ghost"
										className="justify-start"
										onClick={(event) => {
											event.preventDefault();
											event.stopPropagation();
											setConfirmModalOpen(true);
											setSelectedMemory(row.original);
											setOpenPromptId(null);
										}}
									>
										<Trash2 className="w-4 h-4 mr-2" />
										Delete
									</Button>
								</div>
							</PopoverContent>
						</Popover>
					</div>
				);
			},
		},
	];

	return columns;
};

export default useMemoryColumns;
