import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";

interface DeleteConfirmDialogProps {
	open: boolean;
	setOpen: (open: boolean) => void;
	confirmationHandler: (key: string, value: string) => void;
	loading: boolean;
}

const CreateMemoryDialog: React.FC<DeleteConfirmDialogProps> = ({
	open,
	setOpen,
	confirmationHandler,
	loading,
}) => {
	const [key, setKey] = useState("");
	const [value, setValue] = useState("");

	useEffect(() => {
		if (!open) {
			setKey("");
			setValue("");
		}
	}, [open]);

	const confirmHandler = () => {
		confirmationHandler(key, value);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create New Memory</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<p className="text-xs text-muted-foreground font-medium mb-2">Key</p>
						<Input
							placeholder="Enter key"
							value={key}
							onChange={(e) => setKey(e.target.value)}
						/>
					</div>
					<div>
						<p className="text-xs text-muted-foreground font-medium mb-2">Value</p>
						<Textarea
							placeholder="Enter value"
							value={value}
							onChange={(e) => setValue(e.target.value)}
						/>
					</div>
				</div>

				<DialogFooter className="mt-4">
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						onClick={confirmHandler}
						disabled={loading || !key.trim() || !value.trim()}
					>
						Create
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default CreateMemoryDialog;
