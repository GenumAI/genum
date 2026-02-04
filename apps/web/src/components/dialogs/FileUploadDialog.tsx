import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useRef, useEffect } from "react";
import { Upload, X, File, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	onUpload: (file: File) => Promise<void>;
	loading?: boolean;
	accept?: string;
	maxSize?: number; // in bytes
}

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
	open,
	setOpen,
	onUpload,
	loading = false,
	accept = "image/*,application/pdf",
	maxSize = 50 * 1024 * 1024, // 50MB default
}) => {
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const dropZoneRef = useRef<HTMLDivElement>(null);

	// Reset state when dialog closes
	useEffect(() => {
		if (!open) {
			setSelectedFile(null);
			setError(null);
			setIsDragging(false);
		}
	}, [open]);

	const validateFile = (file: File): string | null => {
		// Check file size
		if (file.size > maxSize) {
			return `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`;
		}

		// Check file type
		const isImage = file.type.startsWith("image/");
		const isPdf = file.type === "application/pdf";

		if (!isImage && !isPdf) {
			return "Only images and PDF files are allowed";
		}

		return null;
	};

	const handleFileSelect = (file: File) => {
		const validationError = validateFile(file);
		if (validationError) {
			setError(validationError);
			setSelectedFile(null);
			return;
		}

		setError(null);
		setSelectedFile(file);
	};

	const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);

		const file = e.dataTransfer.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(true);
	};

	const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragging(false);
	};

	const handleUpload = async () => {
		if (!selectedFile) {
			return;
		}

		try {
			await onUpload(selectedFile);
			setOpen(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to upload file");
		}
	};

	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	};

	const getFileIcon = (file: File) => {
		if (file.type.startsWith("image/")) {
			return <ImageIcon className="h-8 w-8 text-blue-500" />;
		}
		if (file.type === "application/pdf") {
			return <File className="h-8 w-8 text-red-500" />;
		}
		return <File className="h-8 w-8 text-gray-500" />;
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Upload File</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					{/* Drop Zone */}
					<div
						ref={dropZoneRef}
						onDrop={handleDrop}
						onDragOver={handleDragOver}
						onDragLeave={handleDragLeave}
						className={cn(
							"border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
							isDragging
								? "border-primary bg-primary/5"
								: "border-muted-foreground/25 hover:border-muted-foreground/50",
							selectedFile && "border-primary bg-primary/5",
						)}
						onClick={() => fileInputRef.current?.click()}
					>
						<input
							ref={fileInputRef}
							type="file"
							accept={accept}
							onChange={handleFileInputChange}
							className="hidden"
						/>

						{selectedFile ? (
							<div className="flex flex-col items-center gap-3">
								{getFileIcon(selectedFile)}
								<div className="space-y-1">
									<p className="text-sm font-medium">{selectedFile.name}</p>
									<p className="text-xs text-muted-foreground">
										{formatFileSize(selectedFile.size)}
									</p>
								</div>
								<Button
									variant="ghost"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										setSelectedFile(null);
										setError(null);
										if (fileInputRef.current) {
											fileInputRef.current.value = "";
										}
									}}
									className="mt-2"
								>
									<X className="h-4 w-4 mr-2" />
									Remove
								</Button>
							</div>
						) : (
							<div className="flex flex-col items-center gap-3">
								<Upload className="h-10 w-10 text-muted-foreground" />
								<div className="space-y-1">
									<p className="text-sm font-medium">
										Click to upload or drag and drop
									</p>
									<p className="text-xs text-muted-foreground">
										Images and PDF files only (max {Math.round(maxSize / 1024 / 1024)}MB)
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Error Message */}
					{error && (
						<div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
							{error}
						</div>
					)}
				</div>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
						Cancel
					</Button>
					<Button onClick={handleUpload} disabled={!selectedFile || loading}>
						{loading ? "Uploading..." : "Upload"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default FileUploadDialog;
