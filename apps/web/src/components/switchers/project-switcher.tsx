import { ChevronsUpDown, PlusCircle, Settings } from "lucide-react";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/sidebar/sidebar";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/useToast";
import { useQueryClient } from "@tanstack/react-query";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/useCurrentUser";
import { organizationApi } from "@/api/organization";

type Project = {
	id: string;
	name: string;
	role?: string;
};

type ProjectSwitcherProps = {
	projects: Project[];
	orgId: string | undefined | null;
	projectId: string | undefined | null;
	selectedProjectId: string | null;
	onProjectChange: (projectId: string) => void;
};

export function ProjectSwitcher({
	projects,
	selectedProjectId,
	orgId,
	projectId,
	onProjectChange,
}: ProjectSwitcherProps) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);
	const [newProjectName, setNewProjectName] = useState("");
	const [newProjectDescription, setNewProjectDescription] = useState("");
	const [isCreating, setIsCreating] = useState(false);

	const activeProject = selectedProjectId
		? projects.find((project) => project.id === selectedProjectId)
		: projects[0];

	if (!activeProject || projects.length === 0) {
		return null;
	}

	const location = useLocation();
	const navigate = useNavigate();

	const handleProjectChange = (newProjectId: string) => {
		const currentPath = location.pathname;
		const currentSearch = location.search;

		if (currentSearch.includes("testcaseId=")) {
			navigate(`/${orgId}/${newProjectId}/testcases`);
			onProjectChange(newProjectId);
			return;
		}

		if (currentPath.includes("/prompt/")) {
			navigate(`/${orgId}/${newProjectId}/prompts`);
			onProjectChange(newProjectId);
			return;
		}

		const pathSegments = currentPath.split("/").filter(Boolean);
		const currentPage = pathSegments.slice(2).join("/");

		if (currentPage) {
			navigate(`/${orgId}/${newProjectId}/${currentPage}`);
		} else {
			navigate(`/${orgId}/${newProjectId}/dashboard`);
		}

		onProjectChange(newProjectId);
	};

	const handleCreateProject = async () => {
		const name = newProjectName.trim();
		if (!name || isCreating) return;

		setIsCreating(true);

		try {
			const result = await organizationApi.createProject({
				name,
				description: newProjectDescription.trim() || undefined,
			});

			toast({
				title: "Success",
				description: "Project created successfully",
				duration: 3000,
			});

			setIsCreateDialogOpen(false);
			setNewProjectName("");
			setNewProjectDescription("");

			await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });

			const newId = result?.project?.id;
			if (newId) handleProjectChange(String(newId));
		} catch (error) {
			console.error("Error creating project:", error);
			toast({
				title: "Error",
				description: "Failed to create project",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setIsCreating(false);
		}
	};

	const handleAddProjectClick = () => {
		setIsDropdownOpen(false);
		setIsCreateDialogOpen(true);
	};

	const handleDialogClose = () => {
		setIsCreateDialogOpen(false);
		setNewProjectName("");
		setNewProjectDescription("");
		setIsCreating(false);
	};

	return (
		<>
			<SidebarMenu className="group-data-[collapsible=icon]:hidden block w-auto h-[18px]">
				<SidebarMenuItem className="h-[18px]">
					<DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
						<DropdownMenuTrigger asChild>
							<SidebarMenuButton
								size="sm"
								className="dark:text-sidebar-foreground dark:hover:bg-[#18181b] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground p-1 gap-0.5 h-[18px] text-[#3f3f46] hover:bg-[#e4e4e7] [&>svg]:size-3"
							>
								<div className="grid flex-1 text-left text-[12px] leading-tight">
									<span className="truncate font-semibold">
										{activeProject.name}
									</span>
								</div>
								<ChevronsUpDown className="ml-auto w-[12px] h-[11px]" />
							</SidebarMenuButton>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="w-[--radix-dropdown-menu-trigger-width] min-w-[224px] rounded-lg "
							align="start"
							side="bottom"
							sideOffset={4}
						>
							<DropdownMenuLabel className="text-xs text-muted-foreground">
								Projects
							</DropdownMenuLabel>
							<DropdownMenuSeparator />
							{projects.map((project) => {
								return (
									<DropdownMenuItem
										key={project.id}
										onClick={() => handleProjectChange(project.id)}
										className={`gap-2 p-2 h-8 text-[14px] ${project?.id === projectId && "font-bold"}`}
									>
										{project.name}
									</DropdownMenuItem>
								);
							})}
							<DropdownMenuSeparator />
							<DropdownMenuItem
								onClick={handleAddProjectClick}
								className="gap-2 p-2 h-8 text-[14px]"
							>
								<PlusCircle className="h-4 w-4" />
								Create project
							</DropdownMenuItem>
							<DropdownMenuItem
								onClick={() => {
									navigate(`/${orgId}/${projectId}/settings/org/projects`);
								}}
								className="gap-2 p-2 h-8 text-[14px]"
							>
								<Settings className="h-4 w-4" />
								Manage projects
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</SidebarMenuItem>
			</SidebarMenu>

			<Dialog open={isCreateDialogOpen} onOpenChange={handleDialogClose}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create New Project</DialogTitle>
					</DialogHeader>
					<div className="flex flex-col gap-3 py-2">
						<div>
							<Label htmlFor="project-name">Project Name</Label>
							<Input
								id="project-name"
								value={newProjectName}
								onChange={(e) => setNewProjectName(e.target.value)}
								placeholder="Awesome project"
								onKeyDown={(e) => {
									if (e.key === "Enter" && !isCreating) {
										e.preventDefault();
										handleCreateProject();
									}
								}}
							/>
						</div>
						<div>
							<Label className="mt-3" htmlFor="project-description">
								Description
							</Label>
							<Textarea
								id="project-description"
								rows={4}
								value={newProjectDescription}
								onChange={(e) => setNewProjectDescription(e.target.value)}
								placeholder="Enter project description"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={handleDialogClose}
							disabled={isCreating}
						>
							Cancel
						</Button>
						<Button
							onClick={handleCreateProject}
							disabled={!newProjectName.trim() || isCreating}
						>
							{isCreating ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
