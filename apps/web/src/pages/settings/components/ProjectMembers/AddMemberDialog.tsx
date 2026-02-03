import { useState, useEffect } from "react";
import { PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectValue,
	SelectItem,
} from "@/components/ui/select";
import type { AddMemberDialogProps } from "../../utils/types";


export function AddMemberDialog({
	open,
	onOpenChange,
	onAdd,
	availableUsers,
	hasEndpoint,
	isAdding,
}: AddMemberDialogProps) {
	const [selectedUserId, setSelectedUserId] = useState<string>("");
	const [selectedRole, setSelectedRole] = useState<string>("MEMBER");

	const handleAdd = async () => {
		if (!selectedUserId || !selectedRole) return;

		const success = await onAdd(parseInt(selectedUserId), selectedRole);
		if (success) {
			setSelectedUserId("");
			setSelectedRole("MEMBER");
			onOpenChange(false);
		}
	};

	const handleCancel = () => {
		setSelectedUserId("");
		setSelectedRole("MEMBER");
		onOpenChange(false);
	};

	useEffect(() => {
		if (!open) {
			setSelectedUserId("");
			setSelectedRole("MEMBER");
		}
	}, [open]);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogTrigger asChild>
				<Button size="default">
					<PlusCircle className="mr-2 h-4 w-4" />
					Add Member
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Add New Member</DialogTitle>
					<DialogDescription>
						{hasEndpoint && availableUsers.length > 0
							? "Select a user and assign them a role in the project."
							: hasEndpoint && availableUsers.length === 0
								? "All organization members are already part of this project."
								: "Enter user details and assign them a role in the project."}
					</DialogDescription>
				</DialogHeader>

				<div className="grid gap-4 py-0">
					{hasEndpoint && availableUsers.length > 0 && (
						<div className="grid gap-2">
							<label htmlFor="user-select" className="text-sm font-medium">
								User
							</label>
							<Select value={selectedUserId} onValueChange={setSelectedUserId}>
								<SelectTrigger>
									<SelectValue placeholder="Select user..." />
								</SelectTrigger>
								<SelectContent>
									{availableUsers.map((user) => (
										<SelectItem key={user.id} value={user.id.toString()}>
											<div className="flex flex-col">
												<span>{user.email}</span>
												<span className="text-xs text-muted-foreground">{user.name}</span>
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{hasEndpoint && availableUsers.length === 0 && (
						<div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
							<p className="text-sm text-gray-800">
								All organization members are already part of this project.
							</p>
						</div>
					)}

					{!hasEndpoint && (
						<div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md">
							<p className="text-sm text-yellow-800">
								User selection is not available. Please contact an administrator to add
								members to this project.
							</p>
						</div>
					)}

					<div className="grid gap-2">
						<label htmlFor="role-select" className="text-sm font-medium">
							Role
						</label>
						<Select value={selectedRole} onValueChange={setSelectedRole}>
							<SelectTrigger>
								<SelectValue placeholder="Select role..." />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="MEMBER">Member</SelectItem>
								<SelectItem value="OWNER">Owner</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button
						onClick={handleAdd}
						disabled={
							!hasEndpoint ||
							availableUsers.length === 0 ||
							!selectedUserId ||
							!selectedRole ||
							isAdding
						}
					>
						{isAdding ? "Adding..." : "Add Member"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
