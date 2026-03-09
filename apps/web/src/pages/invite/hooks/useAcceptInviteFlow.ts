import { useCallback, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { userApi } from "@/api/user";
import type { ApiRequestConfig } from "@/api/client";
import type { CurrentUser } from "@/api/user";
import { useAuth } from "@/hooks/useAuth";
import { useInviteToken } from "@/hooks/useInviteToken";
import { authKeys } from "@/query-keys/auth.keys";
import { inviteKeys } from "@/query-keys/invite.keys";

interface UseAcceptInviteFlowParams {
	urlToken?: string;
}

const buildInviteOrgPath = (user: CurrentUser | undefined, invitedOrgId: string): string => {
	const invitedOrg = user?.organizations?.find((org) => org.id.toString() === invitedOrgId);
	const firstProjectId = invitedOrg?.projects?.[0]?.id?.toString();

	if (firstProjectId) {
		return `/${invitedOrgId}/${firstProjectId}/getting-started`;
	}

	return `/${invitedOrgId}`;
};

export function useAcceptInviteFlow({ urlToken }: UseAcceptInviteFlowParams) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { saveInviteToken, getInviteToken, clearInviteToken } = useInviteToken();
	const { loginWithRedirect, isAuthenticated, isLoading, user, getAccessTokenSilently } =
		useAuth();

	const token = urlToken || getInviteToken();

	const getInviteRequestConfig = useCallback(async (): Promise<ApiRequestConfig | undefined> => {
		try {
			const accessToken = await getAccessTokenSilently();
			if (!accessToken) return undefined;
			return { headers: { Authorization: `Bearer ${accessToken}` } };
		} catch {
			return undefined;
		}
	}, [getAccessTokenSilently]);

	useEffect(() => {
		if (urlToken) {
			saveInviteToken(urlToken);
		}
	}, [urlToken, saveInviteToken]);

	useEffect(() => {
		if (!token) {
			navigate("/");
		}
	}, [token, navigate]);

	const inviteQuery = useQuery({
		queryKey: inviteKeys.validation(token),
		enabled: Boolean(isAuthenticated && !isLoading && token),
		queryFn: async () => {
			const config = await getInviteRequestConfig();
			return userApi.getInviteByToken(token as string, config);
		},
	});

	const acceptMutation = useMutation({
		mutationFn: async () => {
			if (!token) {
				throw new Error("No invite token provided");
			}

			const config = await getInviteRequestConfig();
			return userApi.acceptInvite(token, config);
		},
		onSuccess: async (result) => {
			const invitedOrgId =
				result.organization?.id?.toString() ?? result.member?.organizationId?.toString() ?? null;

			const config = await getInviteRequestConfig();
			const freshUser = await userApi.getCurrentUser(config);

			queryClient.setQueryData(authKeys.currentUser(), freshUser);
			queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });

			clearInviteToken();

			if (invitedOrgId) {
				navigate(buildInviteOrgPath(freshUser, invitedOrgId));
				return;
			}

			navigate("/");
		},
	});

	const handleAcceptInvite = useCallback(() => {
		if (!isAuthenticated) {
			return;
		}

		acceptMutation.mutate();
	}, [isAuthenticated, acceptMutation]);

	const handleDecline = useCallback(() => {
		clearInviteToken();
		navigate("/");
	}, [clearInviteToken, navigate]);

	const handleLogin = useCallback(() => {
		if (token) {
			saveInviteToken(token);
		}

		loginWithRedirect();
	}, [token, saveInviteToken, loginWithRedirect]);

	return {
		token,
		isAuthenticated,
		isLoadingAuth: isLoading,
		user,
		inviteQuery,
		acceptMutation,
		handleAcceptInvite,
		handleDecline,
		handleLogin,
	};
}
