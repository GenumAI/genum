import { ChevronDown, ChevronUp } from "lucide-react";
import { Button, ButtonWithLoader } from "@/components/ui/button";
import Brush from "@/assets/brush.svg";
import Expand from "@/assets/expand.svg";

interface ChatHeaderProps {
	isOpen: boolean;
	messagesCount: number;
	onToggle: () => void;
	onNewChat: (e: React.MouseEvent<HTMLButtonElement>) => void;
	onExpand: () => void;
}

export const ChatHeader = ({
	isOpen,
	messagesCount,
	onToggle,
	onNewChat,
	onExpand,
}: ChatHeaderProps) => {
	return (
		<button
			type="button"
			onClick={onToggle}
			className="cursor-pointer flex items-center justify-between focus:outline-none w-full text-left"
		>
			<div className="flex items-center gap-[6px]">
				<h2 className="text-foreground font-sans text-[14px] not-italic font-bold leading-[20px]">
					Chat
				</h2>
				{!!messagesCount && (
					<ButtonWithLoader
						variant="secondary"
						size="icon"
						className="h-5 w-5 [&_svg]:size-4 rounded-full text-foreground"
						onClick={(e) => {
							e.stopPropagation();
							onNewChat(e);
						}}
						isWithoutLoader
					>
						<Brush />
					</ButtonWithLoader>
				)}
			</div>

			<div className="flex items-center gap-3">
				{isOpen && (
					<Button
						variant="secondary"
						size="icon"
						className="h-5 w-5 [&_svg]:size-3 text-foreground"
						onClick={(e) => {
							e.stopPropagation();
							onExpand();
						}}
					>
						<Expand />
					</Button>
				)}

				<button
					type="button"
					className="text-[#18181B] dark:text-white"
					onClick={(e) => {
						e.stopPropagation();
						onToggle();
					}}
				>
					{isOpen ? (
						<ChevronUp className="w-4 h-4" />
					) : (
						<ChevronDown className="w-4 h-4" />
					)}
				</button>
			</div>
		</button>
	);
};
