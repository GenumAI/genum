import {
	useReactTable,
	getCoreRowModel,
	getSortedRowModel,
	flexRender,
	ColumnDef,
	SortingState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
	Table,
	TableHeader,
	TableRow,
	TableHead,
	TableBody,
	TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react";
import { EmptyState } from "@/pages/info-pages/EmptyState";
import { getOrgId, getProjectId } from "@/api/client";

interface PromptStats {
	prompt_id: number;
	total_requests: number;
	total_tokens_in: number;
	total_tokens_out: number;
	average_response_ms: number;
	total_cost: number;
	error_rate: number;
	last_used: string;
}

interface Props {
	prompts: PromptStats[];
	promptNames: { id: number; name: string }[];
}

export function TablePromptStats({ prompts, promptNames }: Props) {
	const [sorting, setSorting] = useState<SortingState>([]);
	const [showAll, setShowAll] = useState(false);

	const navigate = useNavigate();
	const orgId = getOrgId();
	const projectId = getProjectId();

	const getName = (id: number) => promptNames.find((p) => p.id === id)?.name || `Prompt ${id}`;

	const data = useMemo(() => prompts, [prompts]);

	const columns = useMemo<ColumnDef<PromptStats>[]>(
		() => [
			{
				accessorKey: "prompt_id",
				header: sortableHeader("Prompt Name"),
				cell: ({ row }) => {
					const promptId = row.original.prompt_id;
					const promptName = getName(promptId);
					const isDeleted = !promptNames.find((p) => p.id === promptId);
					if (isDeleted) {
						return <span className="text-foreground">{promptName}</span>;
					}
					const handleClick = (e: React.MouseEvent) => {
						if (!orgId || !projectId) return;
						const base = `/${orgId}/${projectId}/prompt/${promptId}/logs`;
						if (e.metaKey || e.ctrlKey) {
							window.open(base, "_blank");
						} else {
							navigate(base);
						}
					};
					return (
						<span
							className="text-primary cursor-pointer hover:underline focus:underline focus:outline-none"
							onClick={handleClick}
							tabIndex={0}
							onKeyDown={(e) => {
								if (e.key === "Enter" || e.key === " ") handleClick(e as any);
							}}
							role="button"
							aria-label={`Open Logs for ${promptName}`}
						>
							{promptName}
						</span>
					);
				},
			},
			{
				accessorKey: "total_requests",
				header: sortableHeader("Requests"),
			},
			{
				accessorKey: "total_tokens_in",
				header: sortableHeader("Tokens In"),
			},
			{
				accessorKey: "total_tokens_out",
				header: sortableHeader("Tokens Out"),
			},
			{
				accessorKey: "average_response_ms",
				header: sortableHeader("Avg Response (ms)"),
			},
			{
				accessorKey: "total_cost",
				header: sortableHeader("Cost"),
				cell: ({ getValue }) => (
					<span className="tabular-nums text-foreground">
						${(getValue() as number).toFixed(4)}
					</span>
				),
			},
			{
				accessorKey: "error_rate",
				header: sortableHeader("Error Rate"),
				cell: ({ getValue }) => {
					const val = getValue() as number;
					return val > 0 ? (
						<span className="text-destructive dark:text-[#d64646]">
							{val.toFixed(2)}%
						</span>
					) : (
						<span className="text-emerald-600 dark:text-[#2da44a]">
							{val.toFixed(2)}%
						</span>
					);
				},
			},
			{
				accessorKey: "last_used",
				header: sortableHeader("Last Used"),
				cell: ({ getValue }) => (
					<span className="text-foreground">
						{new Date(getValue() as string).toLocaleString()}
					</span>
				),
			},
		],
		[promptNames, orgId, projectId, navigate],
	);

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
						onClick={() => setShowAll(!showAll)}
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
