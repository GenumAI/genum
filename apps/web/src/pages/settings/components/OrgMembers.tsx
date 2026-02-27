import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOrgMembers } from "../hooks/useOrgMembers";
import { useOrgInvites } from "../hooks/useOrgInvites";
import { InviteMemberDialog } from "./OrgMembers/InviteMemberDialog";
import { MembersTable } from "./OrgMembers/MembersTable";
import { InvitesTable } from "./OrgMembers/InvitesTable";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";
import type { Member } from "@/api/organization";
import { OrganizationRole, hasOrgAccess } from "@/api/organization";

export default function OrgMembers() {
	const { orgId } = useParams<{ orgId: string }>();
	const { user } = useCurrentUser();
	const {
		members,
		isLoading: loadingMembers,
		isInviting,
		updatingRoleId,
		deletingId,
		inviteMember,
		updateMemberRole,
		deleteMember,
	} = useOrgMembers(orgId);
	const { invites, isLoading: loadingInvites, deletingIds, deleteInvite } = useOrgInvites(orgId);

	const [openInviteDialog, setOpenInviteDialog] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);

	const currentUserEmail = user?.email;
	const currentMember = members.find((m) => m.user.email === currentUserEmail);
	const currentUserRole = currentMember?.role ?? OrganizationRole.READER;
	const canManageMembers = hasOrgAccess(currentUserRole, OrganizationRole.ADMIN);

	const handleInvite = async (email: string, role: OrganizationRole) => {
		return await inviteMember(email, role);
	};

	const handleRoleChange = async (memberId: number, role: OrganizationRole) => {
		await updateMemberRole(memberId, role);
	};

	const handleDeleteClick = (member: Member) => {
		setMemberToDelete(member);
		setDeleteDialogOpen(true);
	};

	const handleConfirmDelete = async () => {
		if (!memberToDelete) return;
		await deleteMember(memberToDelete.id);
		setDeleteDialogOpen(false);
		setMemberToDelete(null);
	};

	return (
		<>
			<Card className="rounded-md shadow-none">
				<CardContent className="p-0">
					<Tabs defaultValue="members">
						<TabsList className="m-6 mb-0">
							<TabsTrigger className="flex-1" value="members">
								Organization Members
							</TabsTrigger>
							<TabsTrigger className="flex-1" value="invites">
								Pending Invites
							</TabsTrigger>
						</TabsList>

						<TabsContent value="members" className="px-6 py-6 pt-0 mt-0">
							<CardHeader className="flex items-center justify-between flex-row py-6 px-0 space-y-0">
								<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
									Organization Members
								</CardTitle>
								{canManageMembers && (
									<div className="flex gap-2">
										<InviteMemberDialog
											open={openInviteDialog}
											onOpenChange={setOpenInviteDialog}
											onInvite={handleInvite}
											isInviting={isInviting}
										/>
									</div>
								)}
							</CardHeader>

							<div className="pb-4">
                            <p className="text-sm text-muted-foreground">
                                Invite team members to collaborate on prompts and projects.{" "}
                                <a
                                    href="https://docs.genum.ai/teamwork"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800 underline"
                                >
                                    Learn more
                                </a>
                            </p>
                        </div>

							<MembersTable
								members={members}
								isLoading={loadingMembers}
								currentUserEmail={currentUserEmail}
								currentUserRole={currentUserRole}
								canManageMembers={canManageMembers}
								updatingRoleId={updatingRoleId}
								deletingId={deletingId}
								onRoleChange={handleRoleChange}
								onDelete={handleDeleteClick}
							/>
						</TabsContent>

						<TabsContent value="invites" className="p-6 pt-0 mt-0">
							<CardHeader className="flex items-start justify-between px-0">
								<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
									Pending Invites
								</CardTitle>
							</CardHeader>

							<InvitesTable
								invites={invites}
								isLoading={loadingInvites}
								deletingIds={deletingIds}
								onDelete={deleteInvite}
							/>
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>

			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleConfirmDelete}
				title="Remove Member"
				description={
					<>
						Are you sure you want to remove{" "}
						<strong>{memberToDelete?.user.name}</strong> (
						{memberToDelete?.user.email}) from the organization? They will also be
						removed from all projects.
					</>
				}
				isDeleting={deletingId !== null}
				confirmText="Remove Member"
			/>
		</>
	);
}
