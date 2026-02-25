import { memo } from "react";
import { Card } from "@/components/ui/card";
import { SocialIcons } from "@/components/ui/icons-tsx/social-icons";
import { formatBalance } from "../utils/formatBalance";
import type { Slide } from "../types";

interface VideoPlayerCardProps {
	slide: Slide;
	balance: number | null;
	isLoadingBalance: boolean;
	errorBalance: string | null;
}

interface BalanceInfoProps {
	balance: number | null;
	isLoadingBalance: boolean;
	errorBalance: string | null;
}

const BalanceInfo = memo(function BalanceInfo({
	balance,
	isLoadingBalance,
	errorBalance,
}: BalanceInfoProps) {
	const statusMessage = isLoadingBalance
		? "Loading balance..."
		: errorBalance
			? errorBalance
			: "";

	return (
		<div className="mt-6 text-center">
			<p className="font-semibold text-[16px]">Your balance: {formatBalance(balance)}</p>

			<p
				className="text-[12px] mt-1 min-h-4"
				aria-live="polite"
			>
				<span
					className={
						isLoadingBalance
							? "text-muted-foreground"
							: errorBalance
								? "text-red-500"
								: "invisible"
					}
				>
					{statusMessage || "placeholder"}
				</span>
			</p>

			<p className="text-[14px] text-foreground max-w-xl mx-auto mt-2">
				This balance is shared across all vendors and models in Genum Lab. You can use it to
				run prompts, tests, and experiments with any supported provider.
			</p>

			<div className="mt-6">
				<p className="font-semibold text-[14px] mb-2 leading-[32px]">
					Join the Community That Builds With You!
				</p>
				<div className="flex justify-center">
					<SocialIcons />
				</div>
			</div>
		</div>
	);
});

function VideoPlayerCardComponent({
	slide,
	balance,
	isLoadingBalance,
	errorBalance,
}: VideoPlayerCardProps) {
	return (
		<Card className="p-0 px-[76px] shadow-none border-none flex flex-col items-center">
			<h1 className="text-[16px] md:text-xl font-bold mb-6 text-center">{slide.title}</h1>

			<div className="relative w-full bg-black/90 rounded-xl overflow-hidden aspect-video">
				<iframe
					className="w-full h-full"
					src={`https://www.youtube.com/embed/${slide.youtubeId}`}
					title={slide.title}
					frameBorder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowFullScreen
					loading="lazy"
					referrerPolicy="strict-origin-when-cross-origin"
				/>
			</div>

			<BalanceInfo
				balance={balance}
				isLoadingBalance={isLoadingBalance}
				errorBalance={errorBalance}
			/>
		</Card>
	);
}

export const VideoPlayerCard = memo(VideoPlayerCardComponent);
