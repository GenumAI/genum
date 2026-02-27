import { memo } from "react";
import { Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Slide } from "../types";

interface SlideCardProps {
	slide: Slide;
	isActive: boolean;
	onSelect: (id: string) => void;
}

function SlideCardComponent({ slide, isActive, onSelect }: SlideCardProps) {
	return (
		<button
			type="button"
			onClick={() => onSelect(slide.id)}
			aria-pressed={isActive}
			className={cn(
				"w-full flex flex-col items-start gap-3 rounded-xl transition text-left border bg-card",
				"hover:font-medium",
				isActive ? "border-transparent ring-0" : "border-transparent",
			)}
		>
			<div className="w-full aspect-[176/94] shrink-0 rounded-[2px] overflow-hidden bg-muted flex items-center justify-center">
				{slide.thumb ? (
					<img src={slide.thumb} alt={slide.title} className="w-full h-full object-cover" />
				) : (
					<Play className="w-5 h-5" />
				)}
			</div>
			<div className="text-[12px] leading-[126%] w-full line-clamp-2">{slide.title}</div>
		</button>
	);
}

export const SlideCard = memo(SlideCardComponent);
