import type { OrganizationRole } from "@/api/organization";
import type { ProjectRole } from "@/api/project";

export type UserType = {
	name: string;
	email: string;
	organizations: {
		id: number;
		name: string;
		description: string;
		role: OrganizationRole;
		projects: {
			id: number;
			name: string;
			description: string;
			role: ProjectRole;
		}[];
	}[];
};
