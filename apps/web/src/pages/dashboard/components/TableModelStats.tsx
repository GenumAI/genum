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
import { formatModelCost } from "@/pages/dashboard/utils/promptStatsTable";
import { TweenNumber } from "./TweenNumber";

interface ModelStats {
	model: string;
	vendor: string;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	average_response_ms: number;
	total_cost: number;
}

interface Props {
	models: ModelStats[];
	isLoading?: boolean;
}

export function TableModelStats({ models, isLoading = false }: Props) {
	const [sorting, setSorting] = useState<SortingState>([]);

	const columns: ColumnDef<ModelStats>[] = [
		{
			accessorKey: "model",
			header: sortableHeader("Model"),
			cell: (info) => (
				<span className="font-medium text-foreground">{info.getValue() as string}</span>
			),
		},
		{
			accessorKey: "vendor",
			header: sortableHeader("Vendor"),
			cell: (info) => <span className="text-foreground/90">{info.getValue() as string}</span>,
		},
		{
			accessorKey: "total_requests",
			header: sortableHeader("Requests"),
			cell: (info) => (
				<TweenNumber
					value={info.getValue() as number}
					className="tabular-nums"
					formatValue={(value) => `${Math.round(value)}`}
				/>
			),
		},
		{
			accessorKey: "total_tokens_in",
			header: sortableHeader("Tokens In"),
			cell: (info) => (
				<TweenNumber
					value={info.getValue() as number}
					className="tabular-nums"
					formatValue={(value) => `${Math.round(value)}`}
				/>
			),
		},
		{
			accessorKey: "total_tokens_out",
			header: sortableHeader("Tokens Out"),
			cell: (info) => (
				<TweenNumber
					value={info.getValue() as number}
					className="tabular-nums"
					formatValue={(value) => `${Math.round(value)}`}
				/>
			),
		},
		{
			accessorKey: "average_response_ms",
			header: sortableHeader("Avg Response (ms)"),
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
			header: sortableHeader("Cost"),
			cell: (info) => (
				<TweenNumber
					value={info.getValue() as number}
					className="tabular-nums"
					formatValue={(value) => formatModelCost(value)}
				/>
			),
		},
	];

	const table = useReactTable({
		data: models,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	if (isLoading) {
		return (
			<Card className="border-0 shadow-none flex-1 bg-card text-card-foreground">
				<CardHeader className="p-0 pb-4">
					<Skeleton className="h-6 w-[220px]" />
				</CardHeader>
				<CardContent className="overflow-auto p-0 space-y-2">
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
		<Card className="border-0 shadow-none flex-1 bg-card text-card-foreground">
			<CardHeader className="p-0 pb-4">
				<CardTitle className="text-foreground">Detailed Model Statistics</CardTitle>
			</CardHeader>

			<CardContent className="overflow-auto p-0">
				<Table className="overflow-hidden rounded-md">
					{/* header */}
					<TableHeader className="bg-muted">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="h-5 text-nowrap">
								{headerGroup.headers.map((header) => (
									<TableHead
										key={header.id}
										className="select-none px-4 py-[10px] h-5"
									>
										<div className="flex items-center gap-1 text-[12px] text-muted-foreground">
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

					{/* body */}
					<TableBody>
						{table.getRowModel().rows.length > 0 ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} className="hover:bg-muted/50">
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className="px-4 py-[9px] text-[14px]"
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
	return ({ column }: HeaderContext<ModelStats, unknown>) => {
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
