import type { GettingStartedSection, Slide } from "../types";

export const QUICK_START_SLIDES: Slide[] = [
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

export const UPDATES_SLIDES: Slide[] = [
	{
		id: "up-1",
		title: "#1 – Deploying Genum Locally with Custom LLM Providers",
		youtubeId: "JKBnNh8U5L8",
		thumb: "https://img.youtube.com/vi/JKBnNh8U5L8/mqdefault.jpg",
	},
	{
		id: "up-2",
		title: "#2 – File Inputs & OCR for Structured Data Extraction",
		youtubeId: "btDzMBB-NQM",
		thumb: "https://img.youtube.com/vi/btDzMBB-NQM/mqdefault.jpg",
	},
];

export const USE_CASES_SLIDES: Slide[] = [
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
	{
		id: "uc-4",
		title: "#4 – Automating Mail Task Parsing: From Inbox to Report with Genum + Zapier",
		youtubeId: "u-U5nrb6awE",
		thumb: "https://img.youtube.com/vi/u-U5nrb6awE/mqdefault.jpg",
	},
	{
		id: "uc-5",
		title: "#5 – From Idea to AI Agent in Minutes via voice",
		youtubeId: "ddz50wtpBoQ",
		thumb: "https://img.youtube.com/vi/ddz50wtpBoQ/mqdefault.jpg",
	},
];

export const SUCCESS_STORIES_SLIDES: Slide[] = [
	{
		id: "sc-1",
		title: "#1 - How We Rebuilt a Conversational AI with Genum",
		youtubeId: "cdajEbnEK7k",
		thumb: "https://img.youtube.com/vi/cdajEbnEK7k/mqdefault.jpg",
	},
];

export const GETTING_STARTED_SECTIONS: GettingStartedSection[] = [
	{ id: "quick-start", title: "Quick Start", slides: QUICK_START_SLIDES },
	{ id: "updates", title: "Updates", slides: UPDATES_SLIDES },
	{ id: "use-cases", title: "Use Cases", slides: USE_CASES_SLIDES },
	{ id: "success-stories", title: "Success Stories", slides: SUCCESS_STORIES_SLIDES },
];

export const DEFAULT_SLIDE_ID = QUICK_START_SLIDES[0]?.id ?? "";

export const ALL_GETTING_STARTED_SLIDES = GETTING_STARTED_SECTIONS.flatMap(
	(section) => section.slides,
);
