import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class LayoutPage extends BasePage {
  readonly navGettingStarted: Locator;
  readonly navDashboard: Locator;
  readonly navPrompts: Locator;
  readonly navTestcases: Locator;
  readonly navFiles: Locator;
  readonly navLogs: Locator;
  readonly navSettings: Locator;

  constructor(page: Page) {
    super(page);
    this.navGettingStarted = page.locator('a[data-sidebar="menu-button"]', { hasText: "Getting Started" });
    this.navDashboard = page.locator('a[data-sidebar="menu-button"]', { hasText: "Dashboard" });
    this.navPrompts = page.locator('a[data-sidebar="menu-button"]', { hasText: "Prompts" });
    this.navTestcases = page.locator('a[data-sidebar="menu-button"]', { hasText: "Testcases" });
    this.navFiles = page.locator('a[data-sidebar="menu-button"]', { hasText: "Files" });
    this.navLogs = page.locator('a[data-sidebar="menu-button"]', { hasText: "Logs" });
    this.navSettings = page.locator('a[data-sidebar="menu-button"]', { hasText: "Settings" });
  }

  async openHome(): Promise<void> {
    await this.gotoWithReauth("/", /\/getting-started$/);
  }

  async goToPrompts(): Promise<void> {
    await this.navPrompts.click();
    await expect(this.page).toHaveURL(/\/prompts$/);
  }

  async goToDashboard(): Promise<void> {
    await this.navDashboard.click();
    await expect(this.page).toHaveURL(/\/dashboard$/);
  }

  async goToTestcases(): Promise<void> {
    await this.navTestcases.click();
    await expect(this.page).toHaveURL(/\/testcases$/);
  }

  async goToFiles(): Promise<void> {
    await this.navFiles.click();
    await expect(this.page).toHaveURL(/\/files$/);
  }

  async goToLogs(): Promise<void> {
    await this.navLogs.click();
    await expect(this.page).toHaveURL(/\/logs$/);
  }

  async goToSettings(): Promise<void> {
    await this.navSettings.click();
    await expect(this.page).toHaveURL(/\/settings\/.+/);
  }

  async logoutByUserEmail(email: string): Promise<void> {
    await this.page.getByText(email).first().click();
    await this.page.getByText("Log out").click();
    await expect(this.page).toHaveURL(/\/login/);
  }
}
