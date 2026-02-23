import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { organizationApi, type Member } from "@/api/organization";
import { ORG_INVITES_QUERY_KEY } from "./useOrgInvites";
import { isLocalAuth } from "@/lib/auth";

export const ORG_MEMBERS_QUERY_KEY = ["org", "members"] as const;

export function useOrgMembers(orgId: string | undefined) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: [...ORG_MEMBERS_QUERY_KEY, orgId],
		queryFn: () => organizationApi.getMembers(),
		enabled: Boolean(orgId),
		refetchOnMount: "always",
	});

	const inviteMutation = useMutation({
		mutationFn: ({ email, role }: { email: string; role: string }) =>
			organizationApi.inviteMember({ email, role }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [...ORG_MEMBERS_QUERY_KEY, orgId] });
			queryClient.invalidateQueries({ queryKey: [...ORG_INVITES_QUERY_KEY, orgId] });
		},
	});

	const updateRoleMutation = useMutation({
		mutationFn: ({ memberId, role }: { memberId: number; role: string }) =>
			organizationApi.updateMemberRole(memberId, { role }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [...ORG_MEMBERS_QUERY_KEY, orgId] });
		},
	});

	const deleteMutation = useMutation({
		mutationFn: (memberId: number) => organizationApi.deleteMember(memberId),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [...ORG_MEMBERS_QUERY_KEY, orgId] });
		},
	});

	const members = (query.data?.members?.members ?? []) as Member[];

	const inviteMember = async (
		email: string,
		role: string,
	): Promise<{ success: boolean; inviteUrl?: string }> => {
		const trimmedEmail = email.trim();
		if (!trimmedEmail) return { success: false };
		try {
			await inviteMutation.mutateAsync({ email: trimmedEmail, role });

			let inviteUrl: string | undefined;
			if (isLocalAuth()) {
				try {
					const invitesResponse = await organizationApi.getInvites();
					const invites = invitesResponse.invites ?? [];
					const newInvite = invites.find((invite) => invite.email === trimmedEmail);
					if (newInvite?.token) {
						inviteUrl = `${window.location.origin}/invite/${newInvite.token}`;
					}
				} catch (error) {
					console.error("Failed to fetch invite URL:", error);
				}
			}

			toast({ title: "Sent", description: "Invitation email sent" });
			return { success: true, inviteUrl };
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Could not send invite",
				variant: "destructive",
			});
			return { success: false };
		}
	};

	const updateMemberRole = async (memberId: number, role: string): Promise<boolean> => {
		try {
			await updateRoleMutation.mutateAsync({ memberId, role });
			toast({ title: "Updated", description: "Member role updated" });
			return true;
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Failed to update role",
				variant: "destructive",
			});
			return false;
		}
	};

	const deleteMember = async (memberId: number): Promise<boolean> => {
		try {
			await deleteMutation.mutateAsync(memberId);
			toast({ title: "Removed", description: "Member removed from organization" });
			return true;
		} catch (error) {
			console.error(error);
			toast({
				title: "Error",
				description: "Failed to remove member",
				variant: "destructive",
			});
			return false;
		}
	};

	return {
		members,
		isLoading: query.isLoading,
		isInviting: inviteMutation.isPending,
		updatingRoleId: updateRoleMutation.isPending ? updateRoleMutation.variables?.memberId : null,
		deletingId: deleteMutation.isPending ? deleteMutation.variables : null,
		inviteMember,
		updateMemberRole,
		deleteMember,
		refresh: query.refetch,
	};
}
