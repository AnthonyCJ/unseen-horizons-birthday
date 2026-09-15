import type { PromptLanguage } from "./clarifying-prompt.mjs";

export function createPromptDownload(language: PromptLanguage): {
  filename: string;
  blob: Blob;
};
