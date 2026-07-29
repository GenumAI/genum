import type { Request, Response } from "express";
import { db } from "@/database/db";
import { env } from "@/env";
import { MailServiceCreateProjectSchema, MailServiceMintKeySchema } from "@/services/validate";
import { MailOnboardingService } from "@/services/mailservice.service";

export class MailServiceController {
	private readonly service = new MailOnboardingService(db);

	public async getContext(req: Request, res: Response) {
		const sub = String(req.params.sub ?? "");
		console.log(`[mail-service] context sub=${sub}`);

		const context = await this.service.getContext(sub);
		if (!context) {
			return res.status(404).json({ error: "User not found" });
		}

		res.status(200).json({ ...context, webUrl: env.FRONTEND_URL });
	}

	public async createProject(req: Request, res: Response) {
		const { sub, orgId, name } = MailServiceCreateProjectSchema.parse(req.body);
		console.log(`[mail-service] create-project sub=${sub} orgId=${orgId}`);

		const result = await this.service.createProject(sub, orgId, name);
		if (!result.ok) {
			if (result.reason === "user_not_found") {
				return res.status(404).json({ error: "User not found" });
			}
			return res.status(403).json({ error: "Insufficient permissions" });
		}

		res.status(200).json({ projectId: result.projectId, created: result.created });
	}

	public async mintProjectApiKey(req: Request, res: Response) {
		const { sub, projectId, name } = MailServiceMintKeySchema.parse(req.body);
		console.log(`[mail-service] mint-key sub=${sub} projectId=${projectId}`);

		const result = await this.service.mintProjectApiKey(sub, projectId, name);
		if (!result.ok) {
			if (result.reason === "user_not_found") {
				return res.status(404).json({ error: "User not found" });
			}
			return res.status(403).json({ error: "Insufficient permissions" });
		}

		res.status(200).json({ key: result.key });
	}
}
