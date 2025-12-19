import { useEffect, useState, useCallback, type FC } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { userApi } from "@/api/user";
import type { InviteValidationResponse, AcceptInviteResponse } from "@/api/user";
import { setApiContext } from "@/api/client";

const AcceptInvitePage: FC = () => {
	const { token: urlToken } = useParams<{
		token: string;
	}>();
	const navigate = useNavigate();
	const { loginWithRedirect, isAuthenticated, isLoading, user, getAccessTokenSilently } = useAuth();

	// get token from URL or localStorage
	const token = urlToken || localStorage.getItem("pending_invite_token");

	// On this public route (`/invite/:token`) we may not pass through the usual
	// authenticated app entry (`RedirectedToProjectRoute`) that initializes `apiContext`.
	// Ensure the API client can attach `Authorization: Bearer ...` in cloud mode.
	useEffect(() => {
		setApiContext({
			getToken: async () => {
				try {
					return await getAccessTokenSilently();
				} catch {
					return "";
				}
			},
			getOrgId: () => undefined,
			getProjectId: () => undefined,
		});
	}, [getAccessTokenSilently]);

	// state for checking the validity of the invite
	const [inviteData, setInviteData] = useState<InviteValidationResponse | null>(null);
	const [hasCheckedInvite, setHasCheckedInvite] = useState(false);
	const [isInviteLoading, setIsInviteLoading] = useState(false);
	const [inviteError, setInviteError] = useState<any>(null);

	// Extra-robust: explicitly attach Bearer for invite calls.
	// This avoids relying on global `apiContext` timing on this route.
	const getInviteRequestConfig = useCallback(async () => {
		try {
			const accessToken = await getAccessTokenSilently();
			if (!accessToken) return undefined;
			return { headers: { Authorization: `Bearer ${accessToken}` } };
		} catch {
			return undefined;
		}
	}, [getAccessTokenSilently]);

	// mutation state replacement
	const [isProcessing, setIsProcessing] = useState(false);
	const [processError, setProcessError] = useState<any>(null);
	const [processSuccess, setProcessSuccess] = useState<AcceptInviteResponse | null>(null);

	const fetchInvite = useCallback(async () => {
		if (!token) return;

		setIsInviteLoading(true);
		setInviteError(null);
		try {
			const config = await getInviteRequestConfig();
			const data = await userApi.getInviteByToken(token, config);
			setInviteData(data);
		} catch (error) {
			console.error("Failed to validate invite:", error);
			setInviteError(error);
		} finally {
			setIsInviteLoading(false);
			setHasCheckedInvite(true);
		}
	}, [token, getInviteRequestConfig]);

	// check the invite only once after authentication
	useEffect(() => {
		const checkInvite = async () => {
			if (!isAuthenticated || !token || isLoading || hasCheckedInvite) {
				return;
			}
			fetchInvite();
		};

		checkInvite();
	}, [isAuthenticated, token, isLoading, hasCheckedInvite, fetchInvite]);

	const handleAcceptInvite = async () => {
		if (!token) {
			console.error("No invite token provided");
			return;
		}

		if (!isAuthenticated) {
			console.error("User is not authenticated");
			return;
		}

		setIsProcessing(true);
		setProcessError(null);

		try {
			const config = await getInviteRequestConfig();
			const result = await userApi.acceptInvite(token, config);

			setProcessSuccess(result);

			// clear the token from localStorage after successful acceptance
			localStorage.removeItem("pending_invite_token");

			navigate("/");
		} catch (error: any) {
			console.error("Failed to accept invite:", error);
			setProcessError(error);
		} finally {
			setIsProcessing(false);
		}
	};

	const handleDecline = () => {
		// clear the token from localStorage when declining
		localStorage.removeItem("pending_invite_token");
		navigate("/");
	};

	const handleLogin = () => {
		if (token) {
			localStorage.setItem("pending_invite_token", token);
		}

		loginWithRedirect();
	};

	useEffect(() => {
		// check the token from URL or localStorage
		const urlToken = token;
		const storedToken = localStorage.getItem("pending_invite_token");

		if (!urlToken && !storedToken) {
			navigate("/");
		}
	}, [token, navigate]);

	// Debug logs for authentication state
	useEffect(() => {
		console.log("Auth state:", { isAuthenticated, isLoading, user });
	}, [isAuthenticated, isLoading, user]);

	return (
		<div className="fixed inset-0 w-full h-full bg-[url('https://cdn.genum.ai/background/auth_background.png?=1')] bg-cover bg-center bg-no-repeat flex items-center justify-center">
			<div className="flex flex-col gap-6 w-[400px] h-[350px] shadow-[0_4px_16px_#00000014] rounded-[24px] p-[52px] bg-white">
				<div className="text-center">
					<img
						src="https://cdn.genum.ai/logo/ai_logo.png"
						alt="Logo"
						className="w-[120px] h-[23px] mx-auto"
					/>
					<h1 className="text-[24px] font-bold text-gray-900 mb-[16px] mt-[24px]">
						Accept Invitation
					</h1>
					<p className="text-gray-800 text-[14px]">
						{inviteData?.invite?.org_name ? (
							<>
								You've been invited to join{" "}
								<strong>{inviteData.invite.org_name}</strong>. Would you like to
								accept this invitation?
							</>
						) : (
							"You've been invited to join an organization. Would you like to accept this invitation?"
						)}
					</p>
				</div>

				{isLoading ? (
					<div className="text-center">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					</div>
				) : !isAuthenticated ? (
					<div className="flex flex-col gap-2">
						<p className="mt-2 font-bold text-[14px] text-center text-gray-900">
							First, you must log in to your account
						</p>
						<Button
							variant="outline"
							size="lg"
							className="flex-1 min-h-[40px] text-gray-900"
							onClick={handleLogin}
						>
							Log In
						</Button>
					</div>
				) : isInviteLoading ? (
					<div className="text-center">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
						<p className="mt-2 text-blue-700 font-medium">Validating invitation...</p>
					</div>
				) : inviteError || !inviteData?.invite?.invite_valid ? (
					<div className="text-center border border-0 rounded-md p-4 py-3 mb-0">
						<h3 className="text-[#FF4545] font-medium">Invalid Invitation</h3>
						<p className="text-[#FF4545] text-[12px]">
							This invitation does not exist or has expired.
						</p>
						<Button
							variant="outline"
							size="lg"
							onClick={() => navigate("/")}
							className="w-full mt-4 text-gray-900"
						>
							Go Home
						</Button>
					</div>
				) : (
					<>
						{isProcessing && (
							<div className="text-center mb-4">
								<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
								<p className="mt-2 text-blue-700 font-medium">
									Processing your invitation...
								</p>
							</div>
						)}

						{processError && (
							<div className="text-center border border-0 rounded-md p-4 py-3 mb-0">
								<h3 className="text-[#FF4545] font-medium">Error</h3>
								<p className="text-[#FF4545] text-[12px]">{processError.message}</p>
								{processError.message?.includes("email does not match") && (
									<div className="mt-3 p-3 bg-red-100 rounded-md">
										<p className="text-red-700 text-sm font-medium">
											What to do:
										</p>
										<ul className="text-red-600 text-sm mt-1 list-disc list-inside">
											<li>
												Make sure you're logged in with the correct email
												account
											</li>
											<li>
												Check if the invitation was sent to a different
												email
											</li>
											<li>Contact the person who sent the invitation</li>
										</ul>
									</div>
								)}
							</div>
						)}

						{processSuccess && (
							<div className="text-center border border-0 rounded-md p-4 py-3 mb-0">
								<h3 className="text-[#2E9D2A] font-medium">Success!</h3>
								<p className="text-green-700 text-[12px] text-sm font-medium">
									Invitation accepted successfully. Redirecting you to the
									dashboard...
								</p>
								{processSuccess.organization && (
									<p className="text-green-700 text-sm mt-2 font-medium">
										Welcome to {processSuccess.organization.name}!
									</p>
								)}
							</div>
						)}

						{!processSuccess && (
							<div className="space-y-3">
								<Button
									variant="default"
									size="lg"
									onClick={handleAcceptInvite}
									disabled={isProcessing}
									className="w-full text-white bg-black hover:bg-gray-800"
								>
									{isProcessing ? "Accepting..." : "Accept"}
								</Button>

								<Button
									variant="outline"
									size="lg"
									onClick={handleDecline}
									disabled={isProcessing}
									className="w-full text-gray-900"
								>
									Decline
								</Button>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
};

export default AcceptInvitePage;
