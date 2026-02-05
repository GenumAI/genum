import { Card } from "@/components/ui/card";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Play } from "lucide-react";
import {
	Accordion,
	AccordionItem,
	AccordionTrigger,
	AccordionContent,
} from "@/components/ui/accordion";
import { SocialIcons } from "@/components/ui/icons-tsx/social-icons";
import { organizationApi } from "@/api/organization";
import { useRefetchOnWorkspaceChange } from "@/hooks/useRefetchOnWorkspaceChange";

interface Slide {
	id: string;
	title: string;
	youtubeId: string;
	thumb?: string;
}

const quickStartSlides: Slide[] = [
	{
		id: "qs-1",
		title: "#1 – How to Create a Production-Ready Prompt",
		youtubeId: "Q1-4C0G69eo",
		thumb: "https://img.youtube.com/vi/Q1-4C0G69eo/mqdefault.jpg",
	},
	{
		id: "qs-2",
		title: "#2 – How to Create Test Cases for Your Prompts",
		youtubeId: "RwGPBcON6Oc",
		thumb: "https://img.youtube.com/vi/RwGPBcON6Oc/mqdefault.jpg",
	},
	{
		id: "qs-3",
		title: "#3 – Canvas Chat: Build & Refine Prompts Like an Agent",
		youtubeId: "Mvx05PtZ4Os",
		thumb: "https://img.youtube.com/vi/Mvx05PtZ4Os/mqdefault.jpg",
	},
];

const useCasesSlides: Slide[] = [
	{
		id: "uc-1",
		title: "#1 – Test and Deliver Your Prompt into Action",
		youtubeId: "0xElk105syQ",
		thumb: "https://i.ytimg.com/vi/0xElk105syQ/mqdefault.jpg",
	},
	{
		id: "uc-2",
		title: "#2 – Building Reliable AI Agents in n8n with Genum",
		youtubeId: "H22ffTbwf2E",
		thumb: "https://img.youtube.com/vi/H22ffTbwf2E/mqdefault.jpg",
	},
	{
		id: "uc-3",
		title: "#3 – How to Parse & Classify Emails with Genum + Make",
		youtubeId: "DoXiRVfkrlA",
		thumb: "https://img.youtube.com/vi/DoXiRVfkrlA/mqdefault.jpg",
	},
];

const successStoriesSlides: Slide[] = [
	{
		id: "sc-1",
		title: "#1 - How We Rebuilt a Conversational AI with Genum",
		youtubeId: "cdajEbnEK7k",
		thumb: "https://img.youtube.com/vi/cdajEbnEK7k/mqdefault.jpg",
	},
];

function useOrganizationQuota() {
	const [balance, setBalance] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchQuota = useCallback(() => {
		let alive = true;
		setLoading(true);
		setError(null);

		organizationApi
			.getQuota()
			.then((data) => {
				if (!alive) return;
				setBalance(data?.quota?.balance != null ? String(data.quota.balance) : null);
			})
			.catch(() => {
				if (!alive) return;
				setError("Failed to load balance");
				setBalance(null);
			})
			.finally(() => {
				if (!alive) return;
				setLoading(false);
			});

		return () => {
			alive = false;
		};
	}, []);

	useEffect(() => {
		return fetchQuota();
	}, [fetchQuota]);

	useRefetchOnWorkspaceChange(fetchQuota);

	return { balance, loading, error };
}

