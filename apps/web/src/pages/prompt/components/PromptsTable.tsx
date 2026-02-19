import { flexRender, type Table as ReactTable } from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import type { Prompt } from "../utils/types";

type PromptsTableProps = {
	table: ReactTable<Prompt>;
	isLoading: boolean;
	columnsCount: number;
	onRowClick: (prompt: Prompt) => void;
};

export function PromptsTable({
	table,
	isLoading,
	columnsCount,
	onRowClick,
}: PromptsTableProps) {
	return (
		<div className="rounded-md overflow-auto">
			<Table>
				<TableHeader className="bg-[#F4F4F5] text-[#71717A] dark:bg-[#27272A] dark:text-[#fff] text-sm font-medium leading-5 h-[54px]">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow
							key={headerGroup.id}
							className="[&_th:first-child]:text-left [&_th:last-child]:text-right group py-[14px] h-[48px] leading-[16px]"
						>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id} className="h-auto py-[16px] px-[14px]">
									{flexRender(
										header.column.columnDef.header,
										header.getContext(),
									)}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>
					{isLoading ? (
						<TableRow>
							<TableCell colSpan={columnsCount} className="h-24 text-center">
								<Loader2 className="mx-auto h-8 w-8 animate-spin" />
							</TableCell>
						</TableRow>
					) : table.getRowModel().rows.length > 0 ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={row.id}
								className="cursor-pointer [&_td:first-child]:text-left [&_td:last-child]:text-right h-[62px]"
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell
										key={cell.id}
										className="text-center"
										onClick={
											cell.column.id !== "actions" && cell.column.id !== "select"
												? () => onRowClick(row.original)
												: undefined
										}
										style={{
											cursor: cell.column.id === "name" ? "pointer" : undefined,
										}}
									>
										{flexRender(cell.column.columnDef.cell, cell.getContext())}
									</TableCell>
								))}
							</TableRow>
						))
					) : (
						<TableRow className="transition-none">
							<TableCell
								colSpan={columnsCount}
								className="px-0 hover:bg-[#fff] dark:hover:bg-[#212121]"
							>
								<EmptyState title="No results found" description="" />
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
