import {
	SquareTerminal,
	Bot,
	BookOpen,
	Settings,
	UsersRound,
	FileText,
	File,
	Bell,
	MessageSquare,
	Users,
} from "lucide-react";

export const navigation = {
	// If needed, add a 'beta: true' inside the item to show a beta badge
	main: [
		{
			key: "getting-started",
			title: "Getting Started",
			icon: UsersRound,
			url: "/getting-started",
		},
		{
			key: "dashboard",
			title: "Dashboard",
			icon: SquareTerminal,
			url: "/dashboard",
		},
		{
			key: "prompts",
			title: "Prompts",
			icon: Bot,
			url: "/prompts",
		},
		{
			key: "testcases",
			title: "Testcases",
			icon: BookOpen,
			url: "/testcases",
		},
		{
			key: "files",
			title: "Files",
			icon: File,
			url: "/files",
		},
		{
			key: "logs",
			title: "Logs",
			icon: FileText,
			url: "/logs",
		},
		// {
		//   key: "chains",
		//   title: "Chains",
		//   icon: Settings2,
		//   url: "/chains",
		// },
		// {
		//   key: "issues",
		//   title: "Issues",
		//   icon: Frame,
		//   url: "/issues",
		// },
	],
	projects: [
		// {
		//   key: "monitoring",
		//   title: "Monitoring",
		//   icon: PieChart,
		//   url: "/monitoring",
		// },
		// {
		//   key: "security",
		//   title: "Security",
		//   icon: Map,
		//   url: "/security",
		// },
		{
			key: "settings",
			title: "Settings",
			icon: Settings,
			url: "/settings/user/profile",
			activePrefix: "/settings",
		},
	],
	help: [
		// {
		//   key: "forum",
		//   title: "Forum",
		//   icon: UsersRound,
		//   url: "/forum",
		// },
		// {
		//   key: "help",
		//   title: "Help",
		//   icon: MessageCircleQuestion,
		//   url: "/help",
		// },
	],
	notifications: [
		{
			key: "notifications",
			title: "Notifications",
			icon: Bell,
			url: "/notifications",
		},
	],
	bottom: [
		{
			key: "docs",
			title: "Documentation",
			icon: File,
			url: "https://docs.genum.ai",
			external: true,
		},
		{
			key: "community",
			title: "Community",
			icon: Users,
			url: "https://community.genum.ai/",
			external: true,
		},
		{
			key: "feedback",
			title: "Send Feedback",
			icon: MessageSquare,
			url: "#",
			customComponent: "SidebarFeedbackButton",
		},
		{
			key: "whats-new",
			title: "What's New",
			icon: Bell,
			url: "/notifications",
			customComponent: "SidebarNotificationButton",
		},
	],
};
