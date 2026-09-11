import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

import { Trash2, Loader2 } from "lucide-react";
import { Warning, Wrench } from "@phosphor-icons/react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import TestCaseStatus from "@/pages/prompt/playground-tabs/testcases/TestCaseStatus";
import { useMemo } from "react";
import type { Prompt } from "@/pages/prompt/utils/types";
import { Checkbox } from "@/components/ui/checkbox";
import TableSortButton from "@/components/ui/TableSortButton";
import type { TestCase, TestStatus } from "@/types/TestСase";

/**
 * The recorded session did not run every turn the same way.
 *
 * A pin takes turn 1's placeholder selection and tool subset for the whole testcase --
 * they are held stable per session by the app that produced the recording, so a later turn
 * disagreeing means that assumption did not hold here. The pin is then only part of the
 * truth, and a replay silently differs from the recording on turns the author cannot see.
 * Saying so on the row is the whole remedy: which turn's inputs are right is a judgement
 * only the author can make.
 */
const SelectionDriftMark = () => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<span className="text-amber-600 dark:text-amber-400">
					<Warning size={12} />
				</span>
			</TooltipTrigger>
			<TooltipContent className="max-w-xs">
				<p>
					A later turn of the recorded session ran with different placeholder values or a
					different set of tools. This testcase pins the first turn's, so a run may differ
					from the recording on the later turns.
				</p>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

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
			cell: ({ row }) => {
				const steps = row.original.expectedSteps;
				const stepCount = Array.isArray(steps) ? steps.length : 0;

				// A text testcase keeps the bare span it has always had. Wrapping every row
				// in a flex container to serve the few that carry a marker would change the
				// box every name in the table sits in.
				if (stepCount === 0) {
					return <span className="font-medium">{row.getValue("name")}</span>;
				}

				return (
					<span className="flex items-center gap-2">
						<span className="font-medium">{row.getValue("name")}</span>
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<span className="flex items-center gap-1 text-xs text-muted-foreground">
										<Wrench size={12} />
										{stepCount}
									</span>
								</TooltipTrigger>
								<TooltipContent>
									<p>
										Asserts a recorded trajectory of {stepCount}{" "}
										{stepCount === 1 ? "step" : "steps"}
									</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						{row.original.pinnedSelectionDrift ? <SelectionDriftMark /> : null}
					</span>
				);
			},
			enableSorting: true,
		},
		...(!hidePromptColumn ? [promptColumn] : []),
		{
			id: "placeholders",
			// `placeholderValues` is `undefined` when the caller's list endpoint didn't
			// include the relation, and `[]` when it did and the testcase pins nothing.
			// Those are different facts -- "we don't know" vs "we know it's empty" -- and
			// collapsing them into the same "-" would silently misreport a testcase that
			// actually pins values as unpinned on any surface that doesn't opt in.
			accessorFn: (row) => {
				if (row.placeholderValues === undefined) return null;
				return row.placeholderValues
					.map(
						(pin) =>
							`${pin.placeholderValue.placeholder.key}: ${pin.placeholderValue.name}`,
					)
					.join(" · ");
			},
			header: ({ column }) => <TableSortButton column={column} headerText="Placeholders" />,
			cell: ({ row }) => {
				const placeholders = row.getValue("placeholders") as string | null;
				if (placeholders === null) {
					return <span className="text-muted-foreground">—</span>;
				}
				return <span className="font-medium">{placeholders || "-"}</span>;
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
