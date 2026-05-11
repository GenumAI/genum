import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Inbox, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
	onUpload: (file: File) => Promise<void>;
	loading?: boolean;
	accept?: string;
	maxSize?: number;
	className?: string;
	title?: string;
	description?: string;
	helperText?: string;
	compact?: boolean;
	largeCopy?: boolean;
	minHeight?: string;
}

export interface FileDropzoneHandle {
	openPicker: () => void;
}

const DEFAULT_ACCEPT = "image/*,application/pdf";
const DEFAULT_MAX_SIZE = 50 * 1024 * 1024;

const validateFile = (file: File, maxSize: number): string | null => {
	if (file.size > maxSize) {
		return `File size exceeds ${Math.round(maxSize / 1024 / 1024)}MB limit`;
	}

	const isImage = file.type.startsWith("image/");
	const isPdf = file.type === "application/pdf";

	if (!isImage && !isPdf) {
		return "Only images and PDF files are allowed";
	}

	return null;
};

const FileDropzone = forwardRef<FileDropzoneHandle, FileDropzoneProps>(
	(
		{
			onUpload,
			loading = false,
			accept = DEFAULT_ACCEPT,
			maxSize = DEFAULT_MAX_SIZE,
			className,
			title,
			description = "Чтобы добавить файлы, просто кликни или перенеси файлы в эту зону.",
			helperText,
			compact = false,
			largeCopy = false,
			minHeight,
		},
		ref,
	) => {
		const [error, setError] = useState<string | null>(null);
		const [isDragging, setIsDragging] = useState(false);
		const fileInputRef = useRef<HTMLInputElement>(null);

		useImperativeHandle(ref, () => ({
			openPicker: () => fileInputRef.current?.click(),
		}));

		const resetInput = () => {
			setError(null);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		};

		const handleFileSelect = (file: File) => {
			const validationError = validateFile(file, maxSize);
			if (validationError) {
				setError(validationError);
				return;
			}

			setError(null);
			void (async () => {
				try {
					await onUpload(file);
					resetInput();
				} catch (err) {
					setError(err instanceof Error ? err.message : "Failed to upload file");
				}
			})();
		};

		const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (file) {
				handleFileSelect(file);
			}
		};

		const handleDrop = (e: React.DragEvent<HTMLButtonElement>) => {
			e.preventDefault();
			setIsDragging(false);

			const file = e.dataTransfer.files?.[0];
			if (file) {
				handleFileSelect(file);
			}
		};

		return (
			<div className={cn("space-y-4", className)}>
				<button
					type="button"
					onDrop={handleDrop}
					onDragOver={(e) => {
						e.preventDefault();
						setIsDragging(true);
					}}
					onDragLeave={(e) => {
						e.preventDefault();
						setIsDragging(false);
					}}
					onClick={() => fileInputRef.current?.click()}
					className={cn(
						"w-full rounded-xl border-2 border-dashed text-center transition-colors",
						compact ? "px-6 py-10" : "px-6 py-8",
						isDragging
							? "border-primary bg-primary/5"
							: "border-muted-foreground/25 hover:border-muted-foreground/50",
						loading && "cursor-wait opacity-80",
					)}
					disabled={loading}
					style={minHeight ? { minHeight } : undefined}
				>
					<input
						ref={fileInputRef}
						type="file"
						accept={accept}
						onChange={handleFileInputChange}
						className="hidden"
					/>

					<div className="flex flex-col items-center gap-5">
						<div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/80 bg-background/50 shadow-sm">
							{loading ? (
								<Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
							) : title ? (
								<Inbox className="h-7 w-7 text-foreground" strokeWidth={1.8} />
							) : (
								<Upload
									className={cn(
										"text-muted-foreground",
										largeCopy ? "h-10 w-10" : "h-7 w-7",
									)}
								/>
							)}
						</div>

						<div className="flex flex-col gap-2">
							{title && (
								<p className="text-center text-[20px] font-semibold leading-[28px] tracking-wide text-foreground">
									{title}
								</p>
							)}
							<p
								className={cn(
									"text-center text-muted-foreground",
									largeCopy
										? "text-[14px] text-muted-foreground"
										: title
											? "text-base sm:text-lg"
											: "text-sm font-medium text-foreground",
								)}
							>
								{description}
							</p>
							<p
								className={cn(
									"text-center text-muted-foreground",
									largeCopy ? "text-[14px]" : "text-xs",
								)}
							>
								{helperText ||
									`Images and PDF files only (max ${Math.round(maxSize / 1024 / 1024)}MB)`}
							</p>
						</div>
					</div>
				</button>

				{error && (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				)}
			</div>
		);
	},
);

export default FileDropzone;
