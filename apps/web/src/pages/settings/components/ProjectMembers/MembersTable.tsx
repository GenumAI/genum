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
import type { MembersTableProps } from "../../utils/types";


export function MembersTable({
	members,
	isLoading,
	currentUserEmail,
	updatingRoleId,
	deletingId,
	onRoleChange,
	onDelete,
}: MembersTableProps) {
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
						<TableHead className="text-left p-4">User Email</TableHead>
						<TableHead className="text-left p-4">User Name</TableHead>
						<TableHead className="text-left p-4">Role</TableHead>
						<TableHead className="w-[100px] text-center p-4">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => (
						<TableRow key={member.id}>
							<TableCell>{member.user.email}</TableCell>
							<TableCell>{member.user.name}</TableCell>
							<TableCell>
								<Select
									value={member.role}
									onValueChange={(value) => onRoleChange?.(member.id, value)}
									disabled={!onRoleChange || updatingRoleId === member.id}
								>
									<SelectTrigger className="w-[120px] text-[14px] h-[30px]">
										<SelectValue placeholder={member.role} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="OWNER">Owner</SelectItem>
										<SelectItem value="MEMBER">Member</SelectItem>
									</SelectContent>
								</Select>
							</TableCell>
							<TableCell className="text-center">
								<Button
									variant="ghost"
									onClick={() => onDelete(member)}
									disabled={
										deletingId === member.id || currentUserEmail === member.user.email
									}
									size="sm"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
