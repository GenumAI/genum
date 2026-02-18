import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

import { Trash2, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import TestCaseStatus from "@/pages/prompt/playground-tabs/testcases/TestCaseStatus";
import { useMemo } from "react";
import type { Prompt } from "@/pages/prompt/Prompts";
import { Checkbox } from "@/components/ui/checkbox";
import TableSortButton from "@/components/ui/TableSortButton";
import type { TestCase, TestStatus } from "@/types/TestСase";

export const useTestcasesColumns = ({
	prompts,
	selected,
	runningRows,
	setConfirmModalOpen,
	setSelectedTestcase,
	checkboxesDisabled = false,
	hidePromptColumn = false,
	currentTestcaseId,
}: {
	prompts?: Prompt[];
	selected: boolean;
	runningRows: number[];
	setConfirmModalOpen: (open: boolean) => void;
	setSelectedTestcase: (testcase: TestCase) => void;
	checkboxesDisabled: boolean;
	hidePromptColumn?: boolean;
	currentTestcaseId?: number;
}) => {
	const promptNameById = useMemo(
		() => new Map((prompts || []).map((prompt) => [prompt.id, prompt.name])),
		[prompts],
	);

	const selectColumn: ColumnDef<TestCase> = {
		id: "select",
		header: ({ table }) => (
			<Checkbox
				checked={table.getIsAllPageRowsSelected()}
				onCheckedChange={(value) => {
					if (!checkboxesDisabled) {
						table.toggleAllPageRowsSelected(!!value);
					}
				}}
				aria-label="Select all"
				disabled={checkboxesDisabled}
				className={checkboxesDisabled ? "opacity-50 cursor-not-allowed" : ""}
			/>
		),
		cell: ({ row }) => (
			<Checkbox
				checked={row.getIsSelected()}
				onCheckedChange={(value) => {
					if (!checkboxesDisabled) {
						row.toggleSelected(!!value);
					}
				}}
				aria-label="Select row"
				disabled={checkboxesDisabled}
				className={checkboxesDisabled ? "opacity-50 cursor-not-allowed" : ""}
			/>
		),
		enableSorting: false,
		enableHiding: false,
	};

	const promptColumn: ColumnDef<TestCase> = {
		id: "prompt",
		accessorFn: (row) => promptNameById.get(row.promptId) ?? "",
		header: ({ column }) => (
			<div>
				<TableSortButton column={column} headerText="Prompt" />
			</div>
		),
		cell: ({ row }) => {
			const promptName = promptNameById.get(row.original.promptId);
			return promptName ? (
				<div className="flex flex-col text-left">
					<span>{promptName}</span>
				</div>
			) : (
				<span className="text-muted-foreground text-left">Unknown</span>
			);
		},
		enableSorting: true,
	};

	const baseColumns: ColumnDef<TestCase>[] = [
		{
			accessorKey: "name",
			header: ({ column }) => <TableSortButton column={column} headerText="Testcase" />,
			cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
			enableSorting: true,
		},
		...(!hidePromptColumn ? [promptColumn] : []),
		{
			id: "memoryKey",
			accessorFn: (row) => {
				const testcaseWithMemory = row as TestCase & {
					memory?: { key?: string | null } | null;
				};
				return testcaseWithMemory.memory?.key ?? null;
			},
			header: ({ column }) => <TableSortButton column={column} headerText="Memory Key" />,
			cell: ({ row }) => {
				const memoryKey = row.getValue("memoryKey") as string | null;
				return <span className="font-medium">{memoryKey || "-"}</span>;
			},
			enableSorting: true,
		},
		{
			accessorKey: "status",
			header: ({ column }) => <TableSortButton column={column} headerText="Status" />,
			cell: ({ row }) => {
				const statusValue: TestStatus = row.getValue("status");

				const testcaseId = row.original.id;
				const isRowRunning = runningRows.includes(testcaseId);

				return (
					<div className="flex justify-center">
						{isRowRunning ? (
							<Loader2 className="w-4 h-4 animate-spin" />
						) : (
							<TestCaseStatus type={statusValue} />
						)}
					</div>
				);
			},
			enableSorting: true,
		},
		{
			accessorKey: "updatedAt",
			header: ({ column }) => <TableSortButton column={column} headerText="Updated" />,
			cell: ({ row }) => {
				const date = new Date(row.getValue("updatedAt"));
				const formattedDate = date.toLocaleDateString("en-US", {
					year: "numeric",
					month: "short",
					day: "numeric",
				});

				return <span>{formattedDate}</span>;
			},
			enableSorting: true,
		},

		{
			id: "actions",
			header: "Actions",
			cell: ({ row }) => {
				const testcase = row.original;
				const isCurrentTestcase = currentTestcaseId === testcase.id;

				return (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<div className="inline-block">
									<Button
										variant="ghost"
										onClick={() => {
											setConfirmModalOpen(true);
											setSelectedTestcase(row.original);
										}}
										disabled={isCurrentTestcase}
										className={
											isCurrentTestcase ? "opacity-50 cursor-not-allowed" : ""
										}
									>
										<Trash2 className="w-4 h-4" />
									</Button>
								</div>
							</TooltipTrigger>
							{isCurrentTestcase && (
								<TooltipContent>
									<p>Selected testcase can't be deleted</p>
								</TooltipContent>
							)}
						</Tooltip>
					</TooltipProvider>
				);
			},
		},
	];

	const columns = selected ? [selectColumn, ...baseColumns] : baseColumns;

	return columns;
};

export default useTestcasesColumns;
