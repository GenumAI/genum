import { NotchesIcon } from "@phosphor-icons/react";

interface ResizeHandleProps {
	isExpanded: boolean;
	onResizeStart: (e: React.MouseEvent) => void;
	editorHeight?: number;
}

export const ResizeHandle = ({ isExpanded, onResizeStart, editorHeight }: ResizeHandleProps) => {
	if (isExpanded) return null;

	const currentHeight = editorHeight || 130;

	return (
		<div className="relative w-full">
			<div className="w-full h-px bg-border" />
			<div
				className="absolute right-0 bottom-0 w-4 h-4 cursor-ns-resize flex items-end justify-end select-none bg-transparent z-10"
				onMouseDown={onResizeStart}
				style={{ userSelect: "none" }}
				aria-label="Resize editor"
				role="slider"
				aria-valuemin={130}
				aria-valuemax={1000}
				aria-valuenow={currentHeight}
				aria-orientation="vertical"
				tabIndex={0}
			>
				<div className="w-[13px] h-[13px] flex items-end justify-end">
					<NotchesIcon />
				</div>
			</div>
		</div>
	);
};
