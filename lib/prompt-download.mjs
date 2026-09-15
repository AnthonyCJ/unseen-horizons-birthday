import { METHOD_PROMPTS, PROMPT_VERSION } from "./clarifying-prompt.mjs";

// The saved file uses exactly the same full text as the copy action.
export function createPromptDownload(language) {
  if (language !== "zh" && language !== "en") throw new TypeError("Unsupported Prompt language");
  return {
    filename: `协作Prompt-${language === "zh" ? "中文" : "英文"}-v${PROMPT_VERSION}.txt`,
    blob: new Blob([METHOD_PROMPTS[language].prompt], { type: "text/plain;charset=utf-8" }),
  };
}
