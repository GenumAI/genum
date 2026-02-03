import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthMode } from "@/lib/auth";
import { userApi } from "@/api/user";
import { authApi } from "@/api/auth";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/useCurrentUser";

interface LocalAuthUser {
	sub: string;
	email: string;
	name?: string;
	picture?: string;
}

interface LocalAuthContextType {
	isAuthenticated: boolean;
	isLoading: boolean;
	user: LocalAuthUser | null;
	login: (email: string, password: string) => Promise<void>;
	signup: (email: string, password: string, name: string) => Promise<void>;
	logout: () => Promise<void>;
	getAccessTokenSilently: () => Promise<string>;
	loginWithRedirect: (options?: { appState?: any }) => void;
}

const LocalAuthContext = createContext<LocalAuthContextType | undefined>(undefined);

interface LocalAuthProviderProps {
	children: ReactNode;
}

export function LocalAuthProvider({ children }: LocalAuthProviderProps) {
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [user, setUser] = useState<LocalAuthUser | null>(null);
	const queryClient = useQueryClient();

	useEffect(() => {
		const authMode = getAuthMode();
		if (authMode === "local") {
			checkAuthStatus();
		} else {
			setIsLoading(false);
			setIsAuthenticated(false);
			setUser(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const checkAuthStatus = useCallback(async () => {
		const authMode = getAuthMode();
		if (authMode !== "local") {
			setIsLoading(false);
			setIsAuthenticated(false);
			setUser(null);
			return;
		}

		try {
			setIsLoading(true);
			const userData = await userApi.getCurrentUser();

			if (!userData || !userData.email) {
				setIsAuthenticated(false);
				setUser(null);
				setIsLoading(false);
				queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
				return;
			}

			const authUser: LocalAuthUser = {
				sub: userData.email,
				email: userData.email,
				name: userData.name,
				picture: undefined,
			};

			setUser(authUser);
			setIsAuthenticated(true);
			queryClient.setQueryData(CURRENT_USER_QUERY_KEY, userData);
		} catch {
			setIsAuthenticated(false);
			setUser(null);
			queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
		} finally {
			setIsLoading(false);
		}
	}, [queryClient]);

	const login = useCallback(
		async (email: string, password: string) => {
			const authMode = getAuthMode();
			if (authMode !== "local") {
				throw new Error("Local authentication is only available in local mode");
			}

			try {
				await authApi.login({ email, password });
				await checkAuthStatus();
			} catch (error) {
				throw error;
			}
		},
		[checkAuthStatus],
	);

	const signup = useCallback(
		async (email: string, password: string, name: string) => {
			const authMode = getAuthMode();
			if (authMode !== "local") {
				throw new Error("Local authentication is only available in local mode");
			}

			try {
				await authApi.signup({ email, password, name });
				await checkAuthStatus();
			} catch (error) {
				throw error;
			}
		},
		[checkAuthStatus],
	);

	const logout = useCallback(async () => {
		const authMode = getAuthMode();
		if (authMode !== "local") {
			setIsAuthenticated(false);
			setUser(null);
			queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
			return;
		}

		try {
			await authApi.logout();
		} catch {
		} finally {
			setIsAuthenticated(false);
			setUser(null);
			queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY });
		}
	}, [queryClient]);

	const getAccessTokenSilently = useCallback(async (): Promise<string> => {
		return "";
	}, []);

	const loginWithRedirect = useCallback((options?: { appState?: any }) => {
		const returnTo = options?.appState?.returnTo || window.location.pathname;
		window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
	}, []);

	const value: LocalAuthContextType = {
		isAuthenticated,
		isLoading,
		user,
		login,
		signup,
		logout,
		getAccessTokenSilently,
		loginWithRedirect,
	};

	return <LocalAuthContext.Provider value={value}>{children}</LocalAuthContext.Provider>;
}

export function useLocalAuth(): LocalAuthContextType {
	const context = useContext(LocalAuthContext);
	if (context === undefined) {
		throw new Error("useLocalAuth must be used within a LocalAuthProvider");
	}
	return context;
}
