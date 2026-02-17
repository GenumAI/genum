import { File, Image as ImageIcon } from "lucide-react";
import { getFileIconType } from "../../../pages/files/utils/fileUtils";

interface FileIconProps {
	contentType: string;
	size?: "sm" | "md" | "lg";
}

const sizeClasses: Record<NonNullable<FileIconProps["size"]>, string> = {
	sm: "h-4 w-4",
	md: "h-5 w-5",
	lg: "h-8 w-8",
};

export default function FileIcon({ contentType, size = "md" }: FileIconProps) {
	const iconType = getFileIconType(contentType);
	const sizeClass = sizeClasses[size];

	if (iconType === "image") {
		return <ImageIcon className={`${sizeClass} text-blue-500`} />;
	}

	if (iconType === "pdf") {
		return <File className={`${sizeClass} text-red-500`} />;
	}

	return <File className={`${sizeClass} text-gray-500`} />;
}
