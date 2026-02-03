import { useState, useCallback } from "react";
import { useToast } from "@/hooks/useToast";
import { useInvalidateCurrentUser } from "@/hooks/useCurrentUser";
import { userApi } from "@/api/user";

export function useUserProfile() {
	const { toast } = useToast();
	const invalidateCurrentUser = useInvalidateCurrentUser();
	const [isUpdating, setIsUpdating] = useState(false);

	const updateName = useCallback(
		async (name: string) => {
			try {
				setIsUpdating(true);
				await userApi.updateUser({ name });

				toast({
					title: "Success",
					description: "Your name has been updated successfully.",
					variant: "default",
				});

				await invalidateCurrentUser();
				return true;
			} catch (error) {
				console.error("Error updating user name:", error);
				toast({
					title: "Error",
					description: "Failed to update your name. Please try again.",
					variant: "destructive",
				});
				return false;
			} finally {
				setIsUpdating(false);
			}
		},
		[toast, invalidateCurrentUser],
	);

	return {
		isUpdating,
		updateName,
	};
}
