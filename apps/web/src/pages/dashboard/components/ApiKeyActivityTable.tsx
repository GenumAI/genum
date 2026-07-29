import type { ColumnDef, HeaderContext, SortingState } from "@tanstack/react-table";
import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	flexRender,
} from "@tanstack/react-table";
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
import { formatUserActivityDate, formatUserCost } from "@/pages/dashboard/utils/promptStatsTable";
import { TweenNumber } from "./TweenNumber";

interface ApiKey {
	api_key_id: number;
	api_key_name?: string | null;
	total_requests: number;
	total_tokens_sum: number;
	total_cost: number;
	last_activity: string | null;
}

interface Props {
	apiKeys: ApiKey[];
	isLoading?: boolean;
}

export function ApiKeyActivityTable({ apiKeys, isLoading = false }: Props) {
	const [sorting, setSorting] = useState<SortingState>([]);

	const columns: ColumnDef<ApiKey>[] = [
		{
			id: "api_key_name",
			// a key deleted after it was used still shows up in the logs, but has no name left
			accessorFn: (row) => row.api_key_name ?? `Key #${row.api_key_id} (deleted)`,
			header: sortableHeader("API Key"),
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
			accessorKey: "last_activity",
			header: sortableHeader("Last Used"),
			cell: (info) => {
				const value = info.getValue() as string | null;
				return (
					<span className="text-foreground">
						{value ? formatUserActivityDate(value) : "—"}
					</span>
				);
			},
		},
	];

	const table = useReactTable({
		data: apiKeys,
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
				<CardTitle className="text-foreground">API Key Activity</CardTitle>
			</CardHeader>
			<CardContent className="overflow-auto">
				<Table className="overflow-hidden rounded-md">
					<TableHeader className="bg-muted">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="h-5">
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className={`select-none px-4 py-[10px] h-5 ${
											header.column.id === "api_key_name"
												? "!text-left"
												: "text-center"
										}`}
									>
										<div
											className={`flex items-center gap-1 text-[12px] text-muted-foreground ${
												header.column.id === "api_key_name"
													? "w-full justify-start text-left"
													: "justify-center text-center"
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
												cell.column.id === "api_key_name"
													? "text-left"
													: "text-center"
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
										description="No API key activity in this period."
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
	return ({ column }: HeaderContext<ApiKey, unknown>) => {
		const sorted = column.getIsSorted();
		const toggleSortingHandler = column.getToggleSortingHandler();
		const isNameColumn = column.id === "api_key_name";
		return (
			<button
				type="button"
				className={
					isNameColumn
						? "inline-flex w-full items-center justify-start gap-1 text-left text-[12px] cursor-pointer select-none"
						: "inline-flex items-center justify-center gap-1 text-[12px] cursor-pointer select-none mx-auto"
				}
				onClick={toggleSortingHandler}
			>
				<span className="text-muted-foreground">{title}</span>
				<SortIcon isSorted={sorted} />
			</button>
		);
	};
}
