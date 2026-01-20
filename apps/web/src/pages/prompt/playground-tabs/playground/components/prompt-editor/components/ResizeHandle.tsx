import { NotchesIcon } from "@phosphor-icons/react";

interface ResizeHandleProps {
	isExpanded: boolean;
	onResizeStart: (e: React.MouseEvent) => void;
	editorHeight?: number;
	minHeight?: number;
}

export const ResizeHandle = ({
	isExpanded,
	onResizeStart,
	editorHeight,
	minHeight = 130,
}: ResizeHandleProps) => {
	if (isExpanded) return null;

	const currentHeight = editorHeight || minHeight;

	return (
		<div className="relative w-full">
			<div className="w-full h-px bg-border" />
			<div
				className="absolute left-0 bottom-0 w-full h-1.5 cursor-ns-resize flex items-end justify-end select-none bg-transparent z-10"
				onMouseDown={onResizeStart}
				style={{ userSelect: "none" }}
				aria-label="Resize editor"
				role="slider"
				aria-valuemin={minHeight}
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
