import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProjectMembers } from "../hooks/useProjectMembers";
import { AddMemberDialog } from "./ProjectMembers/AddMemberDialog";
import { MembersTable } from "./ProjectMembers/MembersTable";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";
import type { ProjectMember } from "@/api/project";

export default function ProjectMembers() {
	const { user: userData } = useCurrentUser();
	const {
		members,
		availableUsers,
		hasAvailableUsersEndpoint,
		isLoading,
		isAddingMember,
		deletingId,
		// updatingRoleId,
		addMember,
		// updateMemberRole,
		deleteMember,
		fetchAvailableUsers,
	} = useProjectMembers();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [memberToDelete, setMemberToDelete] = useState<ProjectMember | null>(null);

	const handleAdd = async (userId: number, role: string) => {
		return await addMember(userId, role);
	};

	const handleDeleteClick = (member: ProjectMember) => {
		setMemberToDelete(member);
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!memberToDelete) return;
		await deleteMember(memberToDelete);
		setDeleteDialogOpen(false);
		setMemberToDelete(null);
	};

	useEffect(() => {
		if (dialogOpen) {
			fetchAvailableUsers();
		}
	}, [dialogOpen, fetchAvailableUsers]);

	return (
		<Card className="rounded-md shadow-none">
			<CardHeader className="flex items-center justify-between flex-row space-y-0">
				<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
					Project Members
				</CardTitle>
				<div className="flex gap-2">
					<AddMemberDialog
						open={dialogOpen}
						onOpenChange={setDialogOpen}
						onAdd={handleAdd}
						availableUsers={availableUsers}
						hasEndpoint={hasAvailableUsersEndpoint}
						isAdding={isAddingMember}
					/>
				</div>
			</CardHeader>

			<CardContent className="p-6 pt-0">
				<MembersTable
					members={members}
					isLoading={isLoading}
					currentUserEmail={userData?.email}
					// updatingRoleId={updatingRoleId}
					deletingId={deletingId}
					// onRoleChange={updateMemberRole}
					onDelete={handleDeleteClick}
				/>
			</CardContent>

			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleConfirmDelete}
				title="Remove Member"
				description={
					<>
						Are you sure you want to remove <strong>{memberToDelete?.user.name}</strong>{" "}
						({memberToDelete?.user.email}) from this project? This action cannot be
						undone.
					</>
				}
				isDeleting={deletingId !== null}
				confirmText="Remove Member"
			/>
		</Card>
	);
}
