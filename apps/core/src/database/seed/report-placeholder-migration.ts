import "dotenv/config";
import { prisma } from "@/database/prisma";

async function main() {
	const placeholders = await prisma.placeholder.findMany({
		where: { key: "memory_key" },
		include: { prompt: { select: { id: true, name: true, projectId: true } } },
	});

	const stale: string[] = [];
	for (const placeholder of placeholders) {
		const commit = await prisma.promptVersion.findFirst({
			where: { branch: { name: "master", promptId: placeholder.promptId } },
			orderBy: { id: "desc" },
		});
		if (commit && !commit.value.includes("{{memory_key}}")) {
			stale.push(
				`  prompt ${placeholder.prompt.id} "${placeholder.prompt.name}" (project ${placeholder.prompt.projectId})`,
			);
		}
	}

	if (stale.length === 0) {
		console.log("Every migrated prompt has {{memory_key}} in its productive commit.");
		return;
	}

	console.log(
		`${stale.length} prompt(s) run WITHOUT their memory block until re-committed:\n${stale.join("\n")}`,
	);
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
