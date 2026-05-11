import { expect, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class NotificationsPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openList(orgId: string, projectId: string): Promise<void> {
    await this.gotoWithReauth(
      `/${orgId}/${projectId}/notifications`,
      /\/notifications$/,
    );
  }

  async openFirstNotificationDetailsIfAny(): Promise<boolean> {
    const cards = this.page.locator("div.cursor-pointer");
    const count = await cards.count();
    if (count === 0) return false;

    await cards.first().click();
    await expect(this.page).toHaveURL(/\/notifications\/.+$/);
    return true;
  }

  async markAllAsReadIfAvailable(): Promise<void> {
    const markAll = this.page.getByRole("button", { name: "Mark all as read" });
    if (await markAll.isVisible().catch(() => false)) {
      await markAll.click();
    }
  }
}
