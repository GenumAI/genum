import type { ColumnDef, HeaderContext, SortingState } from "@tanstack/react-table";
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from "@tanstack/react-table";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import SortIcon from "@/components/ui/icons-tsx/SortIcon";
import {
	formatUserActivityDate,
	formatUserCost,
} from "@/pages/dashboard/utils/promptStatsTable";
import { TweenNumber } from "./TweenNumber";

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
	isLoading?: boolean;
}

export function UserActivityTable({ users, isLoading = false }: Props) {
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
			cell: (info) => (
				<TweenNumber
					value={info.getValue() as number}
					className="tabular-nums"
					formatValue={(value) => `${Math.round(value)}`}
				/>
			),
		},
		{
			accessorKey: "total_tokens_sum",
			header: sortableHeader("Total Tokens"),
			cell: (info) => (
				<TweenNumber
					value={info.getValue() as number}
					className="tabular-nums"
					formatValue={(value) => `${Math.round(value)}`}
				/>
			),
		},
		{
			accessorKey: "total_cost",
			header: sortableHeader("Total Cost"),
			cell: (info) => (
				<TweenNumber
					value={info.getValue() as number}
					className="tabular-nums"
					formatValue={(value) => formatUserCost(value)}
				/>
			),
		},
		{
			accessorKey: "first_activity",
			header: sortableHeader("First Used"),
			cell: (info) => (
				<span className="text-foreground">
					{formatUserActivityDate(info.getValue() as string)}
				</span>
			),
		},
		{
			accessorKey: "last_activity",
			header: sortableHeader("Last Used"),
			cell: (info) => (
				<span className="text-foreground">
					{formatUserActivityDate(info.getValue() as string)}
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

	if (isLoading) {
		return (
			<Card className="rounded-lg shadow-sm flex-1 bg-card text-card-foreground">
				<CardHeader className="pb-4">
					<Skeleton className="h-6 w-[140px]" />
				</CardHeader>
				<CardContent className="overflow-auto space-y-2">
					<Skeleton className="h-8 w-full rounded-md" />
					<Skeleton className="h-8 w-full rounded-md" />
					<Skeleton className="h-8 w-full rounded-md" />
					<Skeleton className="h-8 w-full rounded-md" />
					<Skeleton className="h-8 w-full rounded-md" />
				</CardContent>
			</Card>
		);
	}

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
										className="select-none px-4 py-[10px] h-5"
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
	return ({ column }: HeaderContext<User, unknown>) => {
		const sorted = column.getIsSorted();
		const toggleSortingHandler = column.getToggleSortingHandler();
		return (
			<button
				type="button"
				className="flex items-center gap-1 text-[12px] cursor-pointer select-none float-left"
				onClick={toggleSortingHandler}
			>
				<span className="text-muted-foreground">{title}</span>
				<SortIcon isSorted={sorted} />
			</button>
		);
	};
}
