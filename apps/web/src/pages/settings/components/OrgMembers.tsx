import { useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useOrgMembers } from "../hooks/useOrgMembers";
import { useOrgInvites } from "../hooks/useOrgInvites";
import { InviteMemberDialog } from "./OrgMembers/InviteMemberDialog";
import { MembersTable } from "./OrgMembers/MembersTable";
import { InvitesTable } from "./OrgMembers/InvitesTable";

export default function OrgMembers() {
	const { orgId } = useParams<{ orgId: string }>();
	const { members, isLoading: loadingMembers, inviteMember, isInviting } = useOrgMembers(orgId);
	const { invites, isLoading: loadingInvites, deletingIds, deleteInvite } = useOrgInvites(orgId);
	const [openInviteDialog, setOpenInviteDialog] = useState(false);

	const handleInvite = async (email: string) => {
		return await inviteMember(email);
	};

	return (
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
							<div className="flex gap-2">
								<InviteMemberDialog
									open={openInviteDialog}
									onOpenChange={setOpenInviteDialog}
									onInvite={handleInvite}
									isInviting={isInviting}
								/>
							</div>
						</CardHeader>

						<div className="pb-4">
							<p className="text-sm text-muted-foreground">
								Invite team members to collaborate on prompts and projects. All
								members have equal access to organization features.{" "}
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

						<MembersTable members={members} isLoading={loadingMembers} />
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
	);
}
