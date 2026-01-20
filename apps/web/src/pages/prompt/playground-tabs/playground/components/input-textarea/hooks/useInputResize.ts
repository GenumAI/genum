import { useState, useEffect } from "react";

interface UseInputResizeProps {
	minHeight?: number;
}

export const useInputResize = ({ minHeight = 140 }: UseInputResizeProps = {}) => {
	const [textareaHeight, setTextareaHeight] = useState(minHeight);
	const [isResizing, setIsResizing] = useState(false);
	const [startY, setStartY] = useState(0);
	const [startHeight, setStartHeight] = useState(minHeight);

	useEffect(() => {
		if (!isResizing) return;

		const handleMouseMove = (e: MouseEvent) => {
			const newHeight = Math.max(minHeight, startHeight + (e.clientY - startY));
			setTextareaHeight(newHeight);
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
	}, [isResizing, startHeight, startY, minHeight]);

	const handleResizeStart = (e: React.MouseEvent) => {
		setIsResizing(true);
		setStartY(e.clientY);
		setStartHeight(textareaHeight);
		e.stopPropagation();
	};

	return {
		textareaHeight,
		isResizing,
		handleResizeStart,
	};
};
