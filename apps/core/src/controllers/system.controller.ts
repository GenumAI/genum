import type { Request, Response } from "express";
import { db } from "@/database/db";
import { OrganizationCreateSchema } from "@/services/validate";

export class SystemController {
	public async createOrganization(req: Request, res: Response) {
		const metadata = req.genumMeta.ids;
		const data = OrganizationCreateSchema.parse(req.body);

		const organization = await db.organization.createSharedOrganization(
			data.name,
			data.description,
			metadata.userID,
		);

		res.status(200).json({
			organization,
		});
	}
}
