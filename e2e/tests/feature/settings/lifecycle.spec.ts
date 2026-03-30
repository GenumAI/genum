import { expect, test } from "../../../fixtures/test";

test("update user profile", async ({ layoutPage, settingsPage, page }) => {
  await layoutPage.openHome();
  await layoutPage.goToSettings();
  await settingsPage.goToProfile();

  const currentName = await page.getByLabel("Name").inputValue();
  const updatedName = `E2E User ${Date.now()}`;

  await settingsPage.updateUserName(updatedName);
  await expect(page.locator("#name")).toHaveValue(updatedName);

  // Revert profile name to avoid polluting subsequent runs.
  await settingsPage.updateUserName(currentName);
  await expect(page.locator("#name")).toHaveValue(currentName);
});

test("organization and project details screens open", async ({ layoutPage, settingsPage, page }) => {
  await layoutPage.openHome();
  await layoutPage.goToSettings();

  await settingsPage.goToOrgDetails();
  await expect(page.getByText("Organization Details")).toBeVisible();

  await settingsPage.goToProjectDetails();
  await expect(page.getByText("Project Details")).toBeVisible();
});

test("project API key create/delete flow", async ({ layoutPage, settingsPage, page }) => {
  const keyName = `e2e-key-${Date.now()}`;

  await layoutPage.openHome();
  await layoutPage.goToSettings();
  await settingsPage.goToProjectApiKeys();

  await settingsPage.createProjectApiKey(keyName);
  await expect(page.getByText(keyName)).toBeVisible();

  const keyRow = page.locator("tr", { hasText: keyName }).first();
  await keyRow.locator("button").first().click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();

  await expect(page.locator("tr", { hasText: keyName })).toHaveCount(0);
});
