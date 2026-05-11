import { expect, test } from "../../../fixtures/test";
import {
  commitPrompt,
  createPrompt,
  getPrompt,
  getPromptBranches,
  getWorkspaceFromPage,
  updatePrompt,
} from "../../../support/api-client";

test("commit history is visible, compare opens, rollback updates prompt content", async ({
  layoutPage,
  versionsPage,
  page,
}) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  const prompt = await createPrompt(page, workspace, {
    name: `Version Prompt ${Date.now()}`,
    value: "Version one",
  });
  await commitPrompt(page, workspace, prompt.id, "v1");

  await updatePrompt(page, workspace, prompt.id, { value: "Version two" });
  await commitPrompt(page, workspace, prompt.id, "v2");

  await versionsPage.openVersions(workspace.orgId, workspace.projectId, prompt.id);
  await expect(page.locator('a[href*="/versions/"]').first()).toBeVisible();

  await page.goto(
    `/${workspace.orgId}/${workspace.projectId}/prompt/${prompt.id}/compare`,
  );
  await expect(page).toHaveURL(/\/compare$/);

  const branches = await getPromptBranches(page, workspace, prompt.id);
  const versions = branches.flatMap((branch) => branch.promptVersions);
  expect(versions.length).toBeGreaterThan(0);

  const targetVersionId = versions[versions.length - 1]?.id ?? versions[0]?.id;
  await page.goto(
    `/${workspace.orgId}/${workspace.projectId}/prompt/${prompt.id}/versions/${targetVersionId}`,
  );
  await versionsPage.rollbackCurrentVersion();

  const promptAfterRollback = await getPrompt(page, workspace, prompt.id);
  expect(promptAfterRollback.value).toBe("Version one");
});
