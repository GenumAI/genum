import React from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkle, CircleNotch } from "phosphor-react";

export interface CommitDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	value: string;
	onChange: (value: string) => void;
	onCommit: () => void;
	onGenerate: () => void;
	isGenerating: boolean;
	isCommitting: boolean;
}

const CommitDialog: React.FC<CommitDialogProps> = ({
	open,
	onOpenChange,
	value,
	onChange,
	onCommit,
	onGenerate,
	isGenerating,
	isCommitting,
}) => {
	const textareaRef = React.useRef<HTMLTextAreaElement>(null);

	const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
			event.preventDefault();
			if (!isCommitting && value.trim()) {
				onCommit();
			}
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					textareaRef.current?.focus();
				}}
			>
				<DialogHeader>
					<DialogTitle>New Commit</DialogTitle>
				</DialogHeader>

				<div className="mb-2">
					<div className="flex items-center justify-between mb-2">
						<p className="text-xs text-foreground/50 font-medium">Commit message</p>
						<button
							type="button"
							aria-label="Generate commit message automatically"
							className="p-1.5 rounded-md transition-all hover:bg-[#437BEF]/10 text-[#437BEF] disabled:opacity-50 disabled:cursor-not-allowed group relative"
							disabled={isCommitting || isGenerating}
							onClick={onGenerate}
						>
							{isGenerating ? (
								<CircleNotch size={18} className="animate-spin" />
							) : (
								<Sparkle size={18} weight="bold" />
							)}
						</button>
					</div>
					<Textarea
						ref={textareaRef}
						placeholder="Enter message"
						value={value}
						onChange={(e) => onChange(e.target.value)}
						onKeyDown={handleKeyDown}
						className="min-h-[140px] resize-none"
					/>
					<p className="pt-2 text-xs text-muted-foreground text-right">
						<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
							Ctrl
						</kbd>{" "}
						+{" "}
						<kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
							Enter
						</kbd>{" "}
						to commit
					</p>
				</div>

				<DialogFooter className="mt-4 gap-2">
					<Button
						variant="outline"
						className="flex-1 sm:flex-none"
						onClick={() => onOpenChange(false)}
					>
						Cancel
					</Button>
					<Button
						className="flex-1 sm:flex-none"
						onClick={onCommit}
						disabled={isCommitting || !value.trim()}
					>
						{isCommitting && <CircleNotch size={16} className="mr-2 animate-spin" />}
						Commit
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

export default CommitDialog;
