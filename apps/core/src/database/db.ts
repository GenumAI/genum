import { PromptsRepository } from "./repositories/PromptsRepository";
import { TestcasesRepository } from "./repositories/TestcasesRepository";
import { MemoriesRepository } from "./repositories/MemoriesRepository";
import { UsersRepository } from "./repositories/UsersRepository";
import { OrganizationRepository } from "./repositories/OrganizationRepository";
import { ProjectRepository } from "./repositories/ProjectRepository";
import { AuthRepository } from "./repositories/AuthRepository";
import { FileRepository } from "./repositories/FileRepository";
import { prisma } from "@/database/prisma";
import { SystemRepository } from "./repositories/SystemRepository";

/**
 * centralized access to database repositories
 *
 * uses singleton pattern to ensure a single point of access
 * to all repositories in the application.
 *
 * advantages:
 * - no need to pass instance everywhere
 * - single point of access to the DB
 * - easy to mock for tests
 * - all repositories use the same PrismaClient (singleton)
 */
class Database {
	public readonly prompts: PromptsRepository;
	public readonly testcases: TestcasesRepository;
	public readonly memories: MemoriesRepository;
	public readonly users: UsersRepository;
	public readonly organization: OrganizationRepository;
	public readonly system: SystemRepository;
	public readonly project: ProjectRepository;
	public readonly auth: AuthRepository;
	public readonly file: FileRepository;

	constructor() {
		// all repositories use the same PrismaClient (singleton)
		this.system = new SystemRepository(prisma);
		this.prompts = new PromptsRepository(prisma, this.system);
		this.testcases = new TestcasesRepository(prisma);
		this.memories = new MemoriesRepository(prisma);
		this.users = new UsersRepository(prisma);
		this.organization = new OrganizationRepository(prisma);
		this.project = new ProjectRepository(prisma);
		this.auth = new AuthRepository(prisma);
		this.file = new FileRepository(prisma);
	}
}

// Singleton instance
let dbInstance: Database | undefined;

/**
 * get Database instance (singleton)
 *
 * in development mode, use global variable to support hot-reload
 */
function getDatabase(): Database {
	if (process.env.NODE_ENV === "production") {
		if (!dbInstance) {
			dbInstance = new Database();
		}
		return dbInstance;
	} else {
		// in development mode, use global variable to support hot-reload
		if (!global.__database) {
			global.__database = new Database();
		}
		return global.__database;
	}
}

declare global {
	// eslint-disable-next-line no-var
	var __database: Database | undefined;
}

// export singleton instance
export const db = getDatabase();

// export class for typing (can be used in constructors and etc.)
export { Database };
