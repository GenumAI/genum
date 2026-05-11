import { expect, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class VersionsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openVersions(orgId: string, projectId: string, promptId: number): Promise<void> {
    await this.gotoWithReauth(
      `/${orgId}/${projectId}/prompt/${promptId}/versions`,
      new RegExp(`/prompt/${promptId}/versions$`),
    );
  }

  async commit(message: string): Promise<void> {
    await this.page.getByRole("button", { name: "Commit" }).first().click();
    await expect(this.page.getByRole("heading", { name: "New Commit" })).toBeVisible();
    await this.page.getByPlaceholder("Enter message").fill(message);
    await this.page.getByRole("button", { name: "Commit" }).last().click();
  }

  async openCompare(): Promise<void> {
    await this.page.getByRole("button", { name: "Compare" }).click();
    await expect(this.page).toHaveURL(/\/compare/);
  }

  async openFirstVersionDetails(): Promise<void> {
    const versionLink = this.page.locator('a[href*="/versions/"]').first();
    await expect(versionLink).toBeVisible();
    await versionLink.click();
    await expect(this.page).toHaveURL(/\/versions\/\d+$/);
  }

  async rollbackCurrentVersion(): Promise<void> {
    await this.page.getByRole("button", { name: "Rollback" }).click();
    await this.page.getByRole("button", { name: "Yes, rollback" }).click();
    await expect(this.page.getByText("Rollback successfull")).toBeVisible();
    await this.page.getByRole("button", { name: "Ok" }).click();
  }
}
