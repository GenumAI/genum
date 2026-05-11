import type { FC } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { isCloudAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useAcceptInviteFlow } from "@/pages/invite/hooks/useAcceptInviteFlow";
import {
	getInviteThemeAssets,
	isCssVariableImage,
	resolveBackgroundImage,
} from "@/pages/invite/utils/inviteThemeAssets";

const getErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}

	return "Something went wrong. Please try again.";
};

const AcceptInvitePage: FC = () => {
	const { token: urlToken } = useParams<{ token: string }>();
	const navigate = useNavigate();
	const isCloud = isCloudAuth();
	const { logoSrc, backgroundImage } = getInviteThemeAssets(isCloud);
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
			className="fixed inset-0 flex h-full w-full items-center justify-center bg-background bg-cover bg-center bg-no-repeat"
			style={{ backgroundImage: resolveBackgroundImage(backgroundImage) }}
		>
			<div
				className={cn(
					"flex w-[400px] flex-col gap-6 rounded-[24px] border border-border bg-card/95 p-[52px] text-card-foreground shadow-2xl backdrop-blur-sm",
					isLoginRequiredState ? "h-[350px]" : "min-h-[460px]",
				)}
			>
				<div className="text-center">
					{isCssVariableImage(logoSrc) ? (
						<div
							role="img"
							aria-label="Logo"
							className="mx-auto h-[23px] w-[120px] bg-contain bg-center bg-no-repeat"
							style={{ backgroundImage: logoSrc }}
						/>
					) : (
						<img src={logoSrc} alt="Logo" className="mx-auto h-[23px] w-[120px]" />
					)}
					<h1 className="mb-[16px] mt-[24px] text-[24px] font-bold text-foreground">
						Accept Invitation
					</h1>
					<p className="text-[14px] text-muted-foreground">
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

				{isLoadingAuth ? (
					<div className="text-center">
						<div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-brand"></div>
					</div>
				) : !isAuthenticated ? (
					<div className="flex flex-col gap-2">
						<p className="mt-2 text-center text-[14px] font-bold text-foreground">
							First, you must log in to your account
						</p>
						<Button
							variant="outline"
							size="lg"
							className="min-h-[40px] flex-1"
							onClick={handleLogin}
						>
							Log In
						</Button>
					</div>
				) : inviteQuery.isPending ? (
					<div className="text-center">
						<div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-brand"></div>
						<p className="mt-2 font-medium text-brand">Validating invitation...</p>
					</div>
				) : inviteError || !inviteData?.invite?.invite_valid ? (
					<div className="mb-0 rounded-md border border-destructive/20 bg-destructive/10 p-4 py-3 text-center">
						<h3 className="font-medium text-destructive">Invalid Invitation</h3>
						<p className="text-[12px] text-destructive">
							This invitation does not exist or has expired.
						</p>
						<Button
							variant="outline"
							size="lg"
							onClick={() => navigate("/")}
							className="mt-4 w-full"
						>
							Go Home
						</Button>
					</div>
				) : (
					<>
						{isProcessing && (
							<div className="text-center mb-4">
								<div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-brand"></div>
								<p className="mt-2 font-medium text-brand">
									Processing your invitation...
								</p>
							</div>
						)}

						{processError && (
							<div className="mb-0 rounded-md border border-destructive/20 bg-destructive/10 p-4 py-3 text-center">
								<h3 className="font-medium text-destructive">Error</h3>
								<p className="text-[12px] text-destructive">
									{getErrorMessage(processError)}
								</p>
								{getErrorMessage(processError).includes("email does not match") && (
									<div className="mt-3 rounded-md bg-destructive/10 p-3 text-left">
										<p className="text-sm font-medium text-destructive">
											What to do:
										</p>
										<ul className="mt-1 list-inside list-disc text-sm text-destructive/90">
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

						<div className="mt-auto space-y-3">
							<Button
								variant="default"
								size="lg"
								onClick={handleAcceptInvite}
								disabled={isProcessing}
								className="w-full"
							>
								{isProcessing ? "Accepting..." : "Accept"}
							</Button>

							<Button
								variant="outline"
								size="lg"
								onClick={handleDecline}
								disabled={isProcessing}
								className="w-full"
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
