import * as React from "react";
import { ChevronsUpDown, Loader2, PlusCircle, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/sidebar/sidebar";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProjectSwitcher } from "@/components/switchers/project-switcher";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/useCurrentUser";
import { userApi } from "@/api/user";
import { getOrgId, getProjectId } from "@/api/client";

interface Project {
	id: string;
	name: string;
	logo: React.ComponentType<{
		className?: string | undefined;
	}>;
	role: string;
}

const organizationFormSchema = z.object({
	name: z.string().min(1, { message: "Organization name is required" }),
	description: z.string().optional(),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

interface CreateOrganizationFormProps {
	onClose: () => void;
	onSuccess: (value: number) => void;
}

function CreateOrganizationForm({ onClose, onSuccess }: CreateOrganizationFormProps) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [isSaving, setIsSaving] = useState(false);

	const form = useForm<OrganizationFormValues>({
		resolver: zodResolver(organizationFormSchema as any),
		defaultValues: {
			name: "",
			description: "",
		},
	});

	const onSubmit = async (values: OrganizationFormValues) => {
		const payload = {
			name: values.name.trim(),
			description: values.description?.trim() || "",
		};

		setIsSaving(true);
		try {
			const response = await userApi.createOrganization(payload);

			toast({
				title: "Success",
				description: "Organization created successfully",
				duration: 3000,
			});

			await queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY });
			onSuccess(response.organization.id);
		} catch (error) {
			console.error("Error creating organization:", error);
			toast({
				title: "Error",
				description: "Failed to create organization",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
			<div className="space-y-1">
				<Label htmlFor="create-name">Organization Name</Label>
				<Input id="create-name" {...form.register("name")} placeholder="My Organization" />{" "}
				{form.formState.errors.name && (
					<p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
				)}{" "}
			</div>
			<div className="space-y-1">
				<Label htmlFor="create-description">Description (Optional)</Label>
				<Textarea
					id="create-description"
					{...form.register("description")}
					placeholder="Describe your organization's purpose and goals..."
					rows={3}
					className="resize-none"
				/>{" "}
				{form.formState.errors.description && (
					<p className="text-sm text-red-500">
						{form.formState.errors.description.message}{" "}
					</p>
				)}{" "}
			</div>
			<DialogFooter className="gap-2 pt-4">
				<Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
					Cancel
				</Button>
				<Button type="submit" disabled={isSaving || !form.formState.isValid}>
					{isSaving ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Creating...
						</>
					) : (
						"Create Organization"
					)}{" "}
				</Button>
			</DialogFooter>
		</form>
	);
}

export function TeamSwitcher({
	teams,
	projects,
	selectedProjectId,
	onProjectChange,
}: {
	teams: {
		id?: string;
		name: string;
		logo: React.ElementType;
		plan?: string;
	}[];
	projects?: Project[];
	selectedProjectId?: string | null;
	onProjectChange?: (projectId: string) => void;
}) {
	const navigate = useNavigate();
	const orgId = getOrgId();
	const projectId = getProjectId();
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isDropdownOpen, setIsDropdownOpen] = useState(false);

	const activeOrganization = teams.find((team) => team.id === orgId);

	if (!activeOrganization) {
		return null;
	}

	const handleOrganizationSelect = (organizationId: string | number) => {
		// Update URL with the new team ID and keep the current projectId
		if (organizationId) {
			// todo for new TeamSwitcher design
			// Get the current path segments after orgId/projectId
			// const pathSegments = window.location.pathname.split('/').filter(Boolean)
			// const remainingPath = pathSegments.slice(2).join('/')
			// const newPath = `/${team.id}/${projectId}${remainingPath ? `/${remainingPath}` : ''}`
			navigate(`/${organizationId}`);
		}
	};

	const handleAddOrgClick = () => {
		setIsDropdownOpen(false);
		setIsCreateDialogOpen(true);
	};

	const handleCloseDialog = () => {
		setIsCreateDialogOpen(false);
	};

	const firstLetter = activeOrganization.name
		.match(/[a-zA-Z]/g)
		?.slice(0, 2)
		.join("")
		.toUpperCase();

	return (
		<>
			<SidebarMenu className="group-data-[collapsible=icon]:hidden">
				<SidebarMenuItem>
					<div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
						<div className="flex aspect-square w-[36px] h-[36px] shrink-0 border-2 border-[#f4f4f5] dark:border-[#27272a] items-center justify-center rounded-lg bg-sidebar-primary dark:bg-white dark:text-black text-sidebar-primary-foreground font-semibold text-[14px]">
							{firstLetter}{" "}
						</div>

						<div className="flex flex-col h-[32px] items-start group-data-[collapsible=icon]:hidden">
							<DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
								<DropdownMenuTrigger asChild>
									<SidebarMenuButton
										size="sm"
										className="dark:text-sidebar-foreground dark:hover:bg-[#18181b] data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground p-1 gap-0.5 h-[18px] text-[#3f3f46] hover:bg-[#e4e4e7] [&>svg]:size-3 w-auto"
									>
										<div className="grid text-left text-[12px] leading-tight">
											<span className="truncate font-semibold">
												{activeOrganization.name}
											</span>
										</div>
										<ChevronsUpDown className="ml-auto w-[12px] h-[11px]" />
									</SidebarMenuButton>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
									align="start"
									side="bottom"
									sideOffset={4}
								>
									<DropdownMenuLabel className="text-xs text-muted-foreground">
										Organizations
									</DropdownMenuLabel>
									<DropdownMenuSeparator />{" "}
									{teams.map((team) => (
										<DropdownMenuItem
											key={team.name}
											onClick={() =>
												handleOrganizationSelect(String(team?.id))
											}
											className={`gap-2 p-2 h-8 text-[14px] ${
												team?.id === orgId && "font-bold"
											}`}
										>
											{team.name}{" "}
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={handleAddOrgClick}
										className="gap-2 p-2 h-8 text-[14px]"
									>
										<PlusCircle className="h-4 w-4" />
										Create organization
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
							{projects &&
								projects.length > 0 &&
								selectedProjectId &&
								onProjectChange && (
									<ProjectSwitcher
										projects={projects}
										orgId={orgId}
										projectId={projectId}
										selectedProjectId={selectedProjectId}
										onProjectChange={onProjectChange}
									/>
								)}{" "}
						</div>
					</div>
				</SidebarMenuItem>
			</SidebarMenu>

			<Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
				<DialogContent className="sm:max-w-[500px]">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							Create New Organization
						</DialogTitle>
						<DialogDescription>
							Create a new organization to manage your projects and collaborate with
							your team.
						</DialogDescription>
					</DialogHeader>

					<div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
						<div className="flex items-start gap-3">
							<Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
							<div className="space-y-1">
								<p className="text-sm font-medium text-blue-900 dark:text-blue-100">
									API Keys Required
								</p>
								<p className="text-xs text-blue-700 dark:text-blue-300">
									New organizations need API keys from LLM providers to function.
									You can add them later in Settings after creating the
									organization.
								</p>
							</div>
						</div>
					</div>
					<CreateOrganizationForm
						onClose={handleCloseDialog}
						onSuccess={(organizationId) => {
							handleCloseDialog();
							handleOrganizationSelect(organizationId);
						}}
					/>
				</DialogContent>
			</Dialog>
		</>
	);
}
