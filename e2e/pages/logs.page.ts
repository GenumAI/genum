import { expect, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class LogsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async expectLogsTableVisible(): Promise<void> {
    await expect(this.page.getByRole("button", { name: "Prev" })).toBeVisible();
    await expect(this.page.getByRole("button", { name: "Next" })).toBeVisible();
  }

  async applyQueryFilter(query: string): Promise<void> {
    const searchInput = this.page.getByPlaceholder("Search logs...");
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill(query);
      await searchInput.press("Enter");
    }
  }
}
