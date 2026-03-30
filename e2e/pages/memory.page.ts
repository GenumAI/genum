import { expect, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class MemoryPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async openMemory(orgId: string, projectId: string, promptId: number): Promise<void> {
    await this.gotoWithReauth(
      `/${orgId}/${projectId}/prompt/${promptId}/memory`,
      new RegExp(`/prompt/${promptId}/memory$`),
    );
  }

  async createMemory(key: string, value: string): Promise<void> {
    await this.page.getByRole("button", { name: "Create Memory" }).click();
    await this.page.getByPlaceholder("Enter key").fill(key);
    await this.page.getByPlaceholder("Enter value").fill(value);
    await this.page.getByRole("button", { name: "Create" }).click();
  }

  async editMemoryValue(newValue: string): Promise<void> {
    await this.page.locator("table tbody tr button").first().click();
    await this.page.getByRole("button", { name: "Edit" }).click();
    const textarea = this.page.getByPlaceholder("Enter memory value");
    await textarea.fill(newValue);
    await this.page.getByRole("button", { name: "Save Changes" }).click();
  }

  async deleteMemory(): Promise<void> {
    await this.page.locator("table tbody tr button").first().click();
    await this.page.getByRole("button", { name: "Delete" }).first().click();
    await this.page.getByRole("button", { name: "Delete" }).last().click();
  }

  async expectMemoryVisible(key: string): Promise<void> {
    await expect(this.page.getByText(key)).toBeVisible();
  }

  async expectMemoryNotVisible(key: string): Promise<void> {
    await expect(this.page.getByText(key)).toHaveCount(0);
  }
}
