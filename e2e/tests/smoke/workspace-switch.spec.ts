import { expect, test } from "../../fixtures/test";
import { apiBaseUrl } from "../../config/env";
import { createProject, deleteProject, getWorkspaceFromPage } from "../../support/api-client";
import { createE2EUser } from "../../support/user-data";

test.use({ storageState: { cookies: [], origins: [] } });

test("workspace switch keeps app usable", async ({ authPage, layoutPage, workspacePage, page }) => {
  const user = createE2EUser();
  const registerResponse = await page.request.post(new URL("/auth/local/register", apiBaseUrl).toString(), {
    data: {
      name: user.name,
      email: user.email,
      password: user.password,
    },
    failOnStatusCode: false,
  });
  expect(registerResponse.ok(), `Register failed: ${registerResponse.status()} ${await registerResponse.text()}`).toBeTruthy();
  await page.context().clearCookies();

  await page.goto("/login");
  await authPage.login(user.email, user.password);
  await layoutPage.openHome();
  const workspace = await getWorkspaceFromPage(page);

  const newProjectName = `E2E Workspace ${Date.now()}`;
  const newProject = await createProject(page, workspace, newProjectName);

  try {
    await page.reload();
    await workspacePage.switchToProject(newProjectName, newProject.id);
    await expect(page).toHaveURL(
      new RegExp(`/${workspace.orgId}/${newProject.id}/`),
    );

    await layoutPage.goToPrompts();
    await expect(page).toHaveURL(new RegExp(`/${workspace.orgId}/${newProject.id}/prompts$`));

    await workspacePage.openManageProjects();
  } finally {
    try {
      await page.goto(`/${workspace.orgId}/${workspace.projectId}/dashboard`);
      await deleteProject(page, workspace, newProject.id);
    } catch {
      // Best-effort cleanup to avoid masking the original assertion failure.
    }
  }
});
