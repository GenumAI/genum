import { useTheme } from "@/components/theme/theme-provider";
import { AuthPageFrame } from "./components/AuthPageFrame";
import LoginForm from "./components/LoginForm";
import { useLoginForm } from "./hooks/useLoginForm";
import { getAuthThemeAssets } from "./utils/authThemeAssets";

export default function Login() {
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const { isCloud, isAuthenticated, form, isLoading, onSubmit, navigateToSignup } =
		useLoginForm();

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
