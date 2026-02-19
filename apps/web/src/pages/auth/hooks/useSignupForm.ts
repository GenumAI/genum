import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { isCloudAuth } from "@/lib/auth";
import { getSignupErrorMessage, signupDefaultValues, type SignupFormData } from "../utils/signupForm";

export const useSignupForm = () => {
	const navigate = useNavigate();
	const isCloud = isCloudAuth();
	const { signup, isAuthenticated } = useLocalAuth();
	const { loginWithRedirect } = useAuth();
	const { toast } = useToast();
	const [isLoading, setIsLoading] = useState(false);

	const form = useForm<SignupFormData>({
		defaultValues: signupDefaultValues,
	});

	useEffect(() => {
		if (!isCloud) return;

		void loginWithRedirect({ appState: { returnTo: "/" } });
	}, [isCloud, loginWithRedirect]);

	useEffect(() => {
		if (!isAuthenticated) return;

		navigate("/", { replace: true });
	}, [isAuthenticated, navigate]);

	const onSubmit = async (data: SignupFormData) => {
		if (data.password !== data.confirmPassword) {
			toast({
				title: "Error",
				description: "Passwords do not match.",
				variant: "destructive",
			});
			return;
		}

		try {
			setIsLoading(true);
			await signup(data.email, data.password, data.name);

			toast({
				title: "Success",
				description: "Account created successfully. You are now logged in.",
			});

			navigate("/");
		} catch (error: unknown) {
			toast({
				title: "Error",
				description: getSignupErrorMessage(error),
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
		navigateToLogin: () => navigate("/login"),
	};
};
