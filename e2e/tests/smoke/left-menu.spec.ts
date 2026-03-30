import { test, expect } from "../../fixtures/test";

test("left menu links are visible and navigate to expected routes", async ({
  layoutPage,
}) => {
  await layoutPage.openHome();

  await expect(layoutPage.navGettingStarted).toBeVisible();
  await expect(layoutPage.navDashboard).toBeVisible();
  await expect(layoutPage.navPrompts).toBeVisible();
  await expect(layoutPage.navTestcases).toBeVisible();
  await expect(layoutPage.navFiles).toBeVisible();
  await expect(layoutPage.navLogs).toBeVisible();
  await expect(layoutPage.navSettings).toBeVisible();

  await layoutPage.goToDashboard();
  await expect(layoutPage.navDashboard).toHaveAttribute("data-active", "true");

  await layoutPage.goToPrompts();
  await expect(layoutPage.navPrompts).toHaveAttribute("data-active", "true");

  await layoutPage.goToTestcases();
  await expect(layoutPage.navTestcases).toHaveAttribute("data-active", "true");

  await layoutPage.goToFiles();
  await expect(layoutPage.navFiles).toHaveAttribute("data-active", "true");

  await layoutPage.goToLogs();
  await expect(layoutPage.navLogs).toHaveAttribute("data-active", "true");

  await layoutPage.goToSettings();
  await expect(layoutPage.navSettings).toHaveAttribute("data-active", "true");
});
