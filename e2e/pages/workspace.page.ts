import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class WorkspacePage extends BasePage {
  readonly orgDropdownTrigger: Locator;
  readonly projectDropdownTrigger: Locator;

  constructor(page: Page) {
    super(page);
    this.orgDropdownTrigger = page.locator('button[data-sidebar="menu-button"][data-size="sm"]').first();
    this.projectDropdownTrigger = page.locator('button[data-sidebar="menu-button"][data-size="sm"]').last();
  }

  async openProjectDropdown(): Promise<void> {
    await this.projectDropdownTrigger.click();
  }

  async switchToProject(projectName: string, fallbackProjectId?: number): Promise<void> {
    await this.openProjectDropdown();
    const projectMenuItem = this.page.getByRole("menuitem", { name: projectName });
    if (await projectMenuItem.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await projectMenuItem.click();
      return;
    }
    if (fallbackProjectId !== undefined) {
      const workspaceMatch = this.page.url().match(/\/([^/]+)\/([^/]+)\//);
      if (workspaceMatch) {
        const [, orgId] = workspaceMatch;
        await this.page.goto(`/${orgId}/${fallbackProjectId}/dashboard`);
      }
    }
  }

  async openManageProjects(): Promise<void> {
    await this.openProjectDropdown();
    const manageProjectsItem = this.page.getByRole("menuitem", { name: "Manage projects" });
    if (await manageProjectsItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await manageProjectsItem.click();
    } else {
      const workspaceMatch = this.page.url().match(/\/([^/]+)\/([^/]+)\//);
      if (workspaceMatch) {
        const [, orgId, projectId] = workspaceMatch;
        await this.page.goto(`/${orgId}/${projectId}/settings/org/projects`);
      }
    }
    await expect(this.page).toHaveURL(/\/settings\/org\/projects$/);
  }
}
