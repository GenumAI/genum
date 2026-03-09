import { useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { FileMetadata } from "@/api/files";
import { testcasesApi } from "@/api/testcases/testcases.api";
import type { TestCaseFile } from "@/types/TestСase";
import { testcaseKeys } from "@/query-keys/testcases.keys";

interface UsePlaygroundTestcaseFilesParams {
	testcaseId: string | null;
	promptId: number | undefined;
	testcaseFiles: TestCaseFile[] | undefined;
	selectedFiles: FileMetadata[];
	setSelectedFiles: Dispatch<SetStateAction<FileMetadata[]>>;
}

export function usePlaygroundTestcaseFiles({
	testcaseId,
	promptId,
	testcaseFiles,
	selectedFiles,
	setSelectedFiles,
}: UsePlaygroundTestcaseFilesParams) {
	const queryClient = useQueryClient();
	const { mutateAsync: addFileAsync } = useMutation({
		mutationKey: testcaseKeys.addFile(testcaseId ?? undefined),
		mutationFn: async (fileId: string) => {
			if (!testcaseId) return;
			await testcasesApi.addFileToTestcase(testcaseId, fileId);
		},
	});
	const { mutateAsync: removeFileAsync } = useMutation({
		mutationKey: testcaseKeys.removeFile(testcaseId ?? undefined),
		mutationFn: async (fileId: string) => {
			if (!testcaseId) return;
			await testcasesApi.removeFileFromTestcase(testcaseId, fileId);
		},
	});

	useEffect(() => {
		if (testcaseFiles && testcaseFiles.length > 0) {
			const mappedFiles: FileMetadata[] = testcaseFiles.map((tf) => ({
				id: tf.file.id,
				key: tf.file.key,
				name: tf.file.name,
				size: tf.file.size,
				contentType: tf.file.contentType,
				projectId: tf.file.projectId,
				organizationId: 0,
				uploadedBy: 0,
				createdAt: tf.file.createdAt,
			}));
			setSelectedFiles(mappedFiles);
			return;
		}

		if (!testcaseId) {
			setSelectedFiles([]);
		}
	}, [testcaseFiles, testcaseId, setSelectedFiles]);

	const invalidateTestcaseQueries = useCallback(async () => {
		if (!promptId || !testcaseId) {
			return;
		}

		await queryClient.invalidateQueries({
			queryKey: testcaseKeys.promptTestcases(promptId),
		});
		await queryClient.invalidateQueries({
			queryKey: testcaseKeys.byId(testcaseId),
		});
	}, [promptId, queryClient, testcaseId]);

	const handleFileSelect = useCallback(
		async (files: FileMetadata[]) => {
			setSelectedFiles(files);

			if (!testcaseId) {
				return;
			}

			try {
				const currentFileIds = testcaseFiles?.map((tf) => tf.fileId) || [];
				const newFileIds = files.map((f) => f.id);

				const filesToAdd = newFileIds.filter((id) => !currentFileIds.includes(id));
				const filesToRemove = currentFileIds.filter((id) => !newFileIds.includes(id));

				for (const fileId of filesToAdd) {
					await addFileAsync(fileId);
				}

				for (const fileId of filesToRemove) {
					await removeFileAsync(fileId);
				}

				await invalidateTestcaseQueries();
			} catch (error) {
				console.error("Failed to update testcase files:", error);
			}
		},
		[
			addFileAsync,
			invalidateTestcaseQueries,
			removeFileAsync,
			setSelectedFiles,
			testcaseFiles,
			testcaseId,
		],
	);

	const handleFileRemove = useCallback(
		async (fileId: string) => {
			const newFiles = selectedFiles.filter((f) => f.id !== fileId);
			setSelectedFiles(newFiles);

			if (!testcaseId) {
				return;
			}

			try {
				await removeFileAsync(fileId);
				await invalidateTestcaseQueries();
			} catch (error) {
				console.error("Failed to remove file from testcase:", error);
			}
		},
		[
			invalidateTestcaseQueries,
			removeFileAsync,
			selectedFiles,
			setSelectedFiles,
			testcaseId,
		],
	);

	return {
		handleFileSelect,
		handleFileRemove,
	};
}
