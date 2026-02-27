import { useMemo, useState } from "react";
import {
	ALL_GETTING_STARTED_SLIDES,
	DEFAULT_SLIDE_ID,
	GETTING_STARTED_SECTIONS,
} from "./constants/slides";
import { SlidesAccordion } from "./components/SlidesAccordion";
import { VideoPlayerCard } from "./components/VideoPlayerCard";
import { useGettingStartedQuota } from "./hooks/useGettingStartedQuota";

export default function GettingStartedPage() {
	const [activeId, setActiveId] = useState<string>(DEFAULT_SLIDE_ID);

	const activeSlide = useMemo(
		() => ALL_GETTING_STARTED_SLIDES.find((slide) => slide.id === activeId),
		[activeId],
	);

	const {
		balance,
		isLoading: isLoadingBalance,
		errorMessage: errorBalance,
	} = useGettingStartedQuota();

	if (!activeSlide) {
		return (
			<div className="w-full p-6">
				<p className="text-sm text-muted-foreground">No video selected.</p>
			</div>
		);
	}

	return (
		<div className="w-full p-6">
			<div className="flex">
				<aside className="flex-[15.8%] w-[15.8%]">
					<SlidesAccordion
						sections={GETTING_STARTED_SECTIONS}
						activeId={activeId}
						onSelect={setActiveId}
					/>
				</aside>

				<section className="w-full flex-[84.2%]">
					<VideoPlayerCard
						slide={activeSlide}
						balance={balance}
						isLoadingBalance={isLoadingBalance}
						errorBalance={errorBalance}
					/>
				</section>
			</div>
		</div>
	);
}
