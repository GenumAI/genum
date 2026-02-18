import { useQuery } from "@tanstack/react-query";
import { filesApi, type FileMetadata } from "@/api/files";

interface UseProjectFilesOptions {
	enabled?: boolean;
}

export function useProjectFiles({ enabled = true }: UseProjectFilesOptions = {}) {
	return useQuery<FileMetadata[]>({
		queryKey: ["files"],
		queryFn: () => filesApi.listFiles(),
		enabled,
	});
}
