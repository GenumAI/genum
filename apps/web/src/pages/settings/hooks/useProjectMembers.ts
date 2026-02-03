import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { projectApi } from "@/api/project";
import { organizationApi } from "@/api/organization/organization.api";
import type { ProjectMember } from "@/api/project";
import type { User } from "../utils/types";

export function useProjectMembers() {
	const { toast } = useToast();
	const [members, setMembers] = useState<ProjectMember[]>([]);
	const [availableUsers, setAvailableUsers] = useState<User[]>([]);
	const [hasAvailableUsersEndpoint, setHasAvailableUsersEndpoint] = useState(true);
	const [isLoading, setIsLoading] = useState(false);
	const [isAddingMember, setIsAddingMember] = useState(false);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	// const [updatingRoleId, setUpdatingRoleId] = useState<number | null>(null);

	const fetchMembers = useCallback(async () => {
		try {
			setIsLoading(true);
			const data = await projectApi.getMembers();
			setMembers(data.members ?? []);
		} catch (error) {
			console.error("Error fetching members:", error);
			toast({
				title: "Error",
				description: "Failed to load members",
				variant: "destructive",
				duration: 3000,
			});
		} finally {
			setIsLoading(false);
		}
	}, [toast]);

	const fetchAvailableUsers = useCallback(async () => {
		try {
			const data = await organizationApi.getMembersNotInProject();
			const allUsers = (data.members ?? []).map((m) => m.user);
			setAvailableUsers(allUsers);
			setHasAvailableUsersEndpoint(true);
		} catch (error) {
			console.error("Error fetching available users:", error);
			setHasAvailableUsersEndpoint(false);
			setAvailableUsers([]);
		}
	}, []);

	const addMember = useCallback(
		async (userId: number, role: string) => {
			try {
				setIsAddingMember(true);
				await projectApi.addMember({ userId, role });

				toast({
					title: "Success",
					description: "Member added successfully",
					duration: 3000,
				});

				await fetchMembers();
				return true;
			} catch (error) {
				console.error("Error adding member:", error);
				toast({
					title: "Error",
					description: "Failed to add member",
					variant: "destructive",
					duration: 3000,
				});
				return false;
			} finally {
				setIsAddingMember(false);
			}
		},
		[toast, fetchMembers],
	);

	// const updateMemberRole = useCallback(
	// 	async (id: number, role: string) => {
	// 		try {
	// 			setUpdatingRoleId(id);

	// 			// Optimistic update
	// 			setMembers((prev) =>
	// 				prev.map((m) =>
	// 					m.id === id
	// 						? {
	// 								...m,
	// 								role,
	// 							}
	// 						: m,
	// 				),
	// 			);

	// 			await projectApi.updateMemberRole(id, { role });

	// 			toast({
	// 				title: "Success",
	// 				description: "Role updated successfully",
	// 				duration: 3000,
	// 			});
	// 		} catch (error) {
	// 			console.error("Error updating role:", error);
	// 			toast({
	// 				title: "Error",
	// 				description: "Failed to update role",
	// 				variant: "destructive",
	// 				duration: 3000,
	// 			});
	// 			// Revert optimistic update
	// 			await fetchMembers();
	// 		} finally {
	// 			setUpdatingRoleId(null);
	// 		}
	// 	},
	// 	[toast, fetchMembers],
	// );

	const deleteMember = useCallback(
		async (member: ProjectMember) => {
			try {
				setDeletingId(member.id);
				await projectApi.deleteMember(member.id);

				toast({
					title: "Success",
					description: "Member removed successfully",
					duration: 3000,
				});

				await fetchMembers();
			} catch (error) {
				console.error("Error deleting member:", error);
				toast({
					title: "Error",
					description: "Failed to remove member",
					variant: "destructive",
					duration: 3000,
				});
			} finally {
				setDeletingId(null);
			}
		},
		[toast, fetchMembers],
	);

	useEffect(() => {
		fetchMembers();
	}, [fetchMembers]);

	return {
		members,
		availableUsers,
		hasAvailableUsersEndpoint,
		isLoading,
		isAddingMember,
		deletingId,
		// updatingRoleId,
		addMember,
		// updateMemberRole,
		deleteMember,
		fetchAvailableUsers,
	};
}
