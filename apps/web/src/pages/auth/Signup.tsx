import { useTheme } from "@/components/theme/theme-provider";
import { AuthPageFrame } from "./components/AuthPageFrame";
import SignupForm from "./components/SignupForm";
import { useSignupForm } from "./hooks/useSignupForm";
import { getAuthThemeAssets } from "./utils/authThemeAssets";

export default function Signup() {
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const { isCloud, isAuthenticated, form, isLoading, onSubmit, navigateToLogin } =
		useSignupForm();

	if (isCloud) {
		return null;
	}

	if (isAuthenticated) {
		return null;
	}
	const { logoSrc, backgroundImage } = getAuthThemeAssets(isDark);

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
