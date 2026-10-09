import type { Request, Response } from "express";
import { db } from "@/database/db";
import { objToXml } from "@/utils/xml";
import { PromptCommitSchema, numberSchema, stringSchema } from "@/services/validate";
import { PromptService } from "@/services/prompt.service";
import { findDiff, type PromptState } from "@/utils/diff";
import { checkPromptAccess } from "@/services/access/AccessService";
import { system_prompt } from "@/ai/runner/system";
import type { ModelConfigParameters } from "@/ai/models/types";
import { ensureModelEnabledForOrg } from "./prompt.shared";

export class PromptVersionsController {
	private promptService: PromptService;

	constructor() {
		this.promptService = new PromptService(db);
	}

	public async getBranches(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);

		await checkPromptAccess(id, metadata.projID);

		const branches = await db.prompts.getBranchesByPromptID(id);
		res.status(200).json({ branches });
	}

	public async getCommitsByBranch(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const branch = stringSchema.parse(req.params.branch);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const author = req.query.author ? numberSchema.parse(req.query.author) : undefined; // todo validation of query params

		const commits = await db.prompts.getCommitsByBranch(id, branch, author);
		res.status(200).json({ commits });
	}

	public async commitPrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;
		const { commitMessage } = PromptCommitSchema.parse(req.body);

		const prompt = await checkPromptAccess(id, metadata.projID);

		if (
			!(await ensureModelEnabledForOrg(
				metadata.orgID,
				prompt.languageModelId,
				res,
				"Cannot commit: This prompt uses a model that is disabled for your organization. Please change the model first.",
			))
		) {
			return;
		}

		const version = await db.prompts.commit(id, commitMessage, metadata.userID);

		// change prompt to commited
		// await db.prompts.changePromptCommitStatus(id, true);

		await this.promptService.updateCommitedStatus(prompt);

		res.status(200).json({ version });
	}

	public async getCommit(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const commitId = numberSchema.parse(req.params.commitId);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const version = await db.prompts.getPromptVersion(id, commitId);
		if (!version) {
			res.status(404).json({ error: "Commit not found" });
			return;
		}

		res.status(200).json({ version });
	}

	public async rollbackPrompt(req: Request, res: Response) {
		const id = numberSchema.parse(req.params.id);
		const commitId = numberSchema.parse(req.params.commitId);
		const metadata = req.genumMeta.ids;

		await checkPromptAccess(id, metadata.projID);

		const version = await db.prompts.getPromptVersion(id, commitId);
		if (!version) {
			res.status(404).json({ error: "Commit not found" });
			return;
		}

		const updateAudit = version.audit !== null;

		const updatedPrompt = await db.prompts.rollbackPrompt(id, version, updateAudit);

		// Carry the rolled-back version's own placeholder snapshot forward instead of
		// letting commit() re-snapshot the live tables: the old text and the old
		// definitions must land in the new commit together, or a renamed/deleted key
		// pairs old text with today's definitions -- the exact drift this feature
		// exists to remove.
		const rollbackVersion = await db.prompts.commit(
			id,
			`Rollback to ${version.commitHash.slice(0, 8)}`,
			metadata.userID,
			version.placeholders,
		);

		await this.promptService.updateCommitedStatus(updatedPrompt);

		res.status(200).json({ rollbackVersion });
	}

	public async generateCommit(req: Request, res: Response) {
		const promptId = numberSchema.parse(req.params.id);
		const metadata = req.genumMeta.ids;

		let diff = "";

		const prompt = await checkPromptAccess(promptId, metadata.projID);

		const lastCommit = await db.prompts.getProductiveCommit(promptId); // todo consider that last = productive
		if (!lastCommit) {
			diff = "No last commit found. Init commit.";
		} else if (prompt.commited) {
			diff = "Prompt is commited. No changes to commit.";
		} else {
			const lastCommits = await db.prompts.getLastCommits(promptId, "master", 3);
			const lastCommitsMessage = lastCommits
				.map((commit) => {
					return `- ${commit.commitMsg}`;
				})
				.join("\n");

			const oldState: PromptState = {
				value: lastCommit.value,
				languageModelConfig: lastCommit.languageModelConfig as ModelConfigParameters,
				languageModelId: lastCommit.languageModelId,
			};

			const newState: PromptState = {
				value: prompt.value,
				languageModelConfig: prompt.languageModelConfig as ModelConfigParameters,
				languageModelId: prompt.languageModelId,
			};

			diff = await findDiff(oldState, newState, async (modelId) => {
				const model = await db.languageModels.getModelById(modelId);
				if (!model) {
					throw new Error("Model not found");
				}
				return model.name;
			});

			diff = objToXml({
				last_commits: lastCommitsMessage,
				changes: diff,
			});
		}

		const result = await system_prompt.commitMessageGenerator(
			diff,
			metadata.orgID,
			metadata.projID,
		);

		res.status(200).json({ message: result.answer });
	}
}
