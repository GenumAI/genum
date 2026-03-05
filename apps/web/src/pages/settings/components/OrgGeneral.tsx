import { useState } from "react";
import { useParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useOrganization } from "../hooks/useOrganization";
import { EditOrgDialog } from "./dialogs/EditOrgDialog";
import { OrganizationRole, hasOrgAccess } from "@/api/organization";

export default function OrgGeneral() {
	const { orgId } = useParams<{ orgId: string }>();
	const { user } = useCurrentUser();
	const { organization, isLoading, updateOrganization } = useOrganization();
	const [isOpenEdit, setIsOpenEdit] = useState(false);

	const currentOrg = user?.organizations?.find((o) => o.id.toString() === orgId);
	const orgRole = (currentOrg?.role as OrganizationRole) ?? OrganizationRole.READER;
	const canEditOrg = hasOrgAccess(orgRole, OrganizationRole.ADMIN);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center p-6">
				<div className="h-6 w-6 animate-spin text-gray-500" />
				<span className="ml-2 text-sm text-gray-500">Loading organization data...</span>
			</div>
		);
	}

	if (!organization) {
		return (
			<div className="flex items-center justify-center p-6">
				<div className="text-sm text-muted-foreground">No organization available</div>
			</div>
		);
	}

	return (
		<>
			<Card className="rounded-md shadow-none">
				<CardHeader className="max-w-[724px] flex justify-between items-start flex-row pb-4">
					<CardTitle className="font-medium text-[18px] dark:text-[#fff] leading-[28px]">
						Organization Details
					</CardTitle>
					{canEditOrg && (
						<Button
							variant="outline"
							size="sm"
							className="!mt-0"
							onClick={() => setIsOpenEdit(true)}
						>
							Edit
						</Button>
					)}
				</CardHeader>
				<CardContent className="space-y-4 max-w-[724px]">
					<div className="space-y-1.5">
						<Label
							htmlFor="name"
							className="mb-1 block text-sm text-[#18181B] dark:text-[#FAFAFA]"
						>
							Name
						</Label>
						<Input
							id="name"
							placeholder="Organization Name"
							value={organization.name}
							disabled
						/>
					</div>

					<div className="space-y-1.5">
						<Label
							htmlFor="description"
							className="mb-1 block text-sm text-[#18181B] dark:text-[#FAFAFA]"
						>
							Description
						</Label>
						<Input
							id="description"
							placeholder="Organization Description"
							value={organization.description || ""}
							disabled
						/>
					</div>
				</CardContent>
			</Card>

			<EditOrgDialog
				open={isOpenEdit}
				onOpenChange={setIsOpenEdit}
				organization={organization}
				onSuccess={updateOrganization}
			/>
		</>
	);
}
