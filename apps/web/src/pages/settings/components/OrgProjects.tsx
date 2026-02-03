import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useOrgProjects } from "../hooks/useOrgProjects";
import { CreateProjectDialog } from "./OrgProjects/CreateProjectDialog";
import { ProjectsTable } from "./OrgProjects/ProjectsTable";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";
import type { Project } from "../hooks/useOrgProjects";
import { getOrgId, getProjectId} from "@/api/client"

export default function OrgProjects() {
	const orgId = getOrgId();
	const projectId = getProjectId();	
	const navigate = useNavigate();

	const { projects, isLoading, isCreating, deletingId, createProject, deleteProject } =
		useOrgProjects();

	const [openCreateDialog, setOpenCreateDialog] = useState(false);
	const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
	const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);

	const currentProjectId = useMemo(() => {
		if (!projectId) return null;
		const n = Number(projectId);
		return Number.isFinite(n) ? n : null;
	}, [projectId]);

	const handleCreate = async (values: { name: string; description?: string }) => {
		return await createProject(values);
	};

	const openDeleteDialog = (project: Project) => {
		setProjectToDelete(project);
		setDeleteDialogOpen(true);
	};

	const handleDelete = async () => {
		if (!projectToDelete) return;
		await deleteProject(projectToDelete, currentProjectId, orgId, navigate);
		setDeleteDialogOpen(false);
		setProjectToDelete(null);
	};

	return (
		<Card className="rounded-md shadow-none">
			<CardHeader className="flex items-center justify-between flex-row">
				<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
					Projects
				</CardTitle>
				<div className="flex gap-2">
					<CreateProjectDialog
						open={openCreateDialog}
						onOpenChange={setOpenCreateDialog}
						onCreate={handleCreate}
						isCreating={isCreating}
					/>
				</div>
			</CardHeader>

			<CardContent className="p-6 pt-0">
				<ProjectsTable
					projects={projects}
					isLoading={isLoading}
					currentProjectId={currentProjectId}
					deletingId={deletingId}
					onDelete={openDeleteDialog}
				/>
			</CardContent>

			<DeleteConfirmDialog
				open={deleteDialogOpen}
				onOpenChange={setDeleteDialogOpen}
				onConfirm={handleDelete}
				title="Delete Project"
				description={
					<>
						Are you sure you want to delete the project{" "}
						<strong>"{projectToDelete?.name}"</strong>? This action cannot be undone and
						will remove all associated data.
					</>
				}
				isDeleting={deletingId !== null}
				confirmText="Delete Project"
			/>
		</Card>
	);
}
