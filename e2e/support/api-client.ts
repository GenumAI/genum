import { expect, type APIResponse, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { apiBaseUrl, authCredentialsPath } from "../config/env";

export type WorkspaceContext = {
  orgId: string;
  projectId: string;
};

type PromptPayload = {
  name?: string;
  value?: string;
};

type TestcasePayload = {
  promptId: number;
  input?: string;
  expectedOutput?: string;
  lastOutput?: string;
  name?: string;
  memoryId?: number | null;
};

const headers = (workspace: WorkspaceContext) => ({
  "Content-Type": "application/json",
  "lab-org-id": workspace.orgId,
  "lab-proj-id": workspace.projectId,
});

export function getWorkspaceFromUrl(rawUrl: string): WorkspaceContext {
  const { pathname } = new URL(rawUrl);
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(`Cannot resolve workspace from URL: ${rawUrl}`);
  }
  return { orgId: segments[0] as string, projectId: segments[1] as string };
}

export async function getWorkspaceFromPage(page: Page): Promise<WorkspaceContext> {
  return getWorkspaceFromUrl(page.url());
}

async function reloginViaApi(page: Page, baseUrl: string): Promise<boolean> {
  if (!fs.existsSync(authCredentialsPath)) return false;
  try {
    const raw = fs.readFileSync(authCredentialsPath, "utf-8");
    const creds = JSON.parse(raw) as { email?: string; password?: string };
    if (!creds.email || !creds.password) return false;

    const response = await page.request.post(
      new URL("/auth/local/login", baseUrl).toString(),
      {
        data: { email: creds.email, password: creds.password },
        failOnStatusCode: false,
      },
    );
    return response.ok();
  } catch {
    return false;
  }
}

async function executeWithReauth(
  page: Page,
  baseUrl: string,
  requestFn: () => Promise<APIResponse>,
): Promise<APIResponse> {
  let response = await requestFn();
  if (response.status() === 401 && (await reloginViaApi(page, baseUrl))) {
    response = await requestFn();
  }
  return response;
}

async function parseJson<T>(response: APIResponse): Promise<T> {
  const bodyText = await response.text();
  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error(`Expected JSON response, received: ${bodyText}`);
  }
}

export async function createPrompt(
  page: Page,
  workspace: WorkspaceContext,
  payload: PromptPayload = {},
): Promise<{ id: number; name: string }> {
  const body = {
    name: payload.name ?? `E2E Prompt ${Date.now()}`,
    value: payload.value ?? "",
  };

  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL("/prompts", apiBaseUrl).toString(), {
      headers: headers(workspace),
      data: body,
      failOnStatusCode: false,
    }),
  );

  expect(response.ok(), `createPrompt failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ prompt: { id: number; name: string } }>(response);
  return { id: parsed.prompt.id, name: parsed.prompt.name };
}

export async function deletePrompt(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.delete(new URL(`/prompts/${promptId}`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `deletePrompt failed: ${await response.text()}`).toBeTruthy();
}

export async function updatePrompt(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
  data: Record<string, unknown>,
): Promise<{ id: number; assertionType: string }> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.put(new URL(`/prompts/${promptId}`, apiBaseUrl).toString(), {
      headers: headers(workspace),
      data,
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `updatePrompt failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ prompt: { id: number; assertionType: string } }>(response);
  return parsed.prompt;
}

export async function getPrompt(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
): Promise<{ id: number; assertionType: string; value?: string }> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.get(new URL(`/prompts/${promptId}`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `getPrompt failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ prompt: { id: number; assertionType: string; value?: string } }>(response);
  return parsed.prompt;
}

export async function commitPrompt(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
  commitMessage: string,
): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL(`/prompts/${promptId}/commit`, apiBaseUrl).toString(), {
      headers: headers(workspace),
      data: { commitMessage },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `commitPrompt failed: ${await response.text()}`).toBeTruthy();
}

export async function getPromptBranches(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
): Promise<Array<{ id: number; promptVersions: Array<{ id: number }> }>> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.get(new URL(`/prompts/${promptId}/branches`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `getPromptBranches failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{
    branches: Array<{ id: number; promptVersions: Array<{ id: number }> }>;
  }>(response);
  return parsed.branches;
}

export async function runPrompt(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
  question: string,
): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL(`/prompts/${promptId}/run`, apiBaseUrl).toString(), {
      headers: headers(workspace),
      data: { question },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `runPrompt failed: ${await response.text()}`).toBeTruthy();
}

