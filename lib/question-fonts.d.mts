export const QUESTION_HAND_FONT: string;
export const QUESTION_PLAIN_FONT: string;
export function questionFontCoverage(text: string): { needsChinese: boolean; fallback: boolean; device: boolean };
export function loadQuestionFonts(text: string, options?: { mode?: "handwriting" | "plain"; signal?: AbortSignal }): Promise<void>;
