import { z } from "zod";
import { ProjectMemberSchema, ProjectSchema as ProjectSchemaGenerated } from "@/prisma-types";
import { ProjectRole } from "@/prisma";
import { LogLevel, SourceType } from "@/services/logger/types";

const ProjectSchema = ProjectSchemaGenerated.extend({
	name: z.string().trim().min(1).max(128),
	description: z.string().trim().max(7_000).default(""),
});

export const ProjectCreateSchema = ProjectSchema.pick({
	name: true,
	description: true,
}).strict();

export type ProjectCreateType = z.infer<typeof ProjectCreateSchema>;

export const ProjectUpdateSchema = ProjectCreateSchema.partial().strict();

export type ProjectUpdateType = z.infer<typeof ProjectUpdateSchema>;

export const ProjectMemberCreateSchema = ProjectMemberSchema.omit({
	id: true,
	projectId: true,
})
	.extend({
		userId: z.coerce.number().int().positive(),
		role: z.enum(ProjectRole),
	})
	.strict();

export type ProjectMemberCreateType = z.infer<typeof ProjectMemberCreateSchema>;

export const ProjectMemberUpdateSchema = ProjectMemberSchema.omit({
	id: true,
	projectId: true,
	userId: true,
})
	.extend({
		role: z.enum(ProjectRole),
	})
	.strict();

export type ProjectMemberUpdateType = z.infer<typeof ProjectMemberUpdateSchema>;

export const ProjectUsageStatsSchema = z
	.object({
		fromDate: z.coerce.date(),
		toDate: z.coerce.date(),
	})
	.partial()
	.strict();

export type ProjectUsageStatsType = z.infer<typeof ProjectUsageStatsSchema>;

export const ProjectLogsQuerySchema = z
	.object({
		page: z.coerce.number().int().positive().default(1).optional(),
		pageSize: z.coerce.number().int().min(1).max(100).default(10).optional(),
		fromDate: z.coerce.date().optional(),
		toDate: z.coerce.date().optional(),
		logLevel: z.enum(LogLevel).optional(),
		promptId: z.coerce.number().int().positive().optional(),
		source: z.enum(SourceType).optional(),
		query: z.string().optional(),
	})
	.strict();

export type ProjectLogsQueryType = z.infer<typeof ProjectLogsQuerySchema>;
