import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableHeader,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectValue,
	SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { OrganizationRole, hasOrgAccess } from "@/api/organization";
import { CommitAuthorAvatar } from "@/pages/prompt/utils/CommitAuthorAvatar";
import { formatEnumLabel } from "../../utils/formatters";
import type { OrgMembersTableProps } from "../../utils/types";

export function MembersTable({
	members,
	isLoading,
	currentUserEmail,
	currentUserRole,
	canManageMembers,
	updatingRoleId,
	deletingId,
	onRoleChange,
	onDelete,
}: OrgMembersTableProps) {
	if (isLoading) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}

	if (members.length === 0) {
		return <p className="text-sm text-muted-foreground">No members</p>;
	}

	return (
		<div className="relative overflow-x-auto rounded-md border-0">
			<Table className="rounded-md overflow-hidden">
				<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626] dark:text-[#fff] h-12">
					<TableRow>
						<TableHead className="p-4 text-left">Name</TableHead>
						<TableHead className="p-4 text-left">Email</TableHead>
						<TableHead className="p-4 text-left">Role</TableHead>
						{canManageMembers && (
							<TableHead className="p-4 text-center w-[80px]">Actions</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => {
						const isSelf = member.user.email === currentUserEmail;
						const isOwner = hasOrgAccess(member.role, OrganizationRole.OWNER);
						const currentUserIsOwner = currentUserRole != null && hasOrgAccess(currentUserRole, OrganizationRole.OWNER);
						// Only owners can change another owner's role; admins can change admin/reader only
						const canChangeRole =
							canManageMembers &&
							!isSelf &&
							onRoleChange &&
							(!isOwner || currentUserIsOwner);
						const canDeleteMember = canManageMembers && !isSelf && !isOwner && onDelete;

						return (
							<TableRow key={member.id}>
								<TableCell>
									<div className="flex items-center gap-2">
										<CommitAuthorAvatar
											author={{ name: member.user.name, picture: member.user.picture }}
											size="h-7 w-7"
											textSize="text-xs leading-none"
											rounded="rounded-lg"
										/>
										<span>{member.user.name}</span>
										{isSelf && (
											<Badge className="text-[#008635] bg-[color-mix(in_oklab,_#04b84c_15%,_transparent)] text-xs px-[5px] py-[2px] hover:bg-[color-mix(in_oklab,_#04b84c_15%,_transparent)]">
												You
											</Badge>
										)}
									</div>
								</TableCell>
								<TableCell>{member.user.email}</TableCell>
								<TableCell>
									{canChangeRole ? (
										<Select
											key={`role-${member.id}`}
											value={member.role}
											onValueChange={(value) => onRoleChange?.(member.id, value as OrganizationRole)}
											disabled={updatingRoleId === member.id}
										>
											<SelectTrigger className="w-[110px] text-[14px] h-[30px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{isOwner ? (
													<>
														<SelectItem value={OrganizationRole.OWNER} disabled>
															Owner
														</SelectItem>
														<SelectItem value={OrganizationRole.ADMIN}>Admin</SelectItem>
														<SelectItem value={OrganizationRole.READER}>Reader</SelectItem>
													</>
												) : (
													<>
														<SelectItem value={OrganizationRole.ADMIN}>Admin</SelectItem>
														<SelectItem value={OrganizationRole.READER}>Reader</SelectItem>
													</>
												)}
											</SelectContent>
										</Select>
									) : (
										<span className="text-sm">{formatEnumLabel(member.role)}</span>
									)}
								</TableCell>
								{canManageMembers && (
									<TableCell className="text-center">
										{canDeleteMember && (
											<Button
												size="icon"
												variant="ghost"
												onClick={() => onDelete?.(member)}
												disabled={deletingId === member.id}
											>
												<Trash2 className="h-4 w-4" />
											</Button>
										)}
									</TableCell>
								)}
							</TableRow>
						);
					})}
				</TableBody>
			</Table>
		</div>
	);
}
