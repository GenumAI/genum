import { useState } from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useProject } from "../hooks/useProject";
import { useProjectMembers } from "../hooks/useProjectMembers";
import { EditProjectDialog } from "./dialogs/EditProjectDialog";
import { ProjectRole, hasProjectAccess } from "@/api/project";

export default function ProjectDetails() {
	const { user } = useCurrentUser();
	const { project, isLoading, updateProject } = useProject();
	const { members } = useProjectMembers();
	const [open, setOpen] = useState(false);

	const currentMember = members.find((m) => m.user.email === user?.email);
	const projectRole = currentMember?.role ?? ProjectRole.MEMBER;
	const canEditProject = hasProjectAccess(projectRole, ProjectRole.ADMIN);

	if (isLoading || !project) {
		return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
	}

	return (
		<Card className="rounded-md shadow-none">
			<CardContent className="space-y-4 p-6 max-w-[724px]">
				<div className="flex items-start justify-between">
					<CardTitle className="text-[18px] font-medium dark:text-[#fff] text-[#18181B]">
						Project Details
					</CardTitle>
					{canEditProject && (
						<Button variant="outline" size="sm" onClick={() => setOpen(true)}>
							Edit
						</Button>
					)}
				</div>
				<div className="space-y-1.5 ">
					<Label className="mb-1 block text-[#18181B] dark:text-[#FAFAFA]">Name</Label>
					<Input disabled value={project.name} />
				</div>
				<div className="space-y-1.5 ">
					<Label className="mb-1 block text-[#18181B] dark:text-[#FAFAFA]">
						Description
					</Label>
					<Input disabled value={project.description || ""} />
				</div>
			</CardContent>

			<EditProjectDialog
				open={open}
				onOpenChange={setOpen}
				project={project}
				onSuccess={updateProject}
			/>
		</Card>
	);
}
