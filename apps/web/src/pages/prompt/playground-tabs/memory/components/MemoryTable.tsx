import {
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";
import type { ColumnDef, OnChangeFn, SortingState } from "@tanstack/react-table";
import type { Memory } from "@/api/prompt";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { MouseEvent } from "react";
import SortIcon from "../../../../../components/ui/icons-tsx/SortIcon";

interface MemoryTableProps {
	memories: Memory[];
	columns: ColumnDef<Memory, unknown>[];
	sorting: SortingState;
	onSortingChange: OnChangeFn<SortingState>;
	isLoading: boolean;
	onRowClick: (memory: Memory, event: MouseEvent<HTMLTableRowElement>) => void;
}

const getSortTitle = (nextSortingOrder: false | "asc" | "desc") => {
	if (nextSortingOrder === "asc") return "Sort ascending";
	if (nextSortingOrder === "desc") return "Sort descending";
	return "Clear sort";
};

const MemoryTable = ({
	memories,
	columns,
	sorting,
	onSortingChange,
	isLoading,
	onRowClick,
}: MemoryTableProps) => {
	const table = useReactTable<Memory>({
		data: memories,
		columns,
		getCoreRowModel: getCoreRowModel(),
		state: { sorting },
		onSortingChange,
		getSortedRowModel: getSortedRowModel(),
		enableSortingRemoval: true,
	});

	return (
		<div className="relative overflow-hidden rounded-md">
			{isLoading && memories.length === 0 && (
				<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50">
					<div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
				</div>
			)}
			<Table>
				<TableHeader className="bg-muted text-sm font-medium leading-5 text-muted-foreground">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow
							key={headerGroup.id}
							className="[&_th:first-child]:text-left text-left [&_th:last-child]:text-center"
						>
							{headerGroup.headers.map((header) => (
								<TableHead
									key={header.id}
									className={
										header.column.id === "actions"
											? "h-auto px-[14px] py-4 text-center"
											: "h-auto px-[14px] py-4 text-left"
									}
								>
									{header.column.getCanSort() ? (
										<button
											type="button"
											className="flex w-full cursor-pointer select-none items-center gap-2 rounded px-2 py-1 -mx-2 -my-1 transition-colors hover:bg-accent"
											onClick={header.column.getToggleSortingHandler()}
											title={getSortTitle(
												header.column.getNextSortingOrder(),
											)}
										>
											{flexRender(
												header.column.columnDef.header,
												header.getContext(),
											)}
											<SortIcon isSorted={header.column.getIsSorted()} />
										</button>
									) : (
										flexRender(
											header.column.columnDef.header,
											header.getContext(),
										)
									)}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>

				<TableBody>
					{table.getRowModel().rows.length > 0 &&
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								className="cursor-pointer [&_td:first-child]:text-left [&_td:last-child]:text-center transition-colors hover:bg-muted/50"
								onClick={(event) => onRowClick(row.original, event)}
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell
										key={cell.id}
										className={
											cell.column.id === "actions"
												? "text-center"
												: "text-left"
										}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))}
				</TableBody>
			</Table>
		</div>
	);
};

export default MemoryTable;
