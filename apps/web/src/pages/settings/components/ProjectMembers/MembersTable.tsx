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
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { ProjectRole } from "@/api/project";
import { CommitAuthorAvatar } from "@/pages/prompt/utils/CommitAuthorAvatar";
import { formatEnumLabel } from "../../utils/formatters";
import type { MembersTableProps } from "../../utils/types";

function OrgRoleBadge() {
	return (
		<Badge className="text-muted-foreground bg-[color-mix(in_oklab,_currentColor_8%,_transparent)] text-xs px-[5px] py-[2px] hover:bg-[color-mix(in_oklab,_currentColor_8%,_transparent)] cursor-default border-0 select-none">
			Organization Admin
		</Badge>
	);
}

export function MembersTable({
	members,
	isLoading,
	currentUserEmail,
	updatingRoleId,
	deletingId,
	onRoleChange,
	onDelete,
}: MembersTableProps) {
	const canManageRoles = Boolean(onRoleChange);
	const canDelete = Boolean(onDelete);
	const showActions = canManageRoles || canDelete;

	if (isLoading) {
		return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
	}

	if (members.length === 0) {
		return <div className="p-6 text-sm text-muted-foreground">No members</div>;
	}

	return (
		<div className="relative overflow-x-auto rounded-md border-0">
			<Table className="rounded-md overflow-hidden">
				<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626] dark:text-[#fff] h-12 font-medium text-muted-foreground">
					<TableRow>
						<TableHead className="text-left p-4">Name</TableHead>
						<TableHead className="text-left p-4">Email</TableHead>
						<TableHead className="text-left p-4">Role</TableHead>
						{showActions && (
							<TableHead className="w-[100px] text-center p-4">Actions</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => {
						const isSelf = member.user.email === currentUserEmail;
						const isOrgPrivileged =
							member.orgRole === "OWNER" || member.orgRole === "ADMIN";
						const canEditRole = canManageRoles && !isSelf && !isOrgPrivileged;

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
										{isOrgPrivileged && <OrgRoleBadge />}
									</div>
								</TableCell>
								<TableCell>{member.user.email}</TableCell>
								<TableCell>
									{canEditRole ? (
										<Select
											value={member.role}
											onValueChange={(value) => onRoleChange?.(member.id, value as ProjectRole)}
											disabled={updatingRoleId === member.id}
										>
											<SelectTrigger className="w-[120px] text-[14px] h-[30px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value={ProjectRole.ADMIN}>Admin</SelectItem>
												<SelectItem value={ProjectRole.MEMBER}>Member</SelectItem>
											</SelectContent>
										</Select>
									) : isOrgPrivileged ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<span className="text-sm text-muted-foreground cursor-default">
													{formatEnumLabel(member.role)}
												</span>
											</TooltipTrigger>
											<TooltipContent>
												Role is managed through organization membership
											</TooltipContent>
										</Tooltip>
									) : (
										<span className="text-sm">{formatEnumLabel(member.role)}</span>
									)}
								</TableCell>
								{showActions && (
									<TableCell className="text-center">
										{canDelete && !isSelf && !isOrgPrivileged && (
											<Button
												variant="ghost"
												onClick={() => onDelete?.(member)}
												disabled={deletingId === member.id}
												size="sm"
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
