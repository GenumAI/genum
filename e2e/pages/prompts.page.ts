import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class PromptsPage extends BasePage {
  readonly createPromptButton: Locator;

  constructor(page: Page) {
    super(page);
    this.createPromptButton = page.getByRole("button", { name: "Create prompt" });
  }

  async createPrompt(): Promise<void> {
    for (let i = 0; i < 2; i += 1) {
      await this.createPromptButton.click({ force: true, timeout: 2_000 });
      if (await this.page.url().match(/\/prompt\/\d+\/playground$/)) return;
      if (await this.page.waitForURL(/\/prompt\/\d+\/playground$/, { timeout: 3_000 }).then(() => true).catch(() => false)) {
        return;
      }
    }

    const createdPromptLink = this.page
      .locator('main a[href*="/prompt/"][href$="/playground"]')
      .first();
    await expect(createdPromptLink).toBeVisible({ timeout: 10_000 });
    await createdPromptLink.click({ timeout: 3_000 });
    await expect(this.page).toHaveURL(/\/prompt\/\d+\/playground$/);
  }
}
