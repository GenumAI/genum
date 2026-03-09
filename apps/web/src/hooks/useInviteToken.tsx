import { useCallback } from "react";

const INVITE_TOKEN_KEY = "pending_invite_token";
const INVITE_EXPIRY_KEY = "pending_invite_expiry";

const TOKEN_EXPIRY_HOURS = 24;

export const useInviteToken = () => {
	const saveInviteToken = useCallback((token: string) => {
		try {
			const expiryTime = Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000;
			localStorage.setItem(INVITE_TOKEN_KEY, token);
			localStorage.setItem(INVITE_EXPIRY_KEY, expiryTime.toString());
			return true;
		} catch (error) {
			console.error("Failed to save invite token:", error);
			return false;
		}
	}, []);

	const clearInviteToken = useCallback(() => {
		try {
			localStorage.removeItem(INVITE_TOKEN_KEY);
			localStorage.removeItem(INVITE_EXPIRY_KEY);
		} catch (error) {
			console.error("Failed to clear invite token:", error);
		}
	}, []);

	const getInviteToken = useCallback((): string | null => {
		try {
			const token = localStorage.getItem(INVITE_TOKEN_KEY);
			const expiry = localStorage.getItem(INVITE_EXPIRY_KEY);

			if (!token || !expiry) {
				return null;
			}

			if (Date.now() > parseInt(expiry, 10)) {
				clearInviteToken();
				return null;
			}

			return token;
		} catch (error) {
			console.error("Failed to get invite token:", error);
			return null;
		}
	}, [clearInviteToken]);

	const hasInviteToken = useCallback((): boolean => {
		return getInviteToken() !== null;
	}, [getInviteToken]);

	return {
		saveInviteToken,
		getInviteToken,
		clearInviteToken,
		hasInviteToken,
	};
};
