import { expect, test } from "../../../fixtures/test";

test("create, rename, run and delete prompt", async ({
  layoutPage,
  promptsPage,
  playgroundPage,
  page,
}) => {
  const promptName = `Lifecycle Prompt ${Date.now()}`;

  await layoutPage.openHome();
  await layoutPage.goToPrompts();

  await promptsPage.createPrompt();
  await playgroundPage.renamePrompt(promptName);
  await playgroundPage.runPromptAndWaitOutput();

  await layoutPage.goToPrompts();

  const promptRow = page.locator("tr", { hasText: promptName }).first();
  await expect(promptRow).toBeVisible();
  await promptRow.locator("button").last().click();

  await page.getByPlaceholder("Prompt title").fill(promptName);
  await page.getByRole("button", { name: /^Delete$/ }).click();

  await expect(page.locator("tr", { hasText: promptName })).toHaveCount(0);
});
