import { test as base } from "@playwright/test";
import { LayoutPage } from "../pages/layout.page";
import { AuthPage } from "../pages/auth.page";
import { PromptsPage } from "../pages/prompts.page";
import { PlaygroundPage } from "../pages/playground.page";
import { TestcasesPage } from "../pages/testcases.page";
import { WorkspacePage } from "../pages/workspace.page";
import { SettingsPage } from "../pages/settings.page";
import { FilesPage } from "../pages/files.page";
import { VersionsPage } from "../pages/versions.page";
import { MemoryPage } from "../pages/memory.page";
import { LogsPage } from "../pages/logs.page";
import { NotificationsPage } from "../pages/notifications.page";

type Pages = {
	layoutPage: LayoutPage;
	authPage: AuthPage;
	promptsPage: PromptsPage;
	playgroundPage: PlaygroundPage;
	testcasesPage: TestcasesPage;
	workspacePage: WorkspacePage;
	settingsPage: SettingsPage;
	filesPage: FilesPage;
	versionsPage: VersionsPage;
	memoryPage: MemoryPage;
	logsPage: LogsPage;
	notificationsPage: NotificationsPage;
	interTestDelay: void;
};

export const test = base.extend<Pages>({
	interTestDelay: [
		async ({}, use) => {
			await use();
			await new Promise((resolve) => setTimeout(resolve, 2_000));
		},
		{ auto: true },
	],
	layoutPage: async ({ page }, use) => {
		await use(new LayoutPage(page));
	},
	authPage: async ({ page }, use) => {
		await use(new AuthPage(page));
	},
	promptsPage: async ({ page }, use) => {
		await use(new PromptsPage(page));
	},
	playgroundPage: async ({ page }, use) => {
		await use(new PlaygroundPage(page));
	},
	testcasesPage: async ({ page }, use) => {
		await use(new TestcasesPage(page));
	},
	workspacePage: async ({ page }, use) => {
		await use(new WorkspacePage(page));
	},
	settingsPage: async ({ page }, use) => {
		await use(new SettingsPage(page));
	},
	filesPage: async ({ page }, use) => {
		await use(new FilesPage(page));
	},
	versionsPage: async ({ page }, use) => {
		await use(new VersionsPage(page));
	},
	memoryPage: async ({ page }, use) => {
		await use(new MemoryPage(page));
	},
	logsPage: async ({ page }, use) => {
		await use(new LogsPage(page));
	},
	notificationsPage: async ({ page }, use) => {
		await use(new NotificationsPage(page));
	},
});

export { expect } from "@playwright/test";
