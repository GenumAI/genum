import { useState, useEffect } from "react";

interface UseEditorResizeProps {
	isExpanded: boolean;
	editorHeight?: number;
	setEditorHeight?: (height: number) => void;
}

export const useEditorResize = ({
	isExpanded,
	editorHeight,
	setEditorHeight,
}: UseEditorResizeProps) => {
	const [isResizing, setIsResizing] = useState(false);
	const [startY, setStartY] = useState(0);
	const [startHeight, setStartHeight] = useState(0);

	useEffect(() => {
		if (!isResizing || isExpanded) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (setEditorHeight) {
				const newHeight = Math.max(130, startHeight + (e.clientY - startY));
				setEditorHeight(newHeight);
			}
		};

		const handleMouseUp = () => {
			setIsResizing(false);
		};

		window.addEventListener("mousemove", handleMouseMove);
		window.addEventListener("mouseup", handleMouseUp);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			window.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isResizing, isExpanded, setEditorHeight, startHeight, startY]);

	const handleResizeStart = (e: React.MouseEvent) => {
		setIsResizing(true);
		setStartY(e.clientY);
		setStartHeight(editorHeight || 130);
		e.stopPropagation();
	};

	return {
		isResizing,
		handleResizeStart,
	};
};
