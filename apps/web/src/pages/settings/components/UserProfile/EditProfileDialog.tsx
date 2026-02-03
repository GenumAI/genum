import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import type { EditProfileDialogProps } from "../../utils/types";


export function EditProfileDialog({
	open,
	onOpenChange,
	currentName,
	onSave,
	isUpdating,
}: EditProfileDialogProps) {
	const [name, setName] = useState(currentName);

	const handleSave = async () => {
		const success = await onSave(name);
		if (success) {
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		setName(currentName);
		onOpenChange(false);
	};

	useEffect(() => {
		if (open) {
			setName(currentName);
		}
	}, [open, currentName]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button variant="outline" size="sm" className="h-[32px]">
					Edit
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Edit Profile</DialogTitle>
					<DialogDescription>
						Make changes to your profile here. Click save when you're done.
					</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2">
					<div className="space-y-2">
						<Label
							htmlFor="modal-name"
							className="text-sm text-[#18181B] dark:text-[#FAFAFA]"
						>
							Name
						</Label>
						<Input
							id="modal-name"
							placeholder="Name Surname"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
						<p className="text-sm text-muted-foreground">
							The name associated with this account
						</p>
					</div>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={handleCancel} disabled={isUpdating}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={isUpdating || name === currentName}>
						{isUpdating ? "Saving..." : "Save changes"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
