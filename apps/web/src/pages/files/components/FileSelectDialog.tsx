import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { FileMetadata } from "@/api/files";
import { Loader2, Plus } from "lucide-react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import FileIcon from "@/components/ui/icons-tsx/FileIcon";
import { formatFileSize, getFileTypeLabel } from "../utils/fileUtils";
import { useProjectFiles } from "../hooks/useProjectFiles";
import { useUploadProjectFile } from "../hooks/useUploadProjectFile";
import FileDropzone, { type FileDropzoneHandle } from "./FileDropzone";

interface FileSelectDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	selectedFiles: FileMetadata[];
	onSelect: (files: FileMetadata[]) => void;
	maxFiles?: number;
}

interface FileSelectDialogContentProps {
	selectedFiles: FileMetadata[];
	onSelect: (files: FileMetadata[]) => void;
	onCancel: () => void;
	maxFiles?: number;
}

const FileSelectDialogContent: React.FC<FileSelectDialogContentProps> = ({
	selectedFiles,
	onSelect,
	onCancel,
	maxFiles = 3,
}) => {
	const [localSelected, setLocalSelected] = useState<FileMetadata[]>(selectedFiles);
	const { data: files = [], isLoading } = useProjectFiles({ enabled: true });
	const { uploadFile, isUploading } = useUploadProjectFile();
	const dropzoneRef = useRef<FileDropzoneHandle>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

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
		onCancel();
	};

	const handleUpload = async (file: File) => {
		const uploadedFile = await uploadFile(file);
		setLocalSelected((current) => {
			if (current.some((item) => item.id === uploadedFile.id) || current.length >= maxFiles) {
				return current;
			}

			return [...current, uploadedFile];
		});
	};

	const handleManualFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			return;
		}

		await handleUpload(file);
		e.target.value = "";
	};

	return (
		<DialogContent className="flex max-h-[80vh] flex-col sm:max-w-[700px]">
			<DialogHeader>
				<DialogTitle>Select Files</DialogTitle>
			</DialogHeader>

			<input
				ref={fileInputRef}
				type="file"
				accept="image/*,application/pdf"
				onChange={(e) => {
					void handleManualFileSelect(e);
				}}
				className="hidden"
			/>

			<div className="flex min-h-0 flex-1 flex-col gap-4">
				<div className="flex items-center justify-between gap-3">
					<div className="text-sm text-muted-foreground">
						Select up to {maxFiles} files ({localSelected.length}/{maxFiles} selected)
					</div>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => fileInputRef.current?.click()}
						disabled={isUploading}
					>
						<Plus className="mr-2 h-4 w-4" />
						Add files
					</Button>
				</div>

				{isLoading ? (
					<div className="flex flex-1 items-center justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin" />
						<span className="ml-2">Loading files...</span>
					</div>
				) : files.length === 0 ? (
					<FileDropzone
						ref={dropzoneRef}
						onUpload={handleUpload}
						loading={isUploading}
						className="flex-1"
						compact={true}
					/>
				) : (
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border">
						<div className="flex-1 overflow-y-auto">
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
													selected && "bg-primary/10 hover:bg-primary/10",
													!selected &&
														!canSelect &&
														"cursor-not-allowed opacity-50 hover:bg-transparent",
													!selected && canSelect && "hover:bg-muted/30",
												)}
											>
												<TableCell
													className="h-12 w-12"
													onClick={(e) => e.stopPropagation()}
												>
													<div className="flex h-4 items-center">
														<Checkbox
															checked={selected}
															onCheckedChange={() => toggleFile(file)}
															disabled={!canSelect && !selected}
														/>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex items-center gap-2">
														<FileIcon contentType={file.contentType} />
														<div className="font-medium">
															{file.name}
														</div>
													</div>
												</TableCell>
												<TableCell>
													{getFileTypeLabel(file.contentType)}
												</TableCell>
												<TableCell>{formatFileSize(file.size)}</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						</div>
					</div>
				)}
			</div>

			<div className="mt-4 flex justify-end gap-2">
				<Button variant="outline" onClick={onCancel}>
					Cancel
				</Button>
				<Button onClick={handleConfirm} disabled={localSelected.length === 0}>
					Confirm ({localSelected.length})
				</Button>
			</div>
		</DialogContent>
	);
};

const FileSelectDialog: React.FC<FileSelectDialogProps> = ({
	open,
	setOpen,
	selectedFiles,
	onSelect,
	maxFiles = 3,
}) => {
	const handleCancel = () => {
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={handleCancel}>
			{open && (
				<FileSelectDialogContent
					selectedFiles={selectedFiles}
					onSelect={onSelect}
					onCancel={handleCancel}
					maxFiles={maxFiles}
				/>
			)}
		</Dialog>
	);
};

export default FileSelectDialog;
