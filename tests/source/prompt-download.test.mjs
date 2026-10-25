import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { METHOD_PROMPTS } from "../../lib/clarifying-prompt.mjs";
import { createPromptDownload } from "../../lib/prompt-download.mjs";

const approved = {
  zh: { filename: "协作启动Prompt-中文-v1.2.4.txt", bytes: 5577, sha256: "c5158f490a8052c6dfe832872f7597c261ef22689eda76909ebd1e93f67c5d26" },
  en: { filename: "协作启动Prompt-英文-v1.2.4.txt", bytes: 8284, sha256: "a176a935d396de692f83f76033ad912fe958e8490175b180de9d1011e73b7e14" },
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
