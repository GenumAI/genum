import type { ReactNode } from "react";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Brush from "@/assets/brush.svg";
import Compress from "@/assets/compress.svg";

interface ChatModalDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	messagesCount: number;
	onNewChat: (e: React.MouseEvent<HTMLButtonElement>) => void;
	children: ReactNode;
}

export const ChatModalDialog = ({
	isOpen,
	onOpenChange,
	messagesCount,
	onNewChat,
	children,
}: ChatModalDialogProps) => {
	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange} modal>
			<DialogContent isDialogClose={false} className={"max-w-3xl max-h-[90vh] gap-3"}>
				<div className="flex items-center justify-between h-fit">
					<div className="flex items-center gap-2">
						<h2 className="text-lg font-semibold">Canvas Chat</h2>
						{!!messagesCount && (
							<Button
								variant="secondary"
								size="icon"
								className="h-5 w-5 [&_svg]:size-4 rounded-full text-foreground"
								onClick={onNewChat}
							>
								<Brush />
							</Button>
						)}
					</div>
					<DialogClose
						aria-label="Close"
						className="rounded-md bg-transparent text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-ring disabled:opacity-50 hover:bg-secondary/80 [&_svg]:pointer-events-none [&_svg]:shrink-0"
					>
						<Compress />
					</DialogClose>
				</div>

				<div className="flex flex-col flex-grow overflow-hidden">{children}</div>
			</DialogContent>
		</Dialog>
	);
};
