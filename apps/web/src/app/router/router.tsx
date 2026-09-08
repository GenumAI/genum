import { lazy, Suspense, type ComponentType } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import MainLayout from "@/components/layout/MainLayout";

import RedirectedToProjectRoute from "@/app/router/RedirectedToProjectRoute";
import ProtectedRoute from "@/app/router/ProtectedRoute";
import RoleProtectedRoute from "@/app/router/RoleProtectedRoute";
import { OrganizationRole } from "@/api/organization";
import { Skeleton } from "@/components/ui/skeleton";

// Kept eager: these are the entry points a signed-out visitor lands on, plus the two error
// screens, which must not depend on a chunk fetch that may itself be what failed.
import AcceptInvitePage from "@/pages/invite/AcceptInvitePage";
import Login from "@/pages/auth/Login";
import Signup from "@/pages/auth/Signup";
import { ErrorPage } from "@/pages/info-pages/ErrorPage";
import { NotFoundPage } from "@/pages/info-pages/NotFoundPage";

// Now that pages arrive over the network, the dull failure is a client holding an index.html
// from before a deploy and asking for an asset filename that no longer exists. Retrying the same
// URL cannot help; reloading picks up the new index.html. The flag keeps a chunk that is missing
// for any other reason from turning into a reload loop, and sessionStorage throws outright in
// some privacy modes, so both accesses are guarded.
const RELOAD_FLAG = "genum:chunk-reload";

const readFlag = () => {
	try {
		return sessionStorage.getItem(RELOAD_FLAG) !== null;
	} catch {
		return true;
	}
};

const writeFlag = () => {
	try {
		sessionStorage.setItem(RELOAD_FLAG, "1");
	} catch {
		// A browser that refuses the write also refuses the read above, so we never get here
		// twice for the same page load.
	}
};

const clearFlag = () => {
	try {
		sessionStorage.removeItem(RELOAD_FLAG);
	} catch {
		// Nothing to clear if the store is unavailable.
	}
};

const lazyPage = <T extends ComponentType>(load: () => Promise<{ default: T }>) =>
	lazy(() =>
		load()
			.then((module) => {
				// A page arrived, so whatever the last reload was for is resolved and the next
				// stale deploy is allowed its own retry.
				clearFlag();
				return module;
			})
			.catch((error: unknown) => {
				if (readFlag()) {
					throw error;
				}
				writeFlag();
				window.location.reload();
				// Leave the boundary suspended: the reload is already underway, and resolving
				// or rejecting here would flash the error screen on the way out.
				return new Promise<{ default: T }>(() => {});
			}),
	);

const Dashboard = lazyPage(() => import("@/pages/dashboard/Dashboard"));
const Prompts = lazyPage(() => import("@/pages/prompt/Prompts"));
const Testcases = lazyPage(() => import("@/pages/testcases/TestcasesPage"));
const FilesPage = lazyPage(() => import("@/pages/files/FilesPage"));
const GettingStarted = lazyPage(() => import("@/pages/getting-started/GettingStarted"));
const LogsPage = lazyPage(() =>
	import("@/pages/logs/LogsPage").then((m) => ({ default: m.LogsPage })),
);
const Notifications = lazyPage(() => import("@/components/ui/notifications/Notifications"));
const NotificationDetails = lazyPage(
	() => import("@/components/ui/notifications/NotificationDetails"),
);

const PlaygroundWorkspace = lazyPage(
	() => import("@/pages/prompt/playground-tabs/PlaygroundWorkspace"),
);
const VersionDetails = lazyPage(
	() => import("@/pages/prompt/playground-tabs/version/components/VersionDetails"),
);
const Compare = lazyPage(
	() => import("@/pages/prompt/playground-tabs/version/components/compare/Compare"),
);

