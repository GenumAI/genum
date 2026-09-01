import "dotenv/config";
import { prisma } from "@/database/prisma";
import { parsePlaceholderSnapshot } from "@/ai/placeholders/definitions";

async function main() {
	const placeholders = await prisma.placeholder.findMany({
		where: { key: "memory_key" },
		include: { prompt: { select: { id: true, name: true, projectId: true } } },
	});

	const missingMarker: string[] = [];
	const missingSnapshot: string[] = [];
	let skipped = 0;

	for (const placeholder of placeholders) {
		const commit = await prisma.promptVersion.findFirst({
			where: { branch: { name: "master", promptId: placeholder.promptId } },
			orderBy: { id: "desc" },
		});

		if (!commit) {
			// Nothing committed yet -- there is no productive text to check, so this
			// prompt is neither clean nor stale. Counted separately so the all-clear
			// line below cannot overclaim "every migrated prompt has it" when some had
			// nothing to check at all.
			skipped++;
			continue;
		}

		const label = `  prompt ${placeholder.prompt.id} "${placeholder.prompt.name}" (project ${placeholder.prompt.projectId})`;

		if (!commit.value.includes("{{memory_key}}")) {
			missingMarker.push(label);
			continue;
		}

		// The literal marker being present in the committed text is necessary but not
		// sufficient. A commit made before this migration ran (or before placeholders
		// existed at all) has a null `placeholders` snapshot column, which
		// `parsePlaceholderSnapshot` degrades to "no definitions" by design (Task 4) --
		// the renderer then leaves `{{memory_key}}` untouched in the text sent to the
		// model instead of substituting the memory content. This is the exact failure
		// mode the migration's own comment warns production stays on until re-commit,
		// so it has to be reported, not just the missing-marker case.
		const definitions = parsePlaceholderSnapshot(commit.placeholders);
		if (!definitions.some((definition) => definition.key === "memory_key")) {
			missingSnapshot.push(label);
		}
	}

	if (missingMarker.length === 0 && missingSnapshot.length === 0) {
		console.log(
			`Every migrated prompt with a committed version has {{memory_key}} live in its ` +
				`productive commit (${skipped} skipped: no productive commit yet).`,
		);
		return;
	}

	const sections: string[] = [];
	if (missingMarker.length > 0) {
		sections.push(
			`${missingMarker.length} prompt(s) run WITHOUT their memory block until re-committed ` +
				`-- no {{memory_key}} in the productive commit:\n${missingMarker.join("\n")}`,
		);
	}
	if (missingSnapshot.length > 0) {
		sections.push(
			`${missingSnapshot.length} prompt(s) have {{memory_key}} in the productive commit ` +
				`text but no matching definition in that commit's snapshot -- it renders as the ` +
				`literal marker, not the memory content, until re-committed:\n${missingSnapshot.join("\n")}`,
		);
	}
	sections.push(`${skipped} prompt(s) skipped: no productive commit to check.`);

	console.log(sections.join("\n\n"));
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
