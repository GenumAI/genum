import { useMutation, useQueryClient } from "@tanstack/react-query";
import { filesApi } from "@/api/files";
import { fileKeys } from "@/query-keys/files.keys";

export function useUploadProjectFile() {
	const queryClient = useQueryClient();

	const { mutateAsync: uploadFile, isPending: isUploading } = useMutation({
		mutationFn: async (file: File) => filesApi.uploadFile(file),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: fileKeys.all() });
		},
	});

	return {
		uploadFile,
		isUploading,
	};
}
