import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	flexRender,
	ColumnDef,
	SortingState,
} from "@tanstack/react-table";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { ChevronsUpDown } from "lucide-react";
import { EmptyState } from "@/pages/info-pages/EmptyState";

interface User {
	user_id: number;
	user_name?: string | null;
	total_requests: number;
	total_tokens_sum: number;
	total_cost: number;
	first_activity: string;
	last_activity: string;
}

interface Props {
	users: User[];
}

export function UserActivityTable({ users }: Props) {
	const [sorting, setSorting] = useState<SortingState>([]);

	const columns: ColumnDef<User>[] = [
		{
			id: "user_name",
			accessorFn: (row) => row.user_name ?? `User ${row.user_id}`,
			header: sortableHeader("User"),
			cell: (info) => <span className="text-foreground">{info.getValue() as string}</span>,
		},
		{
			accessorKey: "total_requests",
			header: sortableHeader("Total Requests"),
			cell: (info) => <span className="tabular-nums">{info.getValue() as number}</span>,
		},
		{
			accessorKey: "total_tokens_sum",
			header: sortableHeader("Total Tokens"),
			cell: (info) => <span className="tabular-nums">{info.getValue() as number}</span>,
		},
		{
			accessorKey: "total_cost",
			header: sortableHeader("Total Cost"),
			cell: (info) => (
				<span className="tabular-nums">${(info.getValue() as number).toFixed(2)}</span>
			),
		},
		{
			accessorKey: "first_activity",
			header: sortableHeader("First Used"),
			cell: (info) => (
				<span className="text-foreground">
					{new Date(info.getValue() as string).toLocaleDateString()}
				</span>
			),
		},
		{
			accessorKey: "last_activity",
			header: sortableHeader("Last Used"),
			cell: (info) => (
				<span className="text-foreground">
					{new Date(info.getValue() as string).toLocaleDateString()}
				</span>
			),
		},
	];

	const table = useReactTable({
		data: users,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<Card className="rounded-lg shadow-sm flex-1 bg-card text-card-foreground">
			<CardHeader className="pb-4">
				<CardTitle className="text-foreground">User Activity</CardTitle>
			</CardHeader>
			<CardContent className="overflow-auto">
				<Table className="overflow-hidden rounded-md">
					<TableHeader className="bg-muted">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="h-5">
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										onClick={
											header.column.getCanSort()
												? header.column.getToggleSortingHandler()
												: undefined
										}
										className="cursor-pointer select-none px-4 py-[10px] h-5"
									>
										<div
											className={`flex items-center gap-1 text-[12px] text-muted-foreground ${
												header.column.id === "user_name"
													? "justify-start text-left"
													: "justify-end text-right"
											}`}
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
								<TableRow key={row.id} className="hover:bg-muted/50">
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className={`px-4 py-[9px] text-[14px] text-foreground ${
												cell.column.id === "user_name"
													? "text-left"
													: "text-right"
											}`}
										>
											{flexRender(
												cell.column.columnDef.cell,
												cell.getContext(),
											)}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow className="hover:bg-transparent">
								<TableCell
									colSpan={columns.length}
									className="text-center p-0 pt-4"
								>
									<EmptyState
										title="No data"
										description="No results found."
										minHeight="200px"
									/>
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}

function sortableHeader(title: string) {
	return ({ column }: { column: any }) => {
		const sorted = column.getIsSorted();
		return (
			<div
				className="flex items-center gap-1 text-[12px] cursor-pointer select-none float-left"
				onClick={column.getToggleSortingHandler()}
			>
				<span className="text-muted-foreground">{title}</span>
				{sorted === "asc" ? (
					<svg
						className="h-3 w-3 text-foreground"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<path d="m6 15 6-6 6 6" />
					</svg>
				) : sorted === "desc" ? (
					<svg
						className="h-3 w-3 text-foreground"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
					>
						<path d="m18 9-6 6-6-6" />
					</svg>
				) : (
					<ChevronsUpDown className="h-3 w-3 text-muted-foreground opacity-60" />
				)}
			</div>
		);
	};
}
