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
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-[6px]">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="text-foreground font-sans text-[14px] font-bold leading-[20px] cursor-pointer"
        >
          Chat
        </button>

        {!!messagesCount && (
          <ButtonWithLoader
            variant="secondary"
            size="icon"
            className="h-5 w-5 [&_svg]:size-4 rounded-full text-foreground"
            onClick={onNewChat}
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
            onClick={onExpand}
          >
            <Expand />
          </Button>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-label={isOpen ? "Collapse chat" : "Expand chat"}
          className="text-[#18181B] dark:text-white"
        >
          {isOpen ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
};
