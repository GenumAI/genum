import { getInviteThemeAssets } from "@/pages/invite/utils/inviteThemeAssets";
import { AuthPageFrame } from "./components/AuthPageFrame";
import LoginForm from "./components/LoginForm";
import { useLoginForm } from "./hooks/useLoginForm";

export default function Login() {
	const { isCloud, isAuthenticated, form, isLoading, onSubmit, navigateToSignup } =
		useLoginForm();

	if (isCloud) {
		return null;
	}

	if (isAuthenticated) {
		return null;
	}
	const { logoSrc, backgroundImage } = getInviteThemeAssets(false);

	return (
		<AuthPageFrame
			backgroundImage={backgroundImage}
			logoSrc={logoSrc}
			title="Log In"
			description="Enter your credentials to access your account"
		>
			<LoginForm
				form={form}
				isLoading={isLoading}
				onSubmit={onSubmit}
				onSignupClick={navigateToSignup}
			/>
		</AuthPageFrame>
	);
}
