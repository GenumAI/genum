import { expect, test } from "../../../fixtures/test";
import {
  createPrompt,
  getPromptLogsCount,
  getWorkspaceFromPage,
  runPrompt,
} from "../../../support/api-client";

test("prompt run appears in logs table", async ({ layoutPage, logsPage, page }) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  const prompt = await createPrompt(page, workspace, {
    name: `Logs Prompt ${Date.now()}`,
    value: "Return short answer",
  });
  await runPrompt(page, workspace, prompt.id, "hello from e2e");

  await layoutPage.goToLogs();
  await logsPage.expectLogsTableVisible();

  const logsCount = await getPromptLogsCount(page, workspace, prompt.id);
  expect(logsCount).toBeGreaterThan(0);
});

test("log filters return stable result set", async ({ layoutPage, logsPage, page }) => {
  await layoutPage.openHome();
  await layoutPage.goToLogs();
  await logsPage.expectLogsTableVisible();

  await logsPage.applyQueryFilter("non-existent-query-token");

  const firstVisibleRows = await page.locator("table tbody tr").count();
  await logsPage.applyQueryFilter("non-existent-query-token");
  const secondVisibleRows = await page.locator("table tbody tr").count();

  expect(secondVisibleRows).toBe(firstVisibleRows);
});
