export interface Slide {
	id: string;
	title: string;
	youtubeId: string;
	thumb?: string;
}

export interface GettingStartedSection {
	id: string;
	title: string;
	slides: Slide[];
}
