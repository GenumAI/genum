import { expect } from "@playwright/test";
import { test } from "../../fixtures/test";
import { apiBaseUrl } from "../../config/env";
import { createE2EUser } from "../../support/user-data";

test.use({ storageState: { cookies: [], origins: [] } });

test("user can log out and log in again", async ({ page, layoutPage, authPage }) => {
  const user = createE2EUser();

  await test.step("Register user via API", async () => {
    const response = await page.request.post(new URL("/auth/local/register", apiBaseUrl).toString(), {
      data: {
        name: user.name,
        email: user.email,
        password: user.password,
      },
      failOnStatusCode: false,
    });
    expect(response.ok(), `Register failed: ${response.status()} ${await response.text()}`).toBeTruthy();
    await page.context().clearCookies();
  });

  await test.step("Login and open app", async () => {
    await page.goto("/login");
    await authPage.login(user.email, user.password);
  });

  await test.step("Open user menu and logout", async () => {
    await layoutPage.logoutByUserEmail(user.email);
  });

  await test.step("Login again", async () => {
    await page.goto("/login");
    await authPage.login(user.email, user.password);
  });
});
