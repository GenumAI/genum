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
import type { ProjectWithCount, ProjectsTableProps } from "../../utils/types";

export function ProjectsTable({
	projects,
	isLoading,
	currentProjectId,
	deletingId,
	onDelete,
}: ProjectsTableProps) {
	if (isLoading) {
		return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
	}

	if (projects.length === 0) {
		return <div className="p-6 text-sm text-muted-foreground">No projects</div>;
	}

	return (
		<div className="relative overflow-x-auto rounded-md border-0">
			<Table className="rounded-md overflow-hidden">
				<TableHeader className="bg-[#F4F4F5] text-[#71717A] dark:bg-[#262626] dark:text-[#fff] h-12 font-medium text-muted-foreground">
					<TableRow>
						<TableHead className="text-left p-4">Project Name</TableHead>
						<TableHead className="text-left p-4">Description</TableHead>
						<TableHead className="text-left p-4">Members</TableHead>
						<TableHead className="text-left p-4">Prompts</TableHead>
						<TableHead className="w-[140px] text-center p-4">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{projects.map((project: ProjectWithCount) => (
						<TableRow
							key={project.id}
							className={
								currentProjectId === project.id
									? "hover:bg-[#F4F4F5] dark:hover:bg-[#1f1f22]"
									: undefined
							}
						>
							<TableCell className="align-middle">
								<div className="flex items-center gap-2">
									<span>{project.name}</span>
									{project.initial && (
										<span className="rounded bg-[#E4E4E7] px-2 py-0.5 text-[11px] font-medium text-[#3f3f46] dark:bg-[#3f3f46] dark:text-[#fafafa]">
											Default
										</span>
									)}
								</div>
							</TableCell>
							<TableCell
								className="align-middle truncate max-w-xs"
								title={project.description}
							>
								{project.description}
							</TableCell>
							<TableCell className="align-middle text-left">
								{project._count.members}
							</TableCell>
							<TableCell className="align-middle text-left">
								{project._count.Prompts}
							</TableCell>
							<TableCell className="align-middle text-center">
								<Button
									variant="ghost"
									size="sm"
									aria-label="Delete project"
									onClick={() => onDelete(project)}
									disabled={deletingId === project.id || project.initial}
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
