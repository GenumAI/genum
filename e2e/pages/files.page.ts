import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class FilesPage extends BasePage {
  readonly addFileButton: Locator;

  constructor(page: Page) {
    super(page);
    this.addFileButton = page.getByRole("button", { name: "Add File" });
  }

  async openUploadDialog(): Promise<void> {
    await this.addFileButton.click();
    await expect(this.page.getByRole("heading", { name: "Upload File" })).toBeVisible();
  }

  async uploadFile(filePath: string): Promise<boolean> {
    await this.openUploadDialog();
    const dialog = this.page.getByRole("dialog", { name: "Upload File" });
    await dialog.locator('input[type="file"]').setInputFiles(filePath);
    await dialog.getByRole("button", { name: "Upload", exact: true }).click();
    try {
      await expect(dialog).toBeHidden({ timeout: 20_000 });
      return true;
    } catch {
      return false;
    }
  }

  async expectFileVisible(fileName: string): Promise<void> {
    await expect(this.page.locator("table tbody tr", { hasText: fileName }).first()).toBeVisible();
  }

  async deleteFirstFile(): Promise<void> {
    const deleteButton = this.page.locator("table tbody tr button").first();
    if (!(await deleteButton.isVisible().catch(() => false))) return;
    await deleteButton.click();
    await this.page.getByRole("button", { name: "Delete" }).click();
  }
}
