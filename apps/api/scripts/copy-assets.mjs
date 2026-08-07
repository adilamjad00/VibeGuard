// tsc only emits .js — schema.sql has to be carried into dist/ by hand so the
// built artifact is self-contained and deployFiles only ever needs `dist`.
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

await mkdir(join(appRoot, "dist"), { recursive: true });
await copyFile(join(appRoot, "src", "schema.sql"), join(appRoot, "dist", "schema.sql"));

console.log("copied schema.sql -> dist/");
