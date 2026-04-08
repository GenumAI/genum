import { getInviteThemeAssets } from "@/pages/invite/utils/inviteThemeAssets";
import { AuthPageFrame } from "./components/AuthPageFrame";
import SignupForm from "./components/SignupForm";
import { useSignupForm } from "./hooks/useSignupForm";

export default function Signup() {
	const { isCloud, isAuthenticated, form, isLoading, onSubmit, navigateToLogin } =
		useSignupForm();

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
			title="Sign Up"
			description="Create a new account to get started"
			cardClassName="max-h-[90vh] overflow-y-auto"
		>
			<SignupForm
				form={form}
				isLoading={isLoading}
				onSubmit={onSubmit}
				onLoginClick={navigateToLogin}
			/>
		</AuthPageFrame>
	);
}
