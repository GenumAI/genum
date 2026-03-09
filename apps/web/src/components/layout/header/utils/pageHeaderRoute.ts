type PageHeaderRouteState = {
	isPromptPage: boolean;
	isVersionsPage: boolean;
	isComparePage: boolean;
	isSettings: boolean;
	isGetting: boolean;
};

export const getPageHeaderRouteState = (pathname: string): PageHeaderRouteState => ({
	isPromptPage: /^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/[^/]+\/[^/]+$/.test(pathname),
	isVersionsPage: /^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/\d+\/versions\/\d+\/?$/.test(pathname),
	isComparePage: /^\/(?:[^/]+\/)?(?:[^/]+\/)?prompt\/\d+\/compare\/?$/.test(pathname),
	isSettings: /^\/[^/]+\/[^/]+\/settings(?:\/.*)?$/.test(pathname),
	isGetting: /^\/(?:[^/]+\/){2}getting-started\/?$/.test(pathname),
});
