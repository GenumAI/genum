import { useEffect, useMemo, useState } from "react";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogTitle,
	DialogDescription,
	DialogContent,
	DialogHeader,
	DialogFooter,
} from "@/components/ui/dialog";
import { getPromptTestcasesCount } from "../utils/promptCounters";
import type { DeletePromptModalState } from "../utils/types";

type DeletePromptDialogProps = {
	state: DeletePromptModalState;
	isDeleting: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirmDelete: (promptId: number) => Promise<void>;
};

export function DeletePromptDialog({
	state,
	isDeleting,
	onOpenChange,
	onConfirmDelete,
}: DeletePromptDialogProps) {
	const [confirmInput, setConfirmInput] = useState("");

	useEffect(() => {
		if (!state.open) {
			setConfirmInput("");
		}
	}, [state.open]);

	const isInvalid = useMemo(
		() => confirmInput !== "" && confirmInput !== state.prompt?.name,
		[confirmInput, state.prompt?.name],
	);

	const handleDelete = async () => {
		if (confirmInput !== state.prompt?.name || !state.prompt?.id) return;
		await onConfirmDelete(state.prompt.id);
	};

	return (
		<Dialog open={state.open} onOpenChange={onOpenChange}>
			<VisuallyHidden>
				<DialogTitle>DialogTitle</DialogTitle>
				<DialogDescription>DialogDescription</DialogDescription>
			</VisuallyHidden>
			<DialogContent>
				<DialogHeader className="font-sans text-lg font-semibold leading-normal text-[color:#18181B] dark:text-[#f4f4f4]">
					To delete prompt "{state.prompt?.name}" type prompt title.
				</DialogHeader>
				<p className="text-sm text-muted-foreground dark:text-[#f4f4f4]">
					This prompt includes
					<span className="font-bold"> {getPromptTestcasesCount(state.prompt)} testcases</span>,
					<span className="font-bold"> {state.prompt?._count?.memories || 0} memories</span>.
					 This action cannot be undone.
					<span className="text-destructive dark:text-[#D64646]"> All data will be lost.</span>
				</p>
				<Input
					placeholder="Prompt title"
					value={confirmInput}
					onChange={(e) => setConfirmInput(e.target.value)}
				/>
				{isInvalid && <p className="text-sm text-destructive">Prompt title invalid.</p>}
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={confirmInput !== state.prompt?.name || isDeleting}
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
