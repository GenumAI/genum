import { createBrowserRouter } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";

import RedirectedToProjectRoute from "@/app/router/RedirectedToProjectRoute";
import Dashboard from "@/pages/dashboard/Dashboard";
import Prompts from "@/pages/prompt/Prompts";
import Testcases from "@/pages/testcases/TestcasesPage";
import PromptTestcases from "@/pages/prompt/playground-tabs/testcases/Testcases";
import Settings from "@/pages/settings/Settings";
import Playground from "@/pages/prompt/playground-tabs/playground/Playground";
import ProtectedRoute from "@/app/router/ProtectedRoute";
import Memory from "@/pages/prompt/playground-tabs/memory/Memory";
import Versions from "@/pages/prompt/playground-tabs/version/Versions";
import Compare from "@/pages/prompt/playground-tabs/version/compare/Compare";
import { LogsPage } from "@/pages/logs/LogsPage";

import Api from "@/pages/prompt/playground-tabs/api/Api";
import Logs from "@/pages/prompt/playground-tabs/logs/LogsTab";
import Notifications from "../../components/ui/notifications/Notifications";
import NotificationDetails from "../../components/ui/notifications/NotificationDetails";
import VersionDetails from "@/pages/prompt/playground-tabs/version/VersionDetails";

import UserProfile from "../../pages/settings/UserProfile";
import OrgGeneral from "../../pages/settings/OrgGeneral";
import OrgMembers from "../../pages/settings/OrgMembers";
import OrgProjects from "../../pages/settings/OrgProjects";
import OrgAIKeys from "../../pages/settings/OrgAIKeys";
import OrgAPIKeys from "../../pages/settings/OrgAPIKeys";
import ProjectDetails from "../../pages/settings/ProjectDetails";
import ProjectMembers from "../../pages/settings/ProjectMembers";
import ProjectAPIKeys from "../../pages/settings/ProjectAPIKeys";

import AcceptInvitePage from "@/pages/invite/AcceptInvitePage";
import GettingStarted from "@/pages/getting-started/GettingStarted";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import { ErrorPage } from "@/pages/info-pages/ErrorPage";
import { NotFoundPage } from "@/pages/info-pages/NotFoundPage";

export const router = createBrowserRouter([
	{
		path: "/:orgId?/:projectId?",
		element: (
			<ProtectedRoute>
				<RedirectedToProjectRoute Element={MainLayout} />
			</ProtectedRoute>
		),
		errorElement: <ErrorPage />,
		children: [
			{ path: "dashboard", element: <Dashboard /> },
			{ path: "prompts", element: <Prompts /> },
			{ path: "testcases", element: <Testcases /> },
			{
				path: "settings",
				element: <Settings />,
				children: [
					{ index: true, element: <UserProfile /> },
					{ path: "user/profile", element: <UserProfile /> },
					{ path: "org/details", element: <OrgGeneral /> },
					{ path: "org/members", element: <OrgMembers /> },
					{ path: "org/projects", element: <OrgProjects /> },
					{ path: "org/ai-keys", element: <OrgAIKeys /> },
					{ path: "org/api-keys", element: <OrgAPIKeys /> },
					{ path: "project/details", element: <ProjectDetails /> },
					{ path: "project/members", element: <ProjectMembers /> },
					{ path: "project/api-keys", element: <ProjectAPIKeys /> },
				],
			},
			{ path: "prompt/:id/playground", element: <Playground /> },
			{ path: "prompt/:id/testcases", element: <PromptTestcases /> },
			{ path: "prompt/:id/versions", element: <Versions /> },
			{
				path: "prompt/:id/versions/:versionId",
				element: <VersionDetails />,
			},
			{
				path: "prompt/:id/compare",
				element: <Compare />,
			},
			{ path: "prompt/:id/memory", element: <Memory /> },
			{ path: "prompt/:id/logs", element: <Logs /> },
			{ path: "prompt/:id/api", element: <Api /> },
			{ path: "getting-started", element: <GettingStarted /> },
			{ path: "logs", element: <LogsPage /> },
			{ path: "notifications", element: <Notifications /> },
			{ path: "notifications/:notificationId", element: <NotificationDetails /> },
		],
	},
	{ path: "/invite/:token", element: <AcceptInvitePage /> },
	{ path: "/login", element: <Login /> },
	{ path: "/signup", element: <Signup /> },
	{
		path: "*",
		element: <NotFoundPage />,
	},
]);