export async function getPromptLogsCount(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
): Promise<number> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.get(new URL(`/prompts/${promptId}/logs?page=1&pageSize=10`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `getPromptLogs failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ logs: unknown[] }>(response);
  return parsed.logs.length;
}

export async function createTestcase(
  page: Page,
  workspace: WorkspaceContext,
  payload: TestcasePayload,
): Promise<{ id: number; status: string }> {
  const executeCreate = () =>
    executeWithReauth(page, apiBaseUrl, () =>
      page.request.post(new URL("/testcases", apiBaseUrl).toString(), {
        headers: headers(workspace),
        data: {
          promptId: payload.promptId,
          input: payload.input ?? "E2E testcase input",
          expectedOutput: payload.expectedOutput ?? "E2E testcase expected",
          lastOutput: payload.lastOutput ?? "",
          name: payload.name ?? `E2E testcase ${Date.now()}`,
          memoryId: payload.memoryId,
        },
        failOnStatusCode: false,
      }),
    );

  let response = await executeCreate();
  let responseBody = await response.text();
  const isTransientProviderFailure =
    response.status() >= 500 && /(high demand|UNAVAILABLE|\"code\":503|SERVICE_UNAVAILABLE)/i.test(responseBody);

  if (!response.ok() && isTransientProviderFailure) {
    for (let attempt = 0; attempt < 2 && !response.ok(); attempt += 1) {
      await page.waitForTimeout(1_500 * (attempt + 1));
      response = await executeCreate();
      responseBody = await response.text();
      if (response.ok()) break;
    }
  }

  expect(response.ok(), `createTestcase failed: ${responseBody}`).toBeTruthy();
  const parsed = JSON.parse(responseBody) as { testcase: { id: number; status: string } };
  return { id: parsed.testcase.id, status: parsed.testcase.status };
}

export async function updateTestcase(
  page: Page,
  workspace: WorkspaceContext,
  testcaseId: number,
  data: Record<string, unknown>,
): Promise<{ id: number; status: string; expectedOutput: string }> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.put(new URL(`/testcases/${testcaseId}`, apiBaseUrl).toString(), {
      headers: headers(workspace),
      data,
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `updateTestcase failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{
    testcase: { id: number; status: string; expectedOutput: string };
  }>(response);
  return parsed.testcase;
}

export async function runTestcase(
  page: Page,
  workspace: WorkspaceContext,
  testcaseId: number,
): Promise<{ status: string }> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL(`/testcases/${testcaseId}/run`, apiBaseUrl).toString(), {
      headers: headers(workspace),
      data: {},
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `runTestcase failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ testcase: { status: string } }>(response);
  return { status: parsed.testcase.status };
}

export async function getTestcase(
  page: Page,
  workspace: WorkspaceContext,
  testcaseId: number,
): Promise<{ id: number; status: string; expectedOutput: string; files?: Array<{ fileId: string }> }> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.get(new URL(`/testcases/${testcaseId}`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `getTestcase failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{
    testcase: { id: number; status: string; expectedOutput: string; files?: Array<{ fileId: string }> };
  }>(response);
  return parsed.testcase;
}

export async function createMemory(
  page: Page,
  workspace: WorkspaceContext,
  promptId: number,
  key: string,
  value: string,
): Promise<{ id: number; value: string }> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL(`/prompts/${promptId}/memories`, apiBaseUrl).toString(), {
      headers: headers(workspace),
      data: { key, value },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `createMemory failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ memory: { id: number; value: string } }>(response);
  return parsed.memory;
}

export async function uploadFile(
  page: Page,
  workspace: WorkspaceContext,
  filePath: string,
  options: { mimeType?: string; fileName?: string } = {},
): Promise<{ id: string; name: string }> {
  const mimeType = options.mimeType ?? "application/pdf";
  const fileName = options.fileName ?? path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL("/files", apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      multipart: {
        file: {
          name: fileName,
          mimeType,
          buffer: fileBuffer,
        },
      },
      failOnStatusCode: false,
    }),
  );
  expect(
    response.ok(),
    `uploadFile failed (${response.status()}): ${await response.text()}`,
  ).toBeTruthy();
  const parsed = await parseJson<{ file: { id: string; name: string } }>(response);
  return parsed.file;
}

export async function listFiles(
  page: Page,
  workspace: WorkspaceContext,
): Promise<Array<{ id: string; name: string }>> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.get(new URL("/files", apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `listFiles failed (${response.status()}): ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ files: Array<{ id: string; name: string }> }>(response);
  return parsed.files;
}

export async function deleteFile(
  page: Page,
  workspace: WorkspaceContext,
  fileId: string,
): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.delete(new URL(`/files/${fileId}`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `deleteFile failed: ${await response.text()}`).toBeTruthy();
}

export async function attachFileToTestcase(
  page: Page,
  workspace: WorkspaceContext,
  testcaseId: number,
  fileId: string,
): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL(`/testcases/${testcaseId}/files`, apiBaseUrl).toString(), {
      headers: headers(workspace),
      data: { fileId },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `attachFileToTestcase failed: ${await response.text()}`).toBeTruthy();
}

export async function removeFileFromTestcase(
  page: Page,
  workspace: WorkspaceContext,
  testcaseId: number,
  fileId: string,
): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.delete(new URL(`/testcases/${testcaseId}/files/${fileId}`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `removeFileFromTestcase failed: ${await response.text()}`).toBeTruthy();
}

export async function createProject(
  page: Page,
  workspace: WorkspaceContext,
  name: string,
): Promise<{ id: number; name: string }> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL("/organization/projects", apiBaseUrl).toString(), {
      headers: headers(workspace),
      data: { name, description: `E2E project ${Date.now()}` },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `createProject failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ project: { id: number; name: string } }>(response);
  return parsed.project;
}

export async function getNotifications(
  page: Page,
): Promise<Array<{ id: string; read?: boolean }>> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.get(new URL("/user/notifications?page=1&limit=20", apiBaseUrl).toString(), {
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `getNotifications failed: ${await response.text()}`).toBeTruthy();
  const parsed = await parseJson<{ notifications: Array<{ id: string; read?: boolean }> }>(response);
  return parsed.notifications;
}

export async function markAllNotificationsAsRead(page: Page): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.post(new URL("/user/notifications/read-all", apiBaseUrl).toString(), {
      data: {},
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `markAllNotificationsAsRead failed: ${await response.text()}`).toBeTruthy();
}

export async function deleteProject(
  page: Page,
  workspace: WorkspaceContext,
  projectId: number,
): Promise<void> {
  const response = await executeWithReauth(page, apiBaseUrl, () =>
    page.request.delete(new URL(`/organization/projects/${projectId}`, apiBaseUrl).toString(), {
      headers: {
        "lab-org-id": workspace.orgId,
        "lab-proj-id": workspace.projectId,
      },
      failOnStatusCode: false,
    }),
  );
  expect(response.ok(), `deleteProject failed: ${await response.text()}`).toBeTruthy();
}
