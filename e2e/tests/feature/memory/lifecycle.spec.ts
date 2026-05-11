import { expect, test } from "../../../fixtures/test";
import { createPrompt, getWorkspaceFromPage } from "../../../support/api-client";

test("create, update and delete memory entries", async ({
  layoutPage,
  memoryPage,
  page,
}) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  const prompt = await createPrompt(page, workspace, {
    name: `Memory Prompt ${Date.now()}`,
    value: "Memory-enabled prompt",
  });

  const memoryKey = `memory_key_${Date.now()}`;
  const memoryValue = "initial memory value";
  const updatedValue = "updated memory value";

  await memoryPage.openMemory(workspace.orgId, workspace.projectId, prompt.id);
  await memoryPage.createMemory(memoryKey, memoryValue);
  await memoryPage.expectMemoryVisible(memoryKey);

  await memoryPage.editMemoryValue(updatedValue);
  await expect(page.getByText(updatedValue)).toBeVisible();

  await memoryPage.deleteMemory();
  await memoryPage.expectMemoryNotVisible(memoryKey);
});
