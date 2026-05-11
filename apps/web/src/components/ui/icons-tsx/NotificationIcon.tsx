import React from "react";
import { Bell } from "lucide-react";

interface NotificationIconProps {
	size?: "sm" | "md" | "lg";
	className?: string;
}

export const NotificationIcon: React.FC<NotificationIconProps> = ({
	size = "md",
	className = "",
}) => {
	const sizeClasses = {
		sm: "h-4 w-4",
		md: "h-6 w-6",
		lg: "h-6 w-6",
	};

	const containerSizeClasses = {
		sm: "h-6 w-6",
		md: "h-8 w-8",
		lg: "h-12 w-12",
	};

	return (
		<div
			className={`
        ${containerSizeClasses[size]}
        bg-info-soft
        rounded-lg
        flex
        items-center
        justify-center
        ${className}
      `}
		>
			<Bell
				className={`
          ${sizeClasses[size]}
          text-info
        `}
			/>
		</div>
	);
};

export default NotificationIcon;
