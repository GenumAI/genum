import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { organizationApi } from "@/api/organization";
import type { NavigateFunction } from "react-router-dom";
import { organizationKeys } from "@/query-keys/organization.keys";
import { authKeys } from "@/query-keys/auth.keys";

export interface Project {
	id: number;
	name: string;
	description: string;
	initial: boolean;
	organizationId: number;
	_count: {
		members: number;
		Prompts: number;
	};
}

interface CreateProjectValues {
	name: string;
	description?: string;
}

function findFallbackProject(projects: Project[], deletedProjectId: number): Project | undefined {
	const initialProject = projects.find((p) => p.initial && p.id !== deletedProjectId);
	if (initialProject) return initialProject;
	return projects.find((p) => p.id !== deletedProjectId);
}

export function useOrgProjects() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [deletingId, setDeletingId] = useState<number | null>(null);

	const query = useQuery({
		queryKey: organizationKeys.projects(),
		queryFn: () => organizationApi.getProjects(),
		refetchOnMount: "always",
	});

	const createMutation = useMutation({
		mutationFn: (values: CreateProjectValues) =>
			organizationApi.createProject({
				name: values.name.trim(),
				description: values.description?.trim() || undefined,
			}),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.projects() });
			queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (projectId: number) => organizationApi.deleteProject(projectId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.projects() });
			queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
		},
	});

	const projects = (query.data?.projects ?? []) as Project[];

	const createProject = async (values: CreateProjectValues): Promise<boolean> => {
		if (!values.name.trim()) return false;
		try {
			await createMutation.mutateAsync(values);
			toast({
				title: "Success",
				description: "Project created",
				duration: 3000,
			});
			return true;
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Project creation failed",
				variant: "destructive",
				duration: 3000,
			});
			return false;
		}
	};

	const deleteProject = async (
		project: Project,
		currentProjectId: number | null,
		orgId: string | undefined,
		navigate: NavigateFunction,
	) => {
		try {
			setDeletingId(project.id);
			const isCurrentProject = currentProjectId !== null && project.id === currentProjectId;
			const currentProjects = (query.data?.projects ?? []) as Project[];
			const targetProject = isCurrentProject
				? findFallbackProject(currentProjects, project.id)
				: undefined;

			await deleteMutation.mutateAsync(project.id);

			toast({
				title: "Deleted",
				description: "Project removed",
				duration: 3000,
			});

			if (isCurrentProject && orgId) {
				if (targetProject && targetProject.organizationId.toString() === orgId) {
					navigate(`/${orgId}/${targetProject.id}/settings/org/projects`);
				} else {
					navigate(`/${orgId}/settings/org/details`);
				}
			}
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Deletion failed",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setDeletingId(null);
		}
	};

	return {
		projects,
		isLoading: query.isLoading,
		isCreating: createMutation.isPending,
		deletingId,
		createProject,
		deleteProject,
		refresh: query.refetch,
	};
}
