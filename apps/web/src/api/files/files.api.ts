import { apiClient, type ApiRequestConfig } from "../client";

export interface FileMetadata {
	id: string;
	key: string;
	name: string;
	size: number;
	contentType: string;
	projectId: number;
	createdAt: string;
}

export interface FileListResponse {
	files: FileMetadata[];
}

export interface FileUploadResponse {
	file: FileMetadata;
}

export interface FileUrlResponse {
	url: string;
}

export const filesApi = {
	/**
	 * Upload a file
	 */
	async uploadFile(file: File): Promise<FileMetadata> {
		const formData = new FormData();
		formData.append("file", file);

		const response = await apiClient.post<FileUploadResponse>("/files", formData, {
			withContentType: false, // Let axios handle FormData content type
		} as ApiRequestConfig);

		return response.data.file;
	},

	/**
	 * List all files for the current project
	 */
	async listFiles(): Promise<FileMetadata[]> {
		const response = await apiClient.get<FileListResponse>("/files");
		return response.data.files;
	},

	/**
	 * Get signed URL for file download/view
	 */
	async getFileUrl(fileId: string, expiresInSeconds: number = 3600): Promise<string> {
		const response = await apiClient.get<FileUrlResponse>(`/files/${fileId}/url`, {
			params: { expiresIn: expiresInSeconds },
		});
		return response.data.url;
	},

	/**
	 * Delete a file
	 */
	async deleteFile(fileId: string): Promise<void> {
		await apiClient.delete(`/files/${fileId}`);
	},
};
