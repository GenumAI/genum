import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import type { TestCase } from "@/types/TestСase";

type TestcasesTableProps = {
	table: TanstackTable<TestCase>;
	onRowClick: (testcase: TestCase) => void;
};

export default function TestcasesTable({ table, onRowClick }: TestcasesTableProps) {
	const columns = table.getAllColumns();

	return (
		<div className="rounded-md overflow-hidden">
			<Table>
				<TableHeader className="bg-[#F4F4F5] text-[#71717A] dark:bg-[#262626] dark:text-[#fff] text-sm font-medium leading-5 h-[54px]">
					{table.getHeaderGroups().map((headerGroup) => (
						<TableRow
							key={headerGroup.id}
							className="[&_th:first-child]:text-left [&_th:last-child]:text-right"
						>
							{headerGroup.headers.map((header) => (
								<TableHead key={header.id} className="h-auto py-[16px] px-[14px]">
									<div
										className={
											header.column.id === "name" ||
											header.column.id === "prompt"
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
					{table.getRowModel().rows.length > 0 ? (
						table.getRowModel().rows.map((row) => (
							<TableRow
								key={String(row.original.id)}
								className="cursor-pointer [&_td:first-child]:text-left [&_td:last-child]:text-right"
							>
								{row.getVisibleCells().map((cell) => (
									<TableCell
										key={`${row.original.id}-${cell.column.id}`}
										className="text-left"
										onClick={
											cell.column.id !== "actions" &&
											cell.column.id !== "select"
												? () => onRowClick(row.original)
												: undefined
										}
									>
										<div
											className={
												cell.column.id === "name" ||
												cell.column.id === "prompt"
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
									title="No results found"
									description="Make your first testcase in Playground"
								/>
							</TableCell>
						</TableRow>
					)}
				</TableBody>
			</Table>
		</div>
	);
}
