import { useState, type Dispatch, type SetStateAction } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FileMetadata } from "@/api/files";
import FileIcon from "@/components/ui/icons-tsx/FileIcon";
import type { TestCaseFile } from "@/types/TestСase";
import FileSelectDialog from "@/pages/files/components/FileSelectDialog";
import { usePlaygroundTestcaseFiles } from "@/pages/prompt/playground-tabs/playground/hooks/usePlaygroundTestcaseFiles";

interface SelectedFilesListProps {
	selectedFiles: FileMetadata[];
	setSelectedFiles: Dispatch<SetStateAction<FileMetadata[]>>;
	testcaseId: string | null;
	promptId: number | undefined;
	testcaseFiles?: TestCaseFile[];
	maxFiles?: number;
}

const SelectedFilesList: React.FC<SelectedFilesListProps> = ({
	selectedFiles,
	setSelectedFiles,
	testcaseId,
	promptId,
	testcaseFiles,
	maxFiles = 3,
}) => {
	const [isFileDialogOpen, setIsFileDialogOpen] = useState(false);
	const { handleFileSelect, handleFileRemove } = usePlaygroundTestcaseFiles({
		testcaseId,
		promptId,
		testcaseFiles,
		selectedFiles,
		setSelectedFiles,
	});

	return (
		<>
			<div className="flex items-center gap-2 flex-1 min-w-0">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => setIsFileDialogOpen(true)}
					disabled={selectedFiles.length >= maxFiles}
					className="h-[28px] flex-shrink-0 border border-border bg-muted/60 px-2 text-[12px] text-foreground hover:bg-muted/80 dark:border-border dark:bg-background dark:hover:bg-muted"
				>
					<Plus className="h-3 w-3 mr-1.5" />
					Add files
				</Button>

				<div className="flex items-center gap-2 flex-1 min-w-0">
					{selectedFiles.map((file) => (
						<div
							key={file.id}
							className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50 border border-border text-xs flex-shrink-0 max-w-[120px]"
						>
							<div className="flex-shrink-0">
								<FileIcon contentType={file.contentType} size="sm" />
							</div>
							<span className="truncate text-xs min-w-0">{file.name}</span>
							<Button
								variant="ghost"
								size="sm"
								className="h-4 w-4 p-0 hover:bg-destructive/10 flex-shrink-0"
								onClick={() => handleFileRemove(file.id)}
							>
								<X className="h-3 w-3" />
							</Button>
						</div>
					))}
				</div>
			</div>

			<FileSelectDialog
				open={isFileDialogOpen}
				setOpen={setIsFileDialogOpen}
				selectedFiles={selectedFiles}
				onSelect={handleFileSelect}
				maxFiles={maxFiles}
			/>
		</>
	);
};

export default SelectedFilesList;
