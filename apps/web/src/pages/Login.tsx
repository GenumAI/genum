import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { useAuth } from "@/hooks/useAuth";
import { isCloudAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/useToast";
import { useTheme } from "@/components/theme/theme-provider";
import localLogoLight from "@/assets/genum_logo/light_theme_logo.png";
import localLogoDark from "@/assets/genum_logo/dark_theme_logo.png";
import localBackgroundLight from "@/assets/background/light_theme_background.png";
import localBackgroundDark from "@/assets/background/dark_theme_background.png";

interface LoginFormData {
	email: string;
	password: string;
}

export default function Login() {
	const [searchParams] = useSearchParams();
	const navigate = useNavigate();
	const isCloud = isCloudAuth();
	const { login, isAuthenticated: localIsAuthenticated } = useLocalAuth();
	const { loginWithRedirect } = useAuth();
	const { toast } = useToast();
	const { resolvedTheme } = useTheme();
	const [isLoading, setIsLoading] = useState(false);
	const isDark = resolvedTheme === "dark";

	useEffect(() => {
		if (isCloud) {
			const returnTo = searchParams.get("returnTo") || "/";
			loginWithRedirect({ appState: { returnTo } });
		}
	}, [isCloud, loginWithRedirect, searchParams]);

	if (isCloud) {
		return null;
	}

	const isAuthenticated = localIsAuthenticated;

	const form = useForm<LoginFormData>({
		defaultValues: {
			email: "",
			password: "",
		},
	});

	useEffect(() => {
		if (isAuthenticated) {
			const returnTo = searchParams.get("returnTo") || "/";
			navigate(returnTo, { replace: true });
		}
	}, [isAuthenticated, navigate, searchParams]);

	if (isAuthenticated) {
		return null;
	}
	const logoSrc = isDark ? localLogoDark : localLogoLight;
	const backgroundImage = isDark ? localBackgroundDark : localBackgroundLight;

	const onSubmit = async (data: LoginFormData) => {
		try {
			setIsLoading(true);
			await login(data.email, data.password);

			toast({
				title: "Success",
				description: "You have been logged in successfully.",
			});

			const returnTo = searchParams.get("returnTo") || "/";
			navigate(returnTo);
		} catch (error: any) {
			toast({
				title: "Error",
				description: error.message || "Failed to log in. Please check your credentials.",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div
			className="fixed inset-0 w-full h-full bg-cover bg-center bg-no-repeat flex items-center justify-center dark:bg-zinc-950"
			style={{ backgroundImage: `url('${backgroundImage}')` }}
		>
			<div className="flex flex-col gap-6 w-[400px] shadow-[0_4px_16px_#00000014] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)] rounded-[24px] p-[52px] bg-white dark:bg-zinc-900 dark:border dark:border-zinc-800">
				<div className="text-center">
					<div className="mx-auto flex h-[32px] w-[140px] items-center justify-center">
						<img
							src={logoSrc}
							alt="Logo"
							className="max-h-full max-w-full object-contain object-center dark:invert-0"
						/>
					</div>
					<h1 className="text-[24px] font-bold text-gray-900 dark:text-zinc-50 mb-[16px] mt-[24px]">
						Log In
					</h1>
					<p className="text-gray-800 dark:text-zinc-400 text-[14px]">
						Enter your credentials to access your account
					</p>
				</div>

				<Form {...form}>
					<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
						<FormField
							control={form.control}
							name="email"
							rules={{
								required: "Email is required",
								pattern: {
									value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
									message: "Invalid email address",
								},
							}}
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-gray-900 dark:text-zinc-200">
										Email
									</FormLabel>
									<FormControl>
										<Input
											type="email"
											placeholder="your.email@example.com"
											{...field}
											disabled={isLoading}
											className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<FormField
							control={form.control}
							name="password"
							rules={{
								required: "Password is required",
								minLength: {
									value: 6,
									message: "Password must be at least 6 characters",
								},
							}}
							render={({ field }) => (
								<FormItem>
									<FormLabel className="text-gray-900 dark:text-zinc-200">
										Password
									</FormLabel>
									<FormControl>
										<Input
											type="password"
											placeholder="Enter your password"
											{...field}
											disabled={isLoading}
											className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100 dark:placeholder:text-zinc-500"
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>

						<Button
							type="submit"
							className="w-full min-h-[40px] dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
							disabled={isLoading}
						>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Logging in...
								</>
							) : (
								"Log In"
							)}
						</Button>
					</form>
				</Form>

				<div className="text-center">
					<p className="text-sm text-gray-600 dark:text-[#A1A1AA]">
						Don't have an account?{" "}
						<button
							type="button"
							onClick={() => navigate("/signup")}
							className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
						>
							Sign up
						</button>
					</p>
				</div>
			</div>
		</div>
	);
}
