import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getAuthMode } from "@/lib/auth";
import { useUserStore } from "@/stores/user.store";
import { userApi } from "@/api/user";
import { authApi } from "@/api/auth";

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
	const setUserStore = useUserStore((state) => state.setUser);
	const setUserData = useUserStore((state) => state.setUserData);
	const setLoading = useUserStore((state) => state.setLoading);

	useEffect(() => {
		const authMode = getAuthMode();
		if (authMode === "local") {
			checkAuthStatus();
		} else {
			setIsLoading(false);
			setIsAuthenticated(false);
			setUser(null);
			setLoading(false);
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
			setUserStore({
				name: userData.name || "",
				email: userData.email || "",
				avatar: undefined,
			});
			setUserData(userData);
			setLoading(false); // set loading to false in store
		} catch {
			setIsAuthenticated(false);
			setUser(null);
			setLoading(false);
		} finally {
			setIsLoading(false);
		}
	}, [setUserStore, setUserData, setLoading]);

	const login = useCallback(
		async (email: string, password: string) => {
			const authMode = getAuthMode();
			if (authMode !== "local") {
				throw new Error("Local authentication is only available in local mode");
			}

			try {
				await authApi.login({ email, password });

				// After successful login, check auth status to get user data
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

				// After successful signup, check auth status to get user data
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
			// In cloud mode, just clear local state
			setIsAuthenticated(false);
			setUser(null);
			setUserStore(null);
			setUserData(null);
			setLoading(false);
			return;
		}

		try {
			await authApi.logout();
		} catch {
		} finally {
			setIsAuthenticated(false);
			setUser(null);
			setUserStore(null);
			setUserData(null);
			setLoading(false);
		}
	}, [setUserStore, setUserData, setLoading]);

	const getAccessTokenSilently = useCallback(async (): Promise<string> => {
		// For self-hosted, we don't use tokens, but return empty string
		// The actual auth is handled via cookies
		return "";
	}, []);

	const loginWithRedirect = useCallback((options?: { appState?: any }) => {
		// For self-hosted, redirect to login page
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
