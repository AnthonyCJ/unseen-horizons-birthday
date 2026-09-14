import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../lib/question-font-license.json" with { type: "json" };
import postcard from "../lib/postcard-font-license.json" with { type: "json" };
if (!manifest.chinese.embeddingAuthorized || !manifest.chinese.evidence.trim()) {
  throw new Error("Release blocked: record verifiable website embedding permission for the selected Chinese font.");
}
for (const font of [manifest.chinese, manifest.latin, postcard]) {
  const hash = createHash("sha256").update(readFileSync(new URL(`../${font.file}`, import.meta.url))).digest("hex");
  if (hash !== font.sha256) throw new Error(`Unexpected font bytes: ${font.family}`);
  if (!font.license || !readFileSync(new URL(`../${font.license}`, import.meta.url), "utf8").includes("SIL OPEN FONT LICENSE")) throw new Error(`OFL license missing: ${font.family}`);
  if (!font.notice || !readFileSync(new URL(`../${font.notice}`, import.meta.url), "utf8").includes("Copyright")) throw new Error(`Font copyright notice missing: ${font.family}`);
}
console.log("Question-card and postcard font resources and recorded OFL permissions verified.");
