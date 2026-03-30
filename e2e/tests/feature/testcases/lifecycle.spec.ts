import { expect, test } from "../../../fixtures/test";
import {
  createPrompt,
  createTestcase,
  getPrompt,
  getTestcase,
  getWorkspaceFromPage,
  runTestcase,
  updatePrompt,
  updateTestcase,
} from "../../../support/api-client";

test("add testcase from output", async ({
  layoutPage,
  promptsPage,
  playgroundPage,
  testcasesPage,
}) => {
  await layoutPage.openHome();
  await layoutPage.goToPrompts();
  await promptsPage.createPrompt();

  await playgroundPage.generateSystemInstruction("Summarize text");
  await playgroundPage.runPromptAndWaitOutput();
  await playgroundPage.saveOutputAsExpectedAndCreateTestcase();

  await layoutPage.goToTestcases();
  await testcasesPage.expectHasAtLeastOneTestcase();
});

test("run testcase and verify status transitions", async ({ layoutPage, page }) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  const prompt = await createPrompt(page, workspace, {
    name: `Status Prompt ${Date.now()}`,
    value: "You are a deterministic assistant",
  });
  await updatePrompt(page, workspace, prompt.id, { assertionType: "STRICT" });

  const testcase = await createTestcase(page, workspace, {
    promptId: prompt.id,
    input: "hello",
    expectedOutput: "different expected output",
    lastOutput: "",
  });
  expect(testcase.status).toBe("NEED_RUN");

  const runResult = await runTestcase(page, workspace, testcase.id);
  expect(runResult.status).not.toBe("NEED_RUN");
});

test("update expected output and prompt assertion", async ({ layoutPage, page }) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  const prompt = await createPrompt(page, workspace, {
    name: `Assertion Prompt ${Date.now()}`,
    value: "Answer shortly",
  });
  const testcase = await createTestcase(page, workspace, {
    promptId: prompt.id,
    expectedOutput: "before update",
  });

  const updatedTestcase = await updateTestcase(page, workspace, testcase.id, {
    expectedOutput: "after update",
  });
  expect(updatedTestcase.expectedOutput).toBe("after update");

  await updatePrompt(page, workspace, prompt.id, {
    assertionType: "MANUAL",
    assertionValue: "",
  });
  const updatedPrompt = await getPrompt(page, workspace, prompt.id);
  expect(updatedPrompt.assertionType).toBe("MANUAL");

  const fetchedTestcase = await getTestcase(page, workspace, testcase.id);
  expect(fetchedTestcase.expectedOutput).toBe("after update");
});
