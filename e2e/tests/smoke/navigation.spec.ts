import { test, expect } from "../../fixtures/test";

test("core navigation routes are reachable", async ({ layoutPage, page }) => {
  await layoutPage.openHome();

  await layoutPage.goToPrompts();
  await expect(page).toHaveURL(/\/prompts$/);

  await layoutPage.goToTestcases();
  await expect(page).toHaveURL(/\/testcases$/);

  await layoutPage.navGettingStarted.click();
  await expect(page).toHaveURL(/\/getting-started$/);
});
