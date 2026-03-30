import { test } from "../../fixtures/test";

test("user creates prompt, generates output and adds testcase", async ({
  layoutPage,
  promptsPage,
  playgroundPage,
  testcasesPage,
}) => {
  const promptName = `Test Prompt ${Date.now()}`;
  const promptInstruction = "Summarize the following text";

  await test.step("Open prompts", async () => {
    await layoutPage.openHome();
    await layoutPage.goToPrompts();
  });

  await test.step("Create prompt and rename", async () => {
    await promptsPage.createPrompt();
    await playgroundPage.renamePrompt(promptName);
  });

  await test.step("Generate prompt content", async () => {
    await playgroundPage.generateSystemInstruction(promptInstruction);
  });

  await test.step("Run prompt and create testcase", async () => {
    await playgroundPage.runPromptAndWaitOutput();
    await playgroundPage.saveOutputAsExpectedAndCreateTestcase();
  });

  await test.step("Verify testcase appears", async () => {
    await layoutPage.goToTestcases();
    await testcasesPage.expectHasAtLeastOneTestcase();
  });
});
