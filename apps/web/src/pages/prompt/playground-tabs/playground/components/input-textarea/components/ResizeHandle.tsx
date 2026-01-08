import { NotchesIcon } from "@phosphor-icons/react";

interface ResizeHandleProps {
	onResizeStart: (e: React.MouseEvent) => void;
}

export const ResizeHandle = ({ onResizeStart }: ResizeHandleProps) => {
	return (
		<div
			className="absolute right-0 bottom-0 w-4 h-4 cursor-ns-resize flex items-end justify-end select-none bg-transparent z-10"
			onMouseDown={onResizeStart}
			style={{ userSelect: "none" }}
			aria-label="Resize textarea"
			role="slider"
			tabIndex={0}
		>
			<div className="w-[13px] h-[13px] flex items-end justify-end">
				<NotchesIcon />
			</div>
		</div>
	);
};
