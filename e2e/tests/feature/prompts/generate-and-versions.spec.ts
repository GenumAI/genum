import { expect, test } from "../../../fixtures/test";
import { hasAiProviderCredentials } from "../../../config/env";
import { getWorkspaceFromPage } from "../../../support/api-client";

test.skip(!hasAiProviderCredentials, "AI provider keys are unavailable in this E2E environment.");

function getPromptIdFromUrl(url: string): number {
  const match = url.match(/\/prompt\/(\d+)/);
  if (!match) {
    throw new Error(`Cannot extract prompt id from URL: ${url}`);
  }
  return Number(match[1]);
}

test("generate prompt content and commit is visible in versions", async ({
  layoutPage,
  promptsPage,
  playgroundPage,
  versionsPage,
  page,
}) => {
  await layoutPage.openHome();
  await layoutPage.goToPrompts();
  await promptsPage.createPrompt();

  await playgroundPage.renamePrompt(`Generated Prompt ${Date.now()}`);
  await playgroundPage.generateSystemInstruction("Create a strict system prompt for summarization");

  const workspace = await getWorkspaceFromPage(page);
  const promptId = getPromptIdFromUrl(page.url());

  await versionsPage.openVersions(workspace.orgId, workspace.projectId, promptId);
  await versionsPage.commit(`E2E commit ${Date.now()}`);

  await expect(page.locator('a[href*="/versions/"]').first()).toBeVisible();

  await versionsPage.openCompare();
  await expect(page.getByText("Select two commits to compare")).toBeVisible();
});
