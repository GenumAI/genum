import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { File, Image as ImageIcon } from "lucide-react";
import type { FileMetadata } from "@/api/files";

interface SelectedFilesListProps {
	files: FileMetadata[];
	onRemove: (fileId: string) => void;
}

const SelectedFilesList: React.FC<SelectedFilesListProps> = ({
	files,
	onRemove,
}) => {
	if (files.length === 0) {
		return null;
	}

	const getFileIcon = (file: FileMetadata) => {
		if (file.contentType.startsWith("image/")) {
			return <ImageIcon className="h-4 w-4 text-blue-500" />;
		}
		if (file.contentType === "application/pdf") {
			return <File className="h-4 w-4 text-red-500" />;
		}
		return <File className="h-4 w-4 text-gray-500" />;
	};

	return (
		<div className="flex items-center gap-2 flex-1 min-w-0">
			{files.map((file) => (
				<div
					key={file.id}
					className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border text-xs flex-shrink-0 max-w-[120px]"
				>
					<div className="flex-shrink-0">{getFileIcon(file)}</div>
					<span className="truncate text-xs min-w-0">{file.name}</span>
					<Button
						variant="ghost"
						size="sm"
						className="h-4 w-4 p-0 hover:bg-destructive/10 flex-shrink-0"
						onClick={() => onRemove(file.id)}
					>
						<X className="h-3 w-3" />
					</Button>
				</div>
			))}
		</div>
	);
};

export default SelectedFilesList;