const Settings = lazyPage(() => import("@/pages/settings/Settings"));
const UserProfile = lazyPage(() => import("@/pages/settings/components/UserProfile"));
const OrgGeneral = lazyPage(() => import("@/pages/settings/components/OrgGeneral"));
const OrgMembers = lazyPage(() => import("@/pages/settings/components/OrgMembers"));
const OrgProjects = lazyPage(() => import("@/pages/settings/components/OrgProjects"));
const OrgModels = lazyPage(() => import("@/pages/settings/components/OrgModels"));
const OrgAIKeys = lazyPage(() => import("@/pages/settings/components/OrgAIKeys/OrgAIKeys"));
const OrgAPIKeys = lazyPage(() => import("@/pages/settings/components/OrgAPIKeys"));
const ProjectDetails = lazyPage(() => import("@/pages/settings/components/ProjectDetails"));
const ProjectMembers = lazyPage(() => import("@/pages/settings/components/ProjectMembers"));
const ProjectAPIKeys = lazyPage(() => import("@/pages/settings/components/ProjectAPIKeys"));

const routeFallback = (
	<div className="flex w-full flex-col gap-4 px-6 pt-6">
		<Skeleton className="h-8 w-56" />
		<Skeleton className="h-4 w-80" />
		<Skeleton className="h-72 w-full" />
	</div>
);

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
			// Pathless layout route carrying the one Suspense boundary for every lazy page. The
			// routes below deliberately avoid react-router's own `lazy` property: react-router
			// resolves that *before* the first render and, with no `HydrateFallback`, renders null
			// for the whole tree — so a cold load of a deep link would show an empty page, sidebar
			// and header included, until the chunk arrived. Sitting under MainLayout's `<Outlet />`
			// this boundary keeps the shell up and confines the fallback to the page area, and
			// because it mounts once and survives navigation, react-router's transitions hold the
			// previous page on screen rather than flashing the skeleton between routes.
			{
				element: (
					<Suspense fallback={routeFallback}>
						<Outlet />
					</Suspense>
				),
				children: [
					{ path: "dashboard", element: <Dashboard /> },
					{ path: "prompts", element: <Prompts /> },
					{ path: "testcases", element: <Testcases /> },
					{ path: "files", element: <FilesPage /> },
					{
						path: "settings",
						element: <Settings />,
						children: [
							{ index: true, element: <UserProfile /> },
							{ path: "user/profile", element: <UserProfile /> },
							{ path: "org/details", element: <OrgGeneral /> },
							{
								path: "org/members",
								element: (
									<RoleProtectedRoute minRole={OrganizationRole.ADMIN}>
										<OrgMembers />
									</RoleProtectedRoute>
								),
							},
							{
								path: "org/projects",
								element: (
									<RoleProtectedRoute minRole={OrganizationRole.ADMIN}>
										<OrgProjects />
									</RoleProtectedRoute>
								),
							},
							{
								path: "org/models",
								element: (
									<RoleProtectedRoute minRole={OrganizationRole.ADMIN}>
										<OrgModels />
									</RoleProtectedRoute>
								),
							},
							{
								path: "org/ai-keys",
								element: (
									<RoleProtectedRoute minRole={OrganizationRole.ADMIN}>
										<OrgAIKeys />
									</RoleProtectedRoute>
								),
							},
							{
								path: "org/api-keys",
								element: (
									<RoleProtectedRoute minRole={OrganizationRole.ADMIN}>
										<OrgAPIKeys />
									</RoleProtectedRoute>
								),
							},
							{ path: "project/details", element: <ProjectDetails /> },
							{ path: "project/members", element: <ProjectMembers /> },
							{ path: "project/api-keys", element: <ProjectAPIKeys /> },
						],
					},
					{
						path: "prompt/:id/versions/:versionId",
						element: <VersionDetails />,
					},
					{
						path: "prompt/:id/compare",
						element: <Compare />,
					},
					{ path: "prompt/:id", element: <Navigate to="playground" replace /> },
					{ path: "prompt/:id/:tab", element: <PlaygroundWorkspace /> },
					{ path: "getting-started", element: <GettingStarted /> },
					{ path: "logs", element: <LogsPage /> },
					{ path: "notifications", element: <Notifications /> },
					{ path: "notifications/:notificationId", element: <NotificationDetails /> },
				],
			},
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
