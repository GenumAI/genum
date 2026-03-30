import { expect, type Locator, type Page } from "@playwright/test";
import { BasePage } from "./base.page";

export class AuthPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel("Email");
    this.passwordInput = page.getByLabel("Password", { exact: true });
    this.loginButton = page.getByRole("button", { name: /log in/i });
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await expect(this.page).toHaveURL(/\/getting-started/);
  }
}
