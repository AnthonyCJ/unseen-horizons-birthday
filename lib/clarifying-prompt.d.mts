export type PromptLanguage = "zh" | "en";
export const PROMPT_VERSION: string;
export const CLARIFYING_PROMPT: string;
export const ENGLISH_CLARIFYING_PROMPT: string;
export const METHOD_PROMPTS: Readonly<Record<PromptLanguage, {
  prompt: string;
  lang: string;
  name: string;
  copyLabel: string;
  confirmation: string;
  guideLabel: string;
  promptLabel: string;
  quick: string;
  guide: {
    title: string;
    scope: string;
    intro: string;
    steps: ReadonlyArray<{ title: string; body: string }>;
    footer: string;
  };
}>>;
