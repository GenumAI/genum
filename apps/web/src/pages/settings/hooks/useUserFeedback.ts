import { useState, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { userApi } from "@/api/user";

export function useUserFeedback() {
	const { toast } = useToast();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const submitFeedback = useCallback(
		async (type: string, subject: string, message: string) => {
			try {
				setIsSubmitting(true);

				const apiType = type.toLowerCase().replace(/ /g, "_");

				await userApi.sendFeedback({
					type: apiType,
					subject: subject.trim(),
					message: message.trim(),
				});

				toast({
					title: "Feedback sent",
					description: "Thank you for your feedback!",
					duration: 3000,
				});

				return true;
			} catch (error) {
				console.error("Error sending feedback:", error);
				toast({
					title: "Error",
					description: "Failed to send feedback. Please try again.",
					variant: "destructive",
					duration: 3000,
				});
				return false;
			} finally {
				setIsSubmitting(false);
			}
		},
		[toast],
	);

	return {
		isSubmitting,
		submitFeedback,
	};
}
