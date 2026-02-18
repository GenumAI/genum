export const isImageFile = (contentType: string): boolean => contentType.startsWith("image/");

export const isPdfFile = (contentType: string): boolean => contentType === "application/pdf";

export const getFileTypeLabel = (contentType: string): string => {
	if (isImageFile(contentType)) {
		return "Image";
	}

	if (isPdfFile(contentType)) {
		return "PDF";
	}

	return contentType;
};

export const getFileIconType = (
	contentType: string,
): "image" | "pdf" | "file" => {
	if (isImageFile(contentType)) {
		return "image";
	}

	if (isPdfFile(contentType)) {
		return "pdf";
	}

	return "file";
};

export const formatFileSize = (bytes: number): string => {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};
