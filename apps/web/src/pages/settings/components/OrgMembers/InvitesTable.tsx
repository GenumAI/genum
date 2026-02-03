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
import { formatFullDate } from "../../utils/formatters";
import type { InvitesTableProps } from "../../utils/types";

export function InvitesTable({ invites, isLoading, deletingIds, onDelete }: InvitesTableProps) {
	if (isLoading) {
		return <p className="text-sm text-muted-foreground">Loading…</p>;
	}

	if (invites.length === 0) {
		return <p className="text-sm text-muted-foreground">No pending invites</p>;
	}

	return (
		<div className="relative overflow-x-auto rounded-md">
			<Table className="rounded-md overflow-hidden">
				<TableHeader className="bg-[#F4F4F5] dark:bg-[#262626] dark:text-[#fff] h-12">
					<TableRow>
						<TableHead className="p-4 text-left">Email</TableHead>
						<TableHead className="p-4 text-left">Invited At</TableHead>
						<TableHead className="p-4 text-center w-[100px]">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{invites.map((invite) => (
						<TableRow key={invite.id}>
							<TableCell>{invite.email}</TableCell>
							<TableCell>{formatFullDate(invite.createdAt)}</TableCell>
							<TableCell className="text-center">
								<Button
									size="icon"
									variant="ghost"
									onClick={() => onDelete(invite)}
									disabled={deletingIds.has(invite.id)}
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
