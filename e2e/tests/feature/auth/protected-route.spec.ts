import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("protected route redirects unauthenticated user to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
});
