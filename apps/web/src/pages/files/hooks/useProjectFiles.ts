import { useQuery } from "@tanstack/react-query";
import { filesApi, type FileMetadata } from "@/api/files";
import { fileKeys } from "@/query-keys/files.keys";

interface UseProjectFilesOptions {
	enabled?: boolean;
}

export function useProjectFiles({ enabled = true }: UseProjectFilesOptions = {}) {
	return useQuery<FileMetadata[]>({
		queryKey: fileKeys.all(),
		queryFn: () => filesApi.listFiles(),
		enabled,
	});
}
