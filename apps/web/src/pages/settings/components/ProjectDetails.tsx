import { useState } from "react";
import { Card, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProject } from "../hooks/useProject";
import { EditProjectDialog } from "./dialogs/EditProjectDialog";

export default function ProjectDetails() {
	const { project, isLoading, updateProject } = useProject();
	const [open, setOpen] = useState(false);

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
					<Button variant="outline" size="sm" onClick={() => setOpen(true)}>
						Edit
					</Button>
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
