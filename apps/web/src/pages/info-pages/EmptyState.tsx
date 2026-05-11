import { Inbox, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

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

interface EmptyStateDropzoneProps {
	onUpload: (file: File) => Promise<void>;
	loading?: boolean;
	accept?: string;
	maxSize?: number;
	helperText?: string;
}

interface EmptyStateProps {
	title: string;
	description: string;
	minHeight?: string;
	className?: string;
	withBackground?: boolean;
	children?: ReactNode;
	dropzone?: EmptyStateDropzoneProps;
}

export const EmptyState = ({
	title,
	description,
	minHeight = "361px",
	className,
	withBackground = true,
	children,
	dropzone,
}: EmptyStateProps) => {
	const [error, setError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const isDropzone = Boolean(dropzone);
	const isLoading = dropzone?.loading ?? false;
	const maxSize = dropzone?.maxSize ?? DEFAULT_MAX_SIZE;

	const handleFileSelect = (file: File) => {
		if (!dropzone || isLoading) {
			return;
		}

		const validationError = validateFile(file, maxSize);
		if (validationError) {
			setError(validationError);
			return;
		}

		setError(null);
		void (async () => {
			try {
				await dropzone.onUpload(file);
				if (fileInputRef.current) {
					fileInputRef.current.value = "";
				}
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to upload file");
			}
		})();
	};

	const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	const handleDrop = (e: DragEvent<HTMLElement>) => {
		if (!dropzone) {
			return;
		}

		e.preventDefault();
		setIsDragging(false);

		const file = e.dataTransfer.files?.[0];
		if (file) {
			handleFileSelect(file);
		}
	};

	const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
		if (!dropzone || isLoading) {
			return;
		}

		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			fileInputRef.current?.click();
		}
	};

	return (
		<section
			className={cn(
				"flex w-full items-center justify-center rounded-xl border border-dashed border-border p-6 shadow-none",
				withBackground && "bg-background",
				isDropzone && "cursor-pointer transition-colors hover:border-muted-foreground/50",
				isDragging && "border-primary bg-primary/5",
				isLoading && "cursor-wait opacity-80",
				className,
			)}
			style={{ minHeight }}
			aria-label="Empty state"
			aria-disabled={isLoading}
			role={isDropzone ? "button" : undefined}
			tabIndex={isDropzone ? 0 : undefined}
			onClick={isDropzone && !isLoading ? () => fileInputRef.current?.click() : undefined}
			onDrop={isDropzone ? handleDrop : undefined}
			onDragOver={
				isDropzone
					? (e) => {
							e.preventDefault();
							setIsDragging(true);
						}
					: undefined
			}
			onDragLeave={
				isDropzone
					? (e) => {
							e.preventDefault();
							setIsDragging(false);
						}
					: undefined
			}
			onKeyDown={isDropzone ? handleKeyDown : undefined}
		>
			{dropzone && (
				<input
					ref={fileInputRef}
					type="file"
					accept={dropzone.accept ?? DEFAULT_ACCEPT}
					onChange={handleFileInputChange}
					className="hidden"
				/>
			)}

			<div className="flex w-full max-w-[560px] flex-col items-center gap-6 text-muted-foreground">
				<div className="flex items-center justify-center rounded-xl h-12 w-12 border border-border shadow-sm text-foreground">
					{isLoading ? (
						<Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.5} />
					) : (
						<Inbox className="h-6 w-6" strokeWidth={1.5} />
					)}
				</div>

				<div className="flex flex-col gap-2">
					<span className="text-foreground font-semibold text-[20px] leading-[28px] text-center tracking-wide">
						{title}
					</span>
					<span className="text-muted-foreground text-[14px] text-center">{description}</span>
					{dropzone?.helperText && (
						<span className="text-muted-foreground text-[14px] text-center">
							{dropzone.helperText}
						</span>
					)}
				</div>

				{children}

				{error && (
					<div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				)}
			</div>
		</section>
	);
};
