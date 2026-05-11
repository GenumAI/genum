import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class SettingsPage extends BasePage {
  readonly settingsSidebar: Locator;
  readonly profileNav: Locator;
  readonly orgDetailsNav: Locator;
  readonly projectDetailsNav: Locator;
  readonly orgAiKeysNav: Locator;
  readonly projectApiNav: Locator;

  constructor(page: Page) {
    super(page);
    this.settingsSidebar = page
      .locator("main")
      .getByRole("complementary")
      .filter({ has: page.getByRole("heading", { name: "Organization", exact: true }) })
      .first();

    this.profileNav = this.settingsSidebar.getByRole("link", { name: "Profile", exact: true });
    this.orgDetailsNav = this.settingsSidebar.locator('a[href$="/settings/org/details"]');
    this.projectDetailsNav = this.settingsSidebar.locator('a[href$="/settings/project/details"]');
    this.orgAiKeysNav = this.settingsSidebar.getByRole("link", { name: "AI Providers", exact: true });
    this.projectApiNav = this.settingsSidebar.locator('a[href$="/settings/project/api-keys"]');
  }

  async goToProfile(): Promise<void> {
    await this.profileNav.click();
    await expect(this.page).toHaveURL(/\/settings\/user\/profile$/);
  }

  async goToOrgDetails(): Promise<void> {
    await this.orgDetailsNav.click();
    await expect(this.page).toHaveURL(/\/settings\/org\/details$/);
  }

  async goToProjectDetails(): Promise<void> {
    await this.projectDetailsNav.click();
    await expect(this.page).toHaveURL(/\/settings\/project\/details$/);
  }

  async goToOrgAiKeys(): Promise<void> {
    await this.orgAiKeysNav.click();
    await expect(this.page).toHaveURL(/\/settings\/org\/ai-keys$/);
  }

  async goToProjectApiKeys(): Promise<void> {
    await this.projectApiNav.click();
    await expect(this.page).toHaveURL(/\/settings\/project\/api-keys$/);
  }

  async updateUserName(name: string): Promise<void> {
    await this.page.getByRole("button", { name: "Edit" }).first().click();
    const modalInput = this.page.locator("#modal-name");
    await expect(modalInput).toBeVisible();
    await modalInput.fill(name);
    await this.page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(this.page.locator("#name")).toHaveValue(name);
  }

  async createProjectApiKey(keyName: string): Promise<void> {
    await this.page.getByRole("button", { name: "Create API Key" }).click();
    await this.page.getByLabel("Name").fill(keyName);
    await this.page.getByRole("button", { name: "Save" }).click();
    await expect(this.page.getByRole("button", { name: "Done" })).toBeVisible();
    await this.page.getByRole("button", { name: "Done" }).click();
  }
}
