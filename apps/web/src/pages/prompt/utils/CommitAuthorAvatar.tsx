import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { getAvatarColor, getAvatarInitial, getAvatarUrl } from "@/lib/avatarUtils";

export interface CommitAuthorAvatarProps {
	author: { name: string; picture?: string | null; avatar?: string | null };
	size?: string;
	textSize?: string;
	rounded?: string;
}

export function CommitAuthorAvatar({ 
	author, 
	size = "h-5 w-5",
	textSize = "text-[10px]",
	rounded = "rounded-full"
}: CommitAuthorAvatarProps) {
	const [imageLoaded, setImageLoaded] = useState(false);
	const [imageError, setImageError] = useState(false);

	const initial = getAvatarInitial(author.name ?? "U");
	const colorClass = getAvatarColor(author.name ?? "U");
	const avatarUrl = getAvatarUrl(author);
	const hasPicture = Boolean(avatarUrl);

	// Предзагрузка изображения
	useEffect(() => {
		if (!hasPicture || !avatarUrl) {
			setImageLoaded(false);
			setImageError(false);
			return;
		}

		setImageLoaded(false);
		setImageError(false);

		const img = new Image();
		img.src = avatarUrl;

		img.onload = () => {
			setImageLoaded(true);
			setImageError(false);
		};

		img.onerror = () => {
			setImageLoaded(false);
			setImageError(true);
		};

		return () => {
			img.onload = null;
			img.onerror = null;
		};
	}, [avatarUrl, hasPicture]);

	return (
		<Avatar className={`${size} ${rounded} cursor-default select-none`}>
			{hasPicture && !imageLoaded && !imageError && (
				<div className={`${size} ${rounded} bg-muted/40 animate-pulse`} />
			)}
			{hasPicture && imageLoaded && !imageError && avatarUrl && (
				<AvatarImage
					src={avatarUrl}
					alt={author.name}
					referrerPolicy="no-referrer"
					className={rounded}
				/>
			)}
			{(!hasPicture || imageError) && (
				<AvatarFallback className={`${rounded} ${textSize} font-bold ${colorClass} cursor-default select-none`}>
					{initial}
				</AvatarFallback>
			)}
		</Avatar>
	);
}
