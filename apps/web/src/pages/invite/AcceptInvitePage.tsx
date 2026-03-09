import type { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/theme/theme-provider";
import { isCloudAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAcceptInviteFlow } from "@/pages/invite/hooks/useAcceptInviteFlow";
import { getInviteThemeAssets } from "@/pages/invite/utils/inviteThemeAssets";

const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong. Please try again.";
};

const AcceptInvitePage: FC = () => {
	const { token: urlToken } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const { resolvedTheme } = useTheme();
	const isCloud = isCloudAuth();
	const isDark = resolvedTheme === "dark";
	const isLocalDark = !isCloud && isDark;
	const { logoSrc, backgroundImage } = getInviteThemeAssets(isLocalDark, isCloud);
	const {
		isAuthenticated,
		isLoadingAuth,
		inviteQuery,
		acceptMutation,
		handleAcceptInvite,
		handleDecline,
		handleLogin,
	} = useAcceptInviteFlow({ urlToken });

	const inviteData = inviteQuery.data;
	const inviteError = inviteQuery.error;
	const processError = acceptMutation.error;
	const isProcessing = acceptMutation.isPending;
	const isLoginRequiredState = !isLoadingAuth && !isAuthenticated;

	return (
		<div
			className={cn(
				"fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat flex items-center justify-center",
				isLocalDark && "dark:bg-zinc-950",
			)}
			style={{ backgroundImage: `url('${backgroundImage}')` }}
		>
			<div
				className={cn(
					"flex flex-col gap-6 w-[400px] shadow-[0_4px_16px_#00000014] rounded-[24px] p-[52px] bg-white",
					isLoginRequiredState ? "h-[350px]" : "min-h-[460px]",
					isLocalDark &&
						"dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] dark:bg-zinc-900 dark:border dark:border-zinc-800",
				)}
			>
				<div className="text-center">
					<img src={logoSrc} alt="Logo" className="w-[120px] h-[23px] mx-auto dark:invert-0" />
					<h1
						className={cn(
							"text-[24px] font-bold text-gray-900 mb-[16px] mt-[24px]",
							isLocalDark && "dark:text-zinc-50",
						)}
					>
						Accept Invitation
					</h1>
					<p className={cn("text-gray-800 text-[14px]", isLocalDark && "dark:text-zinc-400")}>
						{inviteData?.invite?.org_name ? (
							<>
								You've been invited to join <strong>{inviteData.invite.org_name}</strong>.
								{" "}Would you like to accept this invitation?
							</>
						) : (
							"You've been invited to join an organization. Would you like to accept this invitation?"
						)}
					</p>
				</div>

				{isLoadingAuth ? (
					<div className="text-center">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
					</div>
				) : !isAuthenticated ? (
					<div className="flex flex-col gap-2">
						<p
							className={cn(
								"mt-2 font-bold text-[14px] text-center text-gray-900",
								isLocalDark && "dark:text-zinc-200",
							)}
						>
							First, you must log in to your account
						</p>
						<Button
							variant="outline"
							size="lg"
							className={cn(
								"flex-1 min-h-[40px] text-gray-900",
								isLocalDark && "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
							)}
							onClick={handleLogin}
						>
							Log In
						</Button>
					</div>
				) : inviteQuery.isPending ? (
					<div className="text-center">
						<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
						<p className="mt-2 text-blue-700 font-medium">Validating invitation...</p>
					</div>
				) : inviteError || !inviteData?.invite?.invite_valid ? (
					<div className={cn("text-center border border-0 rounded-md p-4 py-3 mb-0", isLocalDark && "dark:bg-zinc-900")}>
						<h3 className="text-[#FF4545] font-medium">Invalid Invitation</h3>
						<p className="text-[#FF4545] text-[12px]">
							This invitation does not exist or has expired.
						</p>
						<Button
							variant="outline"
							size="lg"
							onClick={() => navigate("/")}
							className={cn("w-full mt-4 text-gray-900", isLocalDark && "dark:text-zinc-100")}
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
							<div className={cn("text-center border border-0 rounded-md p-4 py-3 mb-0", isLocalDark && "dark:bg-zinc-900")}>
								<h3 className="text-[#FF4545] font-medium">Error</h3>
								<p className="text-[#FF4545] text-[12px]">
									{getErrorMessage(processError)}
								</p>
								{getErrorMessage(processError).includes("email does not match") && (
									<div className="mt-3 p-3 bg-red-100 rounded-md">
										<p className="text-red-700 text-sm font-medium">What to do:</p>
										<ul className="text-red-600 text-sm mt-1 list-disc list-inside">
											<li>Make sure you're logged in with the correct email account</li>
											<li>Check if the invitation was sent to a different email</li>
											<li>Contact the person who sent the invitation</li>
										</ul>
									</div>
								)}
							</div>
						)}

						<div className="mt-auto space-y-3">
							<Button
								variant="default"
								size="lg"
								onClick={handleAcceptInvite}
								disabled={isProcessing}
								className={cn(
									"w-full text-white bg-black hover:bg-gray-800",
									isLocalDark && "dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200",
								)}
							>
								{isProcessing ? "Accepting..." : "Accept"}
							</Button>

							<Button
								variant="outline"
								size="lg"
								onClick={handleDecline}
								disabled={isProcessing}
								className={cn("w-full text-gray-900", isLocalDark && "dark:text-zinc-100")}
							>
								Decline
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default AcceptInvitePage;
