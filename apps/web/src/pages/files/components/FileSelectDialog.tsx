import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FileMetadata } from "@/api/files";
import { Loader2 } from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import FileUploadDialog from "./FileUploadDialog";
import FileIcon from "@/components/ui/icons-tsx/FileIcon";
import { formatFileSize, getFileTypeLabel } from "../utils/fileUtils";
import { useProjectFiles } from "../hooks/useProjectFiles";
import { useUploadProjectFile } from "../hooks/useUploadProjectFile";

interface FileSelectDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	selectedFiles: FileMetadata[];
	onSelect: (files: FileMetadata[]) => void;
	maxFiles?: number;
}

const FileSelectDialog: React.FC<FileSelectDialogProps> = ({
	open,
	setOpen,
	selectedFiles,
	onSelect,
	maxFiles = 3,
}) => {
	const [localSelected, setLocalSelected] = useState<FileMetadata[]>(selectedFiles);
	const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

	const { data: files = [], isLoading } = useProjectFiles({ enabled: open });
	const { uploadFile, isUploading } = useUploadProjectFile();

	useEffect(() => {
		if (open) {
			setLocalSelected(selectedFiles);
		}
	}, [open, selectedFiles]);

	const isFileSelected = (file: FileMetadata) => {
		return localSelected.some((f) => f.id === file.id);
	};

	const toggleFile = (file: FileMetadata) => {
		if (isFileSelected(file)) {
			setLocalSelected(localSelected.filter((f) => f.id !== file.id));
		} else {
			if (localSelected.length >= maxFiles) {
				return;
			}
			setLocalSelected([...localSelected, file]);
		}
	};

	const handleConfirm = () => {
		onSelect(localSelected);
		setOpen(false);
	};

	const handleCancel = () => {
		setLocalSelected(selectedFiles);
		setOpen(false);
	};

	const handleUpload = async (file: File) => {
		await uploadFile(file);
		setUploadDialogOpen(false);
	};

	return (
		<>
			<Dialog open={open} onOpenChange={handleCancel}>
				<DialogContent className="sm:max-w-[700px] max-h-[80vh] flex flex-col">
					<DialogHeader>
						<DialogTitle>Select Files</DialogTitle>
					</DialogHeader>

					<div className="flex flex-col gap-4 flex-1 min-h-0">
						<div className="flex items-center justify-between">
							<div className="text-sm text-muted-foreground">
								Select up to {maxFiles} files ({localSelected.length}/{maxFiles}{" "}
								selected)
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setUploadDialogOpen(true)}
								className="flex items-center gap-2"
							>
								<Plus className="h-4 w-4" />
								Add new file
							</Button>
						</div>

						{isLoading ? (
							<div className="flex items-center justify-center py-8 flex-1">
								<Loader2 className="h-6 w-6 animate-spin" />
								<span className="ml-2">Loading files...</span>
							</div>
						) : files.length === 0 ? (
							<div className="text-center py-8 text-muted-foreground flex-1">
								No files available in this project
							</div>
						) : (
							<div className="border rounded-md overflow-hidden flex-1 min-h-0 flex flex-col">
								<div className="overflow-y-auto flex-1">
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead className="w-12"></TableHead>
												<TableHead>Name</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Size</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{files.map((file) => {
												const selected = isFileSelected(file);
												const canSelect =
													!selected && localSelected.length < maxFiles;

												return (
													<TableRow
														key={file.id}
														onClick={() => toggleFile(file)}
														className={cn(
															"cursor-pointer h-12 transition-none",
															selected &&
																"bg-primary/10 hover:bg-primary/10",
															!selected &&
																!canSelect &&
																"opacity-50 cursor-not-allowed hover:bg-transparent",
															!selected &&
																canSelect &&
																"hover:bg-muted/30",
														)}
													>
														<TableCell
															className="w-12 h-12"
															onClick={(e) => e.stopPropagation()}
														>
															<div className="flex items-center h-4">
																<Checkbox
																	checked={selected}
																	onCheckedChange={() =>
																		toggleFile(file)
																	}
																	disabled={
																		!canSelect && !selected
																	}
																/>
															</div>
														</TableCell>
														<TableCell>
															<div className="flex items-center gap-2">
																<FileIcon
																	contentType={file.contentType}
																/>
																<div className="font-medium">
																	{file.name}
																</div>
															</div>
														</TableCell>
														<TableCell>
															{getFileTypeLabel(file.contentType)}
														</TableCell>
														<TableCell>
															{formatFileSize(file.size)}
														</TableCell>
													</TableRow>
												);
											})}
										</TableBody>
									</Table>
								</div>
							</div>
						)}
					</div>

					<div className="flex justify-end gap-2 mt-4">
						<Button variant="outline" onClick={handleCancel}>
							Cancel
						</Button>
						<Button onClick={handleConfirm} disabled={localSelected.length === 0}>
							Confirm ({localSelected.length})
						</Button>
					</div>
				</DialogContent>
			</Dialog>

			<FileUploadDialog
				open={uploadDialogOpen}
				setOpen={setUploadDialogOpen}
				onUpload={handleUpload}
				loading={isUploading}
			/>
		</>
	);
};

export default FileSelectDialog;
