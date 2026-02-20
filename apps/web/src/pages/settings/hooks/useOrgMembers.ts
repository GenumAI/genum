import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { organizationApi, type Member } from "@/api/organization";
import { isLocalAuth } from "@/lib/auth";
import { organizationKeys } from "@/query-keys/organization.keys";

export function useOrgMembers(orgId: string | undefined) {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const query = useQuery({
		queryKey: organizationKeys.members(orgId),
		queryFn: () => organizationApi.getMembers(),
		enabled: Boolean(orgId),
		refetchOnMount: "always",
	});

	const inviteMutation = useMutation({
		mutationFn: (email: string) => organizationApi.inviteMember({ email: email.trim() }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: organizationKeys.members(orgId) });
			queryClient.invalidateQueries({ queryKey: organizationKeys.invites(orgId) });
		},
	});

	const members = (query.data?.members?.members ?? []) as Member[];

	const inviteMember = async (
		email: string,
	): Promise<{ success: boolean; inviteUrl?: string }> => {
		const trimmedEmail = email.trim();
		if (!trimmedEmail) return { success: false };
		try {
			await inviteMutation.mutateAsync(trimmedEmail);

			// For local instance, get invite URL after successful invite
			let inviteUrl: string | undefined;
			if (isLocalAuth()) {
				try {
					// Fetch invites to get the token for the newly created invite
					const invitesResponse = await organizationApi.getInvites();
					const invites = invitesResponse.invites ?? [];
					// Find the invite with matching email (should be the most recent one)
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

	return {
		members,
		isLoading: query.isLoading,
		isInviting: inviteMutation.isPending,
		inviteMember,
		refresh: query.refetch,
	};
}
