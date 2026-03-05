import type { ColumnDef, HeaderContext } from "@tanstack/react-table";
import { useReactTable, getCoreRowModel, getSortedRowModel, flexRender } from "@tanstack/react-table";
import type { MouseEvent } from "react";
import { useMemo } from "react";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableHeader,
	TableRow,
	TableHead,
	TableBody,
	TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown } from "lucide-react";
import SortIcon from "@/components/ui/icons-tsx/SortIcon";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { useTablePromptStats } from "@/pages/dashboard/hooks/useTablePromptStats";
import type { PromptStats } from "@/pages/dashboard/hooks/useTestcasesGroupedByPrompt";
import type { PromptName } from "@/types/logs";
import {
	formatPromptCost,
	formatPromptErrorRate,
	formatPromptLastUsed,
} from "@/pages/dashboard/utils/promptStatsTable";
import { TweenNumber } from "./TweenNumber";

interface Props {
	prompts: PromptStats[];
	promptNames: PromptName[];
	isLoading?: boolean;
}

export function TablePromptStats({ prompts, promptNames, isLoading = false }: Props) {
	const {
		sorting,
		setSorting,
		showAll,
		toggleShowAll,
		getPromptName,
		isPromptDeleted,
		openPromptLogs,
	} = useTablePromptStats(promptNames);

	const data = useMemo(() => prompts, [prompts]);

	const columns = useMemo<ColumnDef<PromptStats>[]>(
		() => [
			{
				accessorKey: "prompt_id",
				header: sortableHeader("Prompt Name"),
				cell: ({ row }) => {
					const promptId = row.original.prompt_id;
					const promptName = getPromptName(promptId);
					const isDeleted = isPromptDeleted(promptId);
					if (isDeleted) {
						return <span className="text-foreground">{promptName}</span>;
					}
					const handleClick = (event: MouseEvent) => openPromptLogs(event, promptId);
					return (
						<button
							type="button"
							className="text-primary cursor-pointer hover:underline focus:underline focus:outline-none"
							onClick={handleClick}
							aria-label={`Open Logs for ${promptName}`}
						>
							{promptName}
						</button>
					);
				},
			},
			{
				accessorKey: "total_requests",
				header: sortableHeader("Requests"),
				cell: ({ getValue }) => (
					<TweenNumber
						value={getValue() as number}
						className="tabular-nums text-foreground"
						formatValue={(value) => `${Math.round(value)}`}
					/>
				),
			},
			{
				accessorKey: "total_tokens_in",
				header: sortableHeader("Tokens In"),
				cell: ({ getValue }) => (
					<TweenNumber
						value={getValue() as number}
						className="tabular-nums text-foreground"
						formatValue={(value) => `${Math.round(value)}`}
					/>
				),
			},
			{
				accessorKey: "total_tokens_out",
				header: sortableHeader("Tokens Out"),
				cell: ({ getValue }) => (
					<TweenNumber
						value={getValue() as number}
						className="tabular-nums text-foreground"
						formatValue={(value) => `${Math.round(value)}`}
					/>
				),
			},
			{
				accessorKey: "average_response_ms",
				header: sortableHeader("Avg Response (ms)"),
				cell: ({ getValue }) => (
					<TweenNumber
						value={getValue() as number}
						className="tabular-nums text-foreground"
						formatValue={(value) => `${Math.round(value)}`}
					/>
				),
			},
			{
				accessorKey: "total_cost",
				header: sortableHeader("Cost"),
				cell: ({ getValue }) => (
					<TweenNumber
						value={getValue() as number}
						className="tabular-nums text-foreground"
						formatValue={(value) => formatPromptCost(value)}
					/>
				),
			},
			{
				accessorKey: "error_rate",
				header: sortableHeader("Error Rate"),
				cell: ({ getValue }) => {
					const val = getValue() as number;
					return val > 0 ? (
						<span className="text-destructive dark:text-[#d64646]">
							<TweenNumber value={val} formatValue={(value) => formatPromptErrorRate(value)} />
						</span>
					) : (
						<span className="text-emerald-600 dark:text-[#2da44a]">
							<TweenNumber value={val} formatValue={(value) => formatPromptErrorRate(value)} />
						</span>
					);
				},
			},
			{
				accessorKey: "last_used",
				header: sortableHeader("Last Used"),
				cell: ({ getValue }) => (
					<span className="text-foreground">
						{formatPromptLastUsed(getValue() as string)}
					</span>
				),
			},
		],
		[getPromptName, isPromptDeleted, openPromptLogs],
	);

	// eslint-disable-next-line react-hooks/incompatible-library
	const table = useReactTable({
		data,
		columns,
		state: { sorting },
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	const rowsToShow = showAll ? table.getRowModel().rows : table.getRowModel().rows.slice(0, 5);
	const hasMoreRows = table.getRowModel().rows.length > 5;

	if (isLoading) {
		return (
			<Card className="rounded-lg shadow-sm bg-card text-card-foreground">
				<CardHeader className="flex flex-row justify-between items-center">
					<Skeleton className="h-6 w-[240px]" />
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
		<Card className="rounded-lg shadow-sm bg-card text-card-foreground">
			<CardHeader className="flex flex-row justify-between items-center">
				<CardTitle className="text-foreground">Prompt Financial Statistics</CardTitle>
			</CardHeader>
			<CardContent className="overflow-auto">
				<Table className="overflow-hidden rounded-md">
					<TableHeader className="bg-muted">
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id} className="text-nowrap">
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
					<TableBody>
						{rowsToShow.length > 0 ? (
							rowsToShow.map((row) => (
								<TableRow key={row.id} className="hover:bg-muted/50">
									{row.getVisibleCells().map((cell) => (
										<TableCell
											key={cell.id}
											className="px-4 py-[9px] text-[14px] text-foreground"
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

				{hasMoreRows && (
					<Button
						variant="outline"
						onClick={toggleShowAll}
						className="mt-4 text-[14px] bg-muted hover:bg-muted/80 border-border text-foreground"
					>
						{showAll ? (
							<>
								See less
								<ChevronUp className="ml-1 h-4 w-4" />
							</>
						) : (
							<>
								See all
								<ChevronDown className="ml-1 h-4 w-4" />
							</>
						)}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

function sortableHeader(title: string) {
	return ({ column }: HeaderContext<PromptStats, unknown>) => {
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
