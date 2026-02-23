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
import type { OrgMembersTableProps } from "../../utils/types";

const ROLE_LABELS: Record<string, string> = {
	OWNER: "Owner",
	ADMIN: "Admin",
	READER: "Reader",
};

export function MembersTable({
	members,
	isLoading,
	currentUserEmail,
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
						<TableHead className="p-4 text-left">Email</TableHead>
						<TableHead className="p-4 text-left">Name</TableHead>
						<TableHead className="p-4 text-left">Role</TableHead>
						{canManageMembers && (
							<TableHead className="p-4 text-center w-[80px]">Actions</TableHead>
						)}
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => {
						const isSelf = member.user.email === currentUserEmail;
						const isOwner = member.role === "OWNER";
						const canChangeRole = canManageMembers && !isSelf && !isOwner && onRoleChange;
						const canDelete = canManageMembers && !isSelf && !isOwner && onDelete;

						return (
							<TableRow key={member.id}>
								<TableCell>{member.user.email}</TableCell>
								<TableCell>{member.user.name}</TableCell>
								<TableCell>
									{canChangeRole ? (
										<Select
											value={member.role}
											onValueChange={(value) => onRoleChange(member.id, value)}
											disabled={updatingRoleId === member.id}
										>
											<SelectTrigger className="w-[110px] text-[14px] h-[30px]">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="ADMIN">Admin</SelectItem>
												<SelectItem value="READER">Reader</SelectItem>
											</SelectContent>
										</Select>
									) : (
										<Badge variant="secondary" className="font-normal">
											{ROLE_LABELS[member.role] ?? member.role}
										</Badge>
									)}
								</TableCell>
								{canManageMembers && (
									<TableCell className="text-center">
										<Button
											size="icon"
											variant="ghost"
											onClick={() => canDelete && onDelete(member)}
											disabled={!canDelete || deletingId === member.id}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
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
