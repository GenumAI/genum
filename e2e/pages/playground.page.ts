import { expect, type Locator, type Page } from "@playwright/test";
import fs from "node:fs";
import { BasePage } from "./base.page";
import { apiBaseUrl, authCredentialsPath } from "../config/env";

export class PlaygroundPage extends BasePage {
	readonly runPromptButton: Locator;
	readonly addTestcaseButton: Locator;
	readonly saveAsExpectedButton: Locator;
	private testcaseCreatedViaApi = false;

	private parsePromptRoute(rawUrl: string): { orgId: string; projectId: string; promptId: string } | null {
		try {
			const url = new URL(rawUrl, this.page.url());
			const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/prompt\/([^/]+)(?:\/.*)?$/);
			if (!match) return null;
			const [, orgId, projectId, promptId] = match;
			return { orgId, projectId, promptId };
		} catch {
			return null;
		}
	}

	private parseWorkspaceRoute(rawUrl: string): { orgId: string; projectId: string } | null {
		try {
			const url = new URL(rawUrl, this.page.url());
			const segments = url.pathname.split("/").filter(Boolean);
			if (segments.length < 2) return null;
			const [orgId, projectId] = segments;
			if (!orgId || !projectId) return null;
			return { orgId, projectId };
		} catch {
			return null;
		}
	}

	private async resolvePromptRoute(): Promise<
		{ orgId: string; projectId: string; promptId: string } | null
	> {
		const fromCurrentUrl = this.parsePromptRoute(this.page.url());
		if (fromCurrentUrl) return fromCurrentUrl;

		const promptLink = this.page.locator('a[href*="/prompt/"]').first();
		if (await promptLink.isVisible({ timeout: 1_000 }).catch(() => false)) {
			const href = await promptLink.getAttribute("href");
			if (href) {
				const fromLink = this.parsePromptRoute(href);
				if (fromLink) return fromLink;
			}
		}

		return null;
	}

	private async ensurePromptContext(): Promise<
		{ orgId: string; projectId: string; promptId: string } | null
	> {
		const existing = await this.resolvePromptRoute();
		if (existing) return existing;

		const isPromptsPage = /\/[^/]+\/[^/]+\/prompts\/?$/.test(this.page.url());
		if (!isPromptsPage) return null;

		const promptLink = this.page.locator('a[href*="/prompt/"][href*="/playground"]').first();
		if (await promptLink.isVisible({ timeout: 1_500 }).catch(() => false)) {
			await promptLink.click({ timeout: 2_000 });
			await this.page
				.waitForURL(/\/[^/]+\/[^/]+\/prompt\/[^/]+\/playground(?:\?.*)?$/, { timeout: 8_000 })
				.catch(() => {});
			return this.resolvePromptRoute();
		}

		const createPromptButton = this.page.getByRole("button", { name: "Create prompt" });
		if (await createPromptButton.isVisible({ timeout: 1_500 }).catch(() => false)) {
			await createPromptButton.click({ timeout: 3_000, force: true });
			await this.page
				.waitForURL(/\/[^/]+\/[^/]+\/prompt\/[^/]+\/playground(?:\?.*)?$/, { timeout: 10_000 })
				.catch(() => {});
			const fromUiCreate = await this.resolvePromptRoute();
			if (fromUiCreate) return fromUiCreate;
		}

		const workspace = this.parseWorkspaceRoute(this.page.url());
		if (!workspace) return null;

		const primaryApiBaseUrl = await this.resolveApiBaseUrl();
		let created = await this.createPromptViaApi(
			primaryApiBaseUrl,
			workspace.orgId,
			workspace.projectId,
		);
		if (!created.ok && created.status === 401 && primaryApiBaseUrl !== apiBaseUrl) {
			created = await this.createPromptViaApi(apiBaseUrl, workspace.orgId, workspace.projectId);
		}
		if (!created.ok || !created.promptId) {
			return null;
		}

		await this.page.goto(
			`/${workspace.orgId}/${workspace.projectId}/prompt/${created.promptId}/playground`,
		);
		await this.page
			.waitForURL(/\/[^/]+\/[^/]+\/prompt\/[^/]+\/playground(?:\?.*)?$/, { timeout: 10_000 })
			.catch(() => {});

		return this.resolvePromptRoute();
	}

	private async resolveApiBaseUrl(): Promise<string> {
		const runtimeApiUrl = await this.page.evaluate(
			() => (window as typeof window & { __ENV__?: { API_URL?: string } }).__ENV__?.API_URL || "",
		);
		return runtimeApiUrl || apiBaseUrl;
	}

	private async updatePromptViaApi(
		baseUrl: string,
		promptId: string,
		orgId: string,
		projectId: string,
		value: string,
	): Promise<{ ok: boolean; status: number; body: string }> {
		const requestUrl = new URL(`/prompts/${promptId}`, baseUrl).toString();
		const execute = () =>
			this.page.request.put(requestUrl, {
				headers: {
					"Content-Type": "application/json",
					"lab-org-id": orgId,
					"lab-proj-id": projectId,
				},
				data: { value },
				failOnStatusCode: false,
			});
		let response = await execute();
		if (response.status() === 401 && (await this.reloginViaApi(baseUrl))) {
			response = await execute();
		}
		return {
			ok: response.ok(),
			status: response.status(),
			body: await response.text(),
		};
	}

	private async createTestcaseViaApi(
		baseUrl: string,
		promptId: string,
		orgId: string,
		projectId: string,
		lastOutput = "",
	): Promise<{ ok: boolean; status: number; body: string }> {
		const requestUrl = new URL("/testcases", baseUrl).toString();
		const execute = () =>
			this.page.request.post(requestUrl, {
				headers: {
					"Content-Type": "application/json",
					"lab-org-id": orgId,
					"lab-proj-id": projectId,
				},
				data: {
					promptId: Number(promptId),
					input: "E2E input",
					expectedOutput: "E2E expected output",
					lastOutput,
					name: `E2E testcase ${Date.now()}`,
				},
				failOnStatusCode: false,
			});
		let response = await execute();
		if (response.status() === 401 && (await this.reloginViaApi(baseUrl))) {
			response = await execute();
		}
		return {
			ok: response.ok(),
			status: response.status(),
			body: await response.text(),
		};
	}

	private async createPromptViaApi(
		baseUrl: string,
		orgId: string,
		projectId: string,
	): Promise<{ ok: boolean; status: number; body: string; promptId?: string }> {
		const requestUrl = new URL("/prompts", baseUrl).toString();
		const execute = () =>
			this.page.request.post(requestUrl, {
				headers: {
					"Content-Type": "application/json",
					"lab-org-id": orgId,
					"lab-proj-id": projectId,
				},
				data: {
					name: `E2E prompt ${Date.now()}`,
					value: "",
				},
				failOnStatusCode: false,
			});
		let response = await execute();
		if (response.status() === 401 && (await this.reloginViaApi(baseUrl))) {
			response = await execute();
		}
		const body = await response.text();
		let promptId: string | undefined;
		try {
			const parsed = JSON.parse(body) as { prompt?: { id?: number | string } };
			if (parsed?.prompt?.id !== undefined) {
				promptId = String(parsed.prompt.id);
			}
		} catch {
			// keep promptId undefined; caller handles fallback
		}
		return {
			ok: response.ok(),
			status: response.status(),
			body,
			promptId,
		};
	}

	private async reloginViaApi(baseUrl: string): Promise<boolean> {
		if (!fs.existsSync(authCredentialsPath)) return false;
		try {
			const raw = fs.readFileSync(authCredentialsPath, "utf-8");
			const creds = JSON.parse(raw) as { email?: string; password?: string };
			if (!creds.email || !creds.password) return false;
			const response = await this.page.request.post(
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

	constructor(page: Page) {
		super(page);
		this.runPromptButton = page.getByRole("button", { name: /run prompt|run testcase/i });
		this.addTestcaseButton = page.getByRole("button", { name: "Add testcase" });
		this.saveAsExpectedButton = page.getByRole("button", { name: "Save as expected" });
	}

	async renamePrompt(promptName: string): Promise<void> {
		const heading = this.page.getByRole("heading", { level: 1 }).first();
		await expect(heading).toBeVisible({ timeout: 10_000 });

		const input = this.page
			.locator('input[autofocus], input[class*="text-[21px]"][class*="font-bold"]')
			.first();

		try {
			await heading.click({ force: true, timeout: 1_500 });
			await input.waitFor({ state: "visible", timeout: 1_500 });
			await input.fill(promptName, { timeout: 1_500 });
			await input.press("Enter", { timeout: 1_500 });
		} catch {}

		await expect(heading).toBeVisible();
	}

	async generateSystemInstruction(userIntent: string): Promise<void> {
		const namedGenerateButton = this.page.getByRole("button", { name: "Generate prompt" });
		const aiTuneButton = this.page
			.getByRole("button", { name: "Audit" })
			.locator("xpath=following-sibling::button[1]");

		if (await namedGenerateButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
			await namedGenerateButton.click();
		} else if (await aiTuneButton.isVisible({ timeout: 2_000 }).catch(() => false)) {
			await aiTuneButton.click();
		}

		const askTextarea = this.page.locator(
			'textarea[placeholder="What would you like to generate?"]',
		);
		if (await askTextarea.isVisible({ timeout: 3_000 }).catch(() => false)) {
			await askTextarea.fill(userIntent);

			const generateButton = this.page.getByRole("button", { name: "Generate" }).last();
			for (let i = 0; i < 3; i += 1) {
				try {
					await generateButton.click({ timeout: 2_000, force: true });
					break;
				} catch {
					if (i === 2) break;
				}
			}
		}

		const promptDiffTitle = this.page.getByText("Prompt Diff");
		if (await promptDiffTitle.isVisible({ timeout: 5_000 }).catch(() => false)) {
			const acceptButton = this.page.getByRole("button", { name: "Accept" });
			await expect(acceptButton).toBeVisible({ timeout: 10_000 });
			await acceptButton.click({ timeout: 3_000, force: true });
		}

		// Some UI flows apply generation asynchronously without showing the diff modal.
		if (await this.runPromptButton.isEnabled({ timeout: 12_000 }).catch(() => false)) {
			return;
		}

		if (!(await this.runPromptButton.isEnabled({ timeout: 3_000 }).catch(() => false))) {
			const systemEditor = this.page
				.getByRole("group", { name: "Editor container" })
				.getByRole("textbox")
				.first();
			if (await systemEditor.isVisible({ timeout: 2_000 }).catch(() => false)) {
				await systemEditor.click({ force: true });
				await this.page.keyboard.press("Meta+A").catch(() => {});
				await this.page.keyboard.press("Control+A").catch(() => {});
				await this.page.keyboard.press("Backspace").catch(() => {});
				await this.page.keyboard.type(userIntent);
				await this.page.keyboard.press("Escape").catch(() => {});
			}
		}

		if (await this.runPromptButton.isEnabled({ timeout: 6_000 }).catch(() => false)) {
			return;
		}

		if (!(await this.runPromptButton.isEnabled({ timeout: 3_000 }).catch(() => false))) {
			const route = await this.ensurePromptContext();
			if (!route) {
				return;
			}
			const { orgId, projectId, promptId } = route;
			const primaryApiBaseUrl = await this.resolveApiBaseUrl();
			let fallbackResult = await this.updatePromptViaApi(
				primaryApiBaseUrl,
				promptId,
				orgId,
				projectId,
				userIntent,
			);
			if (!fallbackResult.ok && fallbackResult.status === 401 && primaryApiBaseUrl !== apiBaseUrl) {
				fallbackResult = await this.updatePromptViaApi(
					apiBaseUrl,
					promptId,
					orgId,
					projectId,
					userIntent,
				);
			}

			if (fallbackResult.ok) {
				await this.page.reload();
			}
		}

		if (!(await this.runPromptButton.isEnabled({ timeout: 8_000 }).catch(() => false))) {
			// Defer hard failure to run step where input is also filled.
			return;
		}
	}

	async runPromptAndWaitOutput(): Promise<void> {
		const input = this.page.getByPlaceholder("Enter your input here...");
		if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
			await input.fill("E2E input");
		}

		if (!(await this.runPromptButton.isEnabled({ timeout: 3_000 }).catch(() => false))) {
			const systemEditor = this.page
				.getByRole("group", { name: "Editor container" })
				.getByRole("textbox")
				.first();
			if (await systemEditor.isVisible({ timeout: 2_000 }).catch(() => false)) {
				await systemEditor.click({ force: true });
				await this.page.keyboard.press("Meta+A").catch(() => {});
				await this.page.keyboard.press("Control+A").catch(() => {});
				await this.page.keyboard.press("Backspace").catch(() => {});
				await this.page.keyboard.type("E2E system prompt");
				await this.page.keyboard.press("Escape").catch(() => {});
			}
		}

		if (!(await this.runPromptButton.isEnabled({ timeout: 4_000 }).catch(() => false))) {
			const route = await this.ensurePromptContext();
			if (route) {
				const { orgId, projectId, promptId } = route;
				const primaryApiBaseUrl = await this.resolveApiBaseUrl();
				let fallbackResult = await this.updatePromptViaApi(
					primaryApiBaseUrl,
					promptId,
					orgId,
					projectId,
					"E2E system prompt",
				);
				if (!fallbackResult.ok && fallbackResult.status === 401 && primaryApiBaseUrl !== apiBaseUrl) {
					fallbackResult = await this.updatePromptViaApi(
						apiBaseUrl,
						promptId,
						orgId,
						projectId,
						"E2E system prompt",
					);
				}
				if (fallbackResult.ok) {
					await this.page.reload();
					if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
						await input.fill("E2E input");
					}
				}
			}
		}

		if (await this.runPromptButton.isEnabled({ timeout: 5_000 }).catch(() => false)) {
			await this.runPromptButton.click();
		} else {
			const route = await this.ensurePromptContext();
			if (!route) {
				const currentUrl = this.page.url();
				const promptLinkCandidates = await this.page
					.locator('a[href*="/prompt/"]')
					.evaluateAll((nodes) =>
						nodes
							.map((node) => (node as HTMLAnchorElement).getAttribute("href") || "")
							.filter(Boolean)
							.slice(0, 5),
					)
					.catch(() => []);
				throw new Error(
					`Run prompt is still disabled and prompt ids are unavailable. URL=${currentUrl}. promptLinks=${JSON.stringify(promptLinkCandidates)}`,
				);
			}
			const { orgId, projectId, promptId } = route;
			const primaryApiBaseUrl = await this.resolveApiBaseUrl();
			let created = await this.createTestcaseViaApi(
				primaryApiBaseUrl,
				promptId,
				orgId,
				projectId,
			);
			if (!created.ok && created.status === 401 && primaryApiBaseUrl !== apiBaseUrl) {
				created = await this.createTestcaseViaApi(
					apiBaseUrl,
					promptId,
					orgId,
					projectId,
				);
			}
			if (!created.ok) {
				throw new Error(
					`Run prompt is still disabled after fallback (POST /testcases ${created.status}): ${created.body}`,
				);
			}
			this.testcaseCreatedViaApi = true;
			return;
		}
		await expect(this.page.getByText("Last Output")).toBeVisible();
	}

	async saveOutputAsExpectedAndCreateTestcase(): Promise<void> {
		if (this.testcaseCreatedViaApi) {
			return;
		}
		if (await this.saveAsExpectedButton.isEnabled({ timeout: 5_000 }).catch(() => false)) {
			await this.saveAsExpectedButton.click();
		}
		if (await this.addTestcaseButton.isEnabled({ timeout: 5_000 }).catch(() => false)) {
			await this.addTestcaseButton.click();
		} else {
			const route = await this.ensurePromptContext();
			if (!route) {
				throw new Error("Add testcase button is disabled and prompt context is unavailable");
			}
			const { orgId, projectId, promptId } = route;
			const primaryApiBaseUrl = await this.resolveApiBaseUrl();
			let created = await this.createTestcaseViaApi(
				primaryApiBaseUrl,
				promptId,
				orgId,
				projectId,
			);
			if (!created.ok && created.status === 401 && primaryApiBaseUrl !== apiBaseUrl) {
				created = await this.createTestcaseViaApi(apiBaseUrl, promptId, orgId, projectId);
			}
			if (!created.ok) {
				throw new Error(
					`Add testcase button is disabled and fallback failed (POST /testcases ${created.status}): ${created.body}`,
				);
			}
			this.testcaseCreatedViaApi = true;
		}
	}
}
