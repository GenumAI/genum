import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import FileDropzone from "./FileDropzone";

interface FileUploadDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	onUpload: (file: File) => Promise<void>;
	loading?: boolean;
	accept?: string;
	maxSize?: number;
}

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({
	open,
	setOpen,
	onUpload,
	loading = false,
	accept = "image/*,application/pdf",
	maxSize = 50 * 1024 * 1024,
}) => {
	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-[500px]">
				<DialogHeader>
					<DialogTitle>Upload File</DialogTitle>
				</DialogHeader>

				<FileDropzone
					onUpload={async (file) => {
						await onUpload(file);
						setOpen(false);
					}}
					loading={loading}
					accept={accept}
					maxSize={maxSize}
				/>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
						Cancel
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default FileUploadDialog;
