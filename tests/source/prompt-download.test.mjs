import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { METHOD_PROMPTS } from "../../lib/clarifying-prompt.mjs";
import { createPromptDownload } from "../../lib/prompt-download.mjs";

const approved = {
  zh: { filename: "协作Prompt-中文-v1.2.1.txt", bytes: 4492, sha256: "edaa3a726f29dd336049f4c222b806a760edf1372538a6088f2e0f206f77b315" },
  en: { filename: "协作Prompt-英文-v1.2.1.txt", bytes: 6556, sha256: "195cdb263fd69f56ecd6a9c377b6bc279d1b63d7c342cea0c4651dd3a2668068" },
};

for (const language of ["zh", "en"]) {
  test(`${language} downloads the approved full Prompt as an unmodified UTF-8 text file`, async () => {
    const { filename, blob } = createPromptDownload(language);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(filename, approved[language].filename);
    assert.equal(blob.type, "text/plain;charset=utf-8");
    assert.equal(bytes.length, approved[language].bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), approved[language].sha256);
    assert.equal(await blob.text(), METHOD_PROMPTS[language].prompt);
  });
}

test("an unsupported language never silently saves a different template", () => {
  for (const language of [undefined, "fr", "", "toString"]) {
    assert.throws(() => createPromptDownload(language), TypeError);
  }
});