export default function GettingStartedSlider() {
	const allSlides = useMemo(
		() => [...quickStartSlides, ...useCasesSlides, ...successStoriesSlides],
		[],
	);

	const [activeId, setActiveId] = useState<string>(quickStartSlides[0]?.id ?? "");
	const activeSlide = useMemo(
		() => allSlides.find((s) => s.id === activeId),
		[activeId, allSlides],
	);

	const { balance, loading: loadingBalance, error: errorBalance } = useOrganizationQuota();

	if (!activeSlide) return null;

	return (
		<div className="w-full p-6">
			<div className="flex">
				<aside className="flex-[15.8%] w-[15.8%]">
					<Accordion
						type="single"
						collapsible
						defaultValue="quick-start"
						className="w-full space-y-0"
					>
						<AccordionItem value="quick-start" className="border-none mt-0">
							<AccordionTrigger className="text-[14px] font-bold text-foreground h-[36px] [&>svg]:hidden">
								Quick Start
							</AccordionTrigger>
							<AccordionContent className="p-0">
								<nav className="space-y-[14px] mb-6">
									{quickStartSlides.map((s) => (
										<button
											key={s.id}
											onClick={() => setActiveId(s.id)}
											className="w-full flex flex-col items-start gap-3 rounded-xl transition hover:font-medium border bg-card text-left border-transparent"
										>
											<div className="w-full aspect-[176/94] shrink-0 rounded-[2px] overflow-hidden bg-muted flex items-center justify-center">
												{s.thumb ? (
													<img
														src={s.thumb}
														alt={s.title}
														className="w-full h-full object-cover"
													/>
												) : (
													<Play className="w-5 h-5" />
												)}
											</div>
											<div className="text-[12px] leading-[126%] w-full line-clamp-2">
												{s.title}
											</div>
										</button>
									))}
								</nav>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="use-cases" className="border-none mt-0">
							<AccordionTrigger className="text-[14px] font-bold text-foreground h-[36px] [&>svg]:hidden">
								Use Cases
							</AccordionTrigger>
							<AccordionContent className="p-0">
								<nav className="space-y-[14px] mb-6">
									{useCasesSlides.map((s) => (
										<button
											key={s.id}
											onClick={() => setActiveId(s.id)}
											className="w-full flex flex-col items-start gap-3 rounded-xl transition hover:font-medium border bg-card text-left border-transparent"
										>
											<div className="w-full aspect-[176/94] shrink-0 rounded-[2px] overflow-hidden bg-muted flex items-center justify-center">
												{s.thumb ? (
													<img
														src={s.thumb}
														alt={s.title}
														className="w-full h-full object-cover"
													/>
												) : (
													<Play className="w-5 h-5" />
												)}
											</div>
											<div className="text-[12px] leading-[126%] w-full line-clamp-2">
												{s.title}
											</div>
										</button>
									))}
								</nav>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="success-stories" className="border-none mt-0">
							<AccordionTrigger className="text-[14px] font-bold text-foreground h-[36px] [&>svg]:hidden">
								Success Stories
							</AccordionTrigger>
							<AccordionContent className="p-0">
								<nav className="space-y-[14px] mb-6">
									{successStoriesSlides.map((s) => (
										<button
											key={s.id}
											onClick={() => setActiveId(s.id)}
											className="w-full flex flex-col items-start gap-3 rounded-xl transition hover:font-medium border bg-card text-left border-transparent"
										>
											<div className="w-full aspect-[176/94] shrink-0 rounded-[2px] overflow-hidden bg-muted flex items-center justify-center">
												{s.thumb ? (
													<img
														src={s.thumb}
														alt={s.title}
														className="w-full h-full object-cover"
													/>
												) : (
													<Play className="w-5 h-5" />
												)}
											</div>
											<div className="text-[12px] leading-[126%] w-full line-clamp-2">
												{s.title}
											</div>
										</button>
									))}
								</nav>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</aside>

				<section className="w-full flex-[84.2%]">
					<Card className="p-0 px-[76px] shadow-none border-none flex flex-col items-center">
						<h1 className="text-[16px] md:text-xl font-bold mb-6 text-center">
							{activeSlide.title}
						</h1>

						<div className="relative w-full bg-black/90 rounded-xl overflow-hidden aspect-video">
							<iframe
								className="w-full h-full"
								src={`https://www.youtube.com/embed/${activeSlide.youtubeId}`}
								title={activeSlide.title}
								frameBorder="0"
								allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
								allowFullScreen
							/>
						</div>

						<div className="mt-6 text-center">
							<p className="font-semibold text-[16px]">
								Your balance: ${balance ? Number(balance).toFixed(2) : "0.00"}
							</p>

							{loadingBalance && (
								<p className="text-[12px] text-muted-foreground mt-1">
									Loading balance…
								</p>
							)}

							{errorBalance && (
								<p className="text-[12px] text-red-500 mt-1">{errorBalance}</p>
							)}

							<p className="text-[14px] text-foreground max-w-xl mx-auto mt-2 [text-wrap-style:balance]">
								This balance is shared across all vendors and models in Genum Lab.
								You can use it to run prompts, tests, and experiments with any
								supported provider.
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
					</Card>
				</section>
			</div>
		</div>
	);
}
