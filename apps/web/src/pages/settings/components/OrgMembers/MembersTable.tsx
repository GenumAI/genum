import {
	Table,
	TableHeader,
	TableHead,
	TableBody,
	TableRow,
	TableCell,
} from "@/components/ui/table";
import type { OrgMembersTableProps } from "../../utils/types";

export function MembersTable({ members, isLoading }: OrgMembersTableProps) {
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
					</TableRow>
				</TableHeader>
				<TableBody>
					{members.map((member) => (
						<TableRow key={member.id}>
							<TableCell>{member.user.email}</TableCell>
							<TableCell>{member.user.name}</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
