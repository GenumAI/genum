import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { isCloudAuth } from "@/lib/auth";
import { getLoginErrorMessage, getReturnTo, loginDefaultValues, type LoginFormData } from "../utils/loginForm";

export const useLoginForm = () => {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const isCloud = isCloudAuth();
	const { login, isAuthenticated } = useLocalAuth();
	const { loginWithRedirect } = useAuth();
	const { toast } = useToast();
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<LoginFormData>({
		defaultValues: loginDefaultValues,
	});

	useEffect(() => {
		if (!isCloud) return;

		void loginWithRedirect({ appState: { returnTo: getReturnTo(searchParams) } });
	}, [isCloud, loginWithRedirect, searchParams]);

	useEffect(() => {
		if (!isAuthenticated) return;

		navigate(getReturnTo(searchParams), { replace: true });
	}, [isAuthenticated, navigate, searchParams]);

	const onSubmit = async (data: LoginFormData) => {
		try {
			setIsLoading(true);
			await login(data.email, data.password);

			toast({
				title: "Success",
				description: "You have been logged in successfully.",
			});

			navigate(getReturnTo(searchParams));
		} catch (error: unknown) {
			toast({
				title: "Error",
				description: getLoginErrorMessage(error),
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	return {
		isCloud,
		isAuthenticated,
		form,
		isLoading,
		onSubmit,
		navigateToSignup: () => navigate("/signup"),
	};
};
