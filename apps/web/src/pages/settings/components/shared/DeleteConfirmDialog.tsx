import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import type { DeleteConfirmDialogProps } from "../../utils/types";

export function DeleteConfirmDialog({
	open,
	onOpenChange,
	onConfirm,
	title,
	description,
	isDeleting = false,
	confirmText = "Delete",
	cancelText = "Cancel",
}: DeleteConfirmDialogProps) {
	const handleConfirm = async () => {
		await onConfirm();
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => onOpenChange(false)}
						disabled={isDeleting}
					>
						{cancelText}
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={isDeleting}
						className="bg-red-600 hover:bg-red-700 text-white"
					>
						{isDeleting ? "Deleting..." : confirmText}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
