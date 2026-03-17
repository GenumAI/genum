import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInviteToken } from "@/hooks/useInviteToken";

const PendingInviteHandler = () => {
	const { user, isAuthenticated } = useAuth();
	const navigate = useNavigate();
	const { getInviteToken, clearInviteToken } = useInviteToken();

	useEffect(() => {
		if (isAuthenticated && user) {
			const pendingInviteToken = getInviteToken();
			if (pendingInviteToken) {
				clearInviteToken();
				navigate(`/invite/${pendingInviteToken}`);
			}
		}
	}, [isAuthenticated, user, navigate, getInviteToken, clearInviteToken]);

	return null;
};

export default PendingInviteHandler;
