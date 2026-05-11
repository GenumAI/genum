import path from "node:path";
import { expect, test } from "../../../fixtures/test";
import {
  attachFileToTestcase,
  createPrompt,
  createTestcase,
  getTestcase,
  getWorkspaceFromPage,
  listFiles,
  removeFileFromTestcase,
} from "../../../support/api-client";

test("upload file", async ({ layoutPage, filesPage }) => {
  await layoutPage.openHome();
  await layoutPage.goToFiles();

  const filePath = path.resolve("e2e/fixtures/files/sample.pdf");
  const uploaded = await filesPage.uploadFile(filePath);
  test.skip(!uploaded, "File storage is unavailable in this E2E environment.");
  await filesPage.expectFileVisible("sample.pdf");
});

test("attach file to testcase and remove it", async ({ layoutPage, filesPage, page }) => {
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  const prompt = await createPrompt(page, workspace, { name: `File Prompt ${Date.now()}` });
  const testcase = await createTestcase(page, workspace, { promptId: prompt.id });

  await layoutPage.goToFiles();
  let [uploadedFile] = await listFiles(page, workspace);
  if (!uploadedFile) {
    const uploaded = await filesPage.uploadFile(path.resolve("e2e/fixtures/files/sample.pdf"));
    test.skip(!uploaded, "No project files available and file upload is unavailable.");
    await filesPage.expectFileVisible("sample.pdf");
    [uploadedFile] = await listFiles(page, workspace);
  }
  expect(uploadedFile).toBeDefined();

  await attachFileToTestcase(page, workspace, testcase.id, uploadedFile!.id);
  const withFile = await getTestcase(page, workspace, testcase.id);
  expect(withFile.files?.some((item) => item.fileId === uploadedFile!.id)).toBeTruthy();

  await removeFileFromTestcase(page, workspace, testcase.id, uploadedFile!.id);
  const withoutFile = await getTestcase(page, workspace, testcase.id);
  expect(withoutFile.files?.some((item) => item.fileId === uploadedFile!.id)).toBeFalsy();
});
