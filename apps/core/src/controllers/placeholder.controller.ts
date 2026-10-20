import type { Request, Response } from "express";
import { db } from "@/database/db";
import {
	PlaceholderCreateSchema,
	PlaceholderUpdateSchema,
	PlaceholderValueCreateSchema,
	PlaceholderValueUpdateSchema,
	numberSchema,
} from "@/services/validate";
import { PromptService } from "@/services/prompt.service";
import { checkPlaceholderAccess, checkPromptAccess } from "@/services/access/AccessService";
import { renamePlaceholderKey } from "@genum/placeholders";

export class PlaceholdersController {
	private promptService: PromptService;

	constructor() {
		this.promptService = new PromptService(db);
	}

	/**
	 * Placeholders are committed logic, so every mutation of one has to re-evaluate the
	 * commit status -- otherwise a renamed key or an edited value leaves the prompt
	 * reading "committed" while the productive commit serves a different snapshot.
	 *
	 * Re-reads the prompt rather than taking the caller's copy: a rename rewrites
	 * `Prompt.value` first, and hashing the pre-rewrite row would compare the new
	 * definitions against the old text.
	 */
	private async refreshCommitStatus(promptId: number) {
		const prompt = await db.prompts.getPromptById(promptId);
		if (!prompt) return;
		await this.promptService.updateCommitedStatus(prompt);
	}

	public async getPlaceholdersByPromptId(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const id = numberSchema.parse(req.params.id);
		await checkPromptAccess(id, metadata.projID);

		const placeholders = await db.placeholders.getPlaceholdersByPromptID(id);
		res.status(200).json({ placeholders });
	}

	public async createPlaceholder(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const data = PlaceholderCreateSchema.parse(req.body);
		await checkPromptAccess(promptId, metadata.projID);

		const existing = await db.placeholders.getPlaceholderByKeyAndPromptId(data.key, promptId);
		if (existing) {
			res.status(400).json({ error: "Placeholder key already exists. Key must be unique." });
			return;
		}

		const placeholder = await db.placeholders.createPlaceholder(promptId, data);
		await this.refreshCommitStatus(promptId);
		res.status(200).json({ placeholder });
	}

	public async getPlaceholderById(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);

		await checkPromptAccess(promptId, metadata.projID);
		const placeholder = await checkPlaceholderAccess(placeholderId, promptId);

		res.status(200).json({ placeholder });
	}

	public async updatePlaceholder(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const data = PlaceholderUpdateSchema.parse(req.body);

		const prompt = await checkPromptAccess(promptId, metadata.projID);
		const current = await checkPlaceholderAccess(placeholderId, promptId);

		if (data.key) {
			const existing = await db.placeholders.getPlaceholderByKeyAndPromptId(
				data.key,
				promptId,
			);
			if (existing && existing.id !== placeholderId) {
				res.status(400).json({
					error: "Placeholder key already exists. Key must be unique.",
				});
				return;
			}
		}

		const placeholder = await db.placeholders.updatePlaceholderByID(placeholderId, data);

		// A rename renames a definition; the prompt text still points at the old key, so
		// without this the hole renders verbatim and the author is told a placeholder they
		// merely renamed is "not defined". Rewriting the draft is what makes the two names
		// one name. Committed versions are never touched -- that would forge history --
		// so the prompt goes uncommitted below and its author decides when to publish.
		let renamedOccurrences = 0;
		if (data.key && data.key !== current.key) {
			const rewritten = renamePlaceholderKey(prompt.value, current.key, data.key);
			renamedOccurrences = rewritten.occurrences;
			if (renamedOccurrences > 0) {
				await db.prompts.updatePromptById(promptId, { value: rewritten.text });
			}
		}

		await this.refreshCommitStatus(promptId);
		res.status(200).json({ placeholder, renamedOccurrences });
	}

	public async deletePlaceholder(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		await db.placeholders.deletePlaceholderByID(placeholderId);
		await this.refreshCommitStatus(promptId);
		res.status(200).json({ ok: true });
	}

	public async createPlaceholderValue(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const data = PlaceholderValueCreateSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		const value = await db.placeholders.createValue(placeholderId, data);
		await this.refreshCommitStatus(promptId);
		res.status(200).json({ value });
	}

	public async updatePlaceholderValue(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const valueId = numberSchema.parse(req.params.valueId);
		const data = PlaceholderValueUpdateSchema.parse(req.body);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		const existing = await db.placeholders.getValueByIDAndPlaceholderId(valueId, placeholderId);
		if (!existing) {
			res.status(404).json({ error: "Placeholder value is not found" });
			return;
		}

		const value = await db.placeholders.updateValueByID(valueId, data);
		await this.refreshCommitStatus(promptId);
		res.status(200).json({ value });
	}

	public async deletePlaceholderValue(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const promptId = numberSchema.parse(req.params.id);
		const placeholderId = numberSchema.parse(req.params.placeholderId);
		const valueId = numberSchema.parse(req.params.valueId);

		await checkPromptAccess(promptId, metadata.projID);
		await checkPlaceholderAccess(placeholderId, promptId);

		const existing = await db.placeholders.getValueByIDAndPlaceholderId(valueId, placeholderId);
		if (!existing) {
			res.status(404).json({ error: "Placeholder value is not found" });
			return;
		}

		await db.placeholders.deleteValueByID(valueId);
		await this.refreshCommitStatus(promptId);
		res.status(200).json({ ok: true });
	}
}
