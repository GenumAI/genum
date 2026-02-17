import { useMutation, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/api/files";

export function useUploadProjectFile() {
	const queryClient = useQueryClient();

	const { mutateAsync: uploadFile, isPending: isUploading } = useMutation({
		mutationFn: async (file: File) => filesApi.uploadFile(file),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["files"] });
		},
	});

	return {
		uploadFile,
		isUploading,
	};
}
