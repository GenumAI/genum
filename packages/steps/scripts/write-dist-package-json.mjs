// Stamps each dist output directory with the package.json Node needs to tell
// CommonJS files from ES module files apart when there is no file-extension
// signal (both trees emit plain .js). Without these markers, Node treats
// every .js file under a package as CommonJS by default, which would break
// the ESM tree at runtime for any consumer that loads it outside a bundler.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));

writeFileSync(
	resolve(rootDir, "dist/cjs/package.json"),
	`${JSON.stringify({ type: "commonjs" }, null, 2)}\n`,
);
writeFileSync(
	resolve(rootDir, "dist/esm/package.json"),
	`${JSON.stringify({ type: "module" }, null, 2)}\n`,
);
