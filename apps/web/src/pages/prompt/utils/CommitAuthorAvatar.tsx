import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { getAvatarColor, getAvatarInitial, getAvatarUrl } from "@/lib/avatarUtils";

export interface CommitAuthorAvatarProps {
	author: { name: string; picture?: string | null; avatar?: string | null };
}

export function CommitAuthorAvatar({ author }: CommitAuthorAvatarProps) {
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
		<Avatar className="h-5 w-5 rounded-full">
			{hasPicture && !imageLoaded && !imageError && (
				<div className="h-5 w-5 rounded-full bg-muted/40 animate-pulse" />
			)}
			{hasPicture && imageLoaded && !imageError && avatarUrl && (
				<AvatarImage
					src={avatarUrl}
					alt={author.name}
					referrerPolicy="no-referrer"
					className="rounded-full"
				/>
			)}
			{(!hasPicture || imageError) && (
				<AvatarFallback className={`rounded-full text-[10px] font-bold ${colorClass}`}>
					{initial}
				</AvatarFallback>
			)}
		</Avatar>
	);
}
