import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import { apiBaseUrl, authCredentialsPath } from "../config/env";

export abstract class BasePage {
  protected constructor(protected readonly page: Page) {}

  protected async reloginViaApi(): Promise<boolean> {
    if (!fs.existsSync(authCredentialsPath)) return false;
    try {
      const raw = fs.readFileSync(authCredentialsPath, "utf-8");
      const creds = JSON.parse(raw) as { email?: string; password?: string };
      if (!creds.email || !creds.password) return false;

      const response = await this.page.request.post(
        new URL("/auth/local/login", apiBaseUrl).toString(),
        {
          data: { email: creds.email, password: creds.password },
          failOnStatusCode: false,
        },
      );
      return response.ok();
    } catch {
      return false;
    }
  }

  protected async gotoWithReauth(path: string, expectedUrl: RegExp): Promise<void> {
    await this.page.goto(path);
    if (this.page.url().includes("/login")) {
      const relogged = await this.reloginViaApi();
      if (relogged) {
        await this.page.goto(path);
      }
    }
    await expect(this.page).toHaveURL(expectedUrl);
  }
}
