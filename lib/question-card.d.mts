export const QUESTION_LINES: string[];
export const CARD: Readonly<{ width: number; height: number; x: number; textWidth: number; fontSize: number; lineHeight: number; firstBaseline: number; nextBaseline: number; firstLines: number; nextLines: number; maxPages: number }>;
export type CardLine = { text: string; breakAfter: string };
export type CardPlan = { text: string; blank: boolean; pages: CardLine[][]; mode: "handwriting" | "plain"; font: string };
export class QuestionCardError extends Error { code: string; }
export function displayCardLine(line: string): string;
export function layoutCardLine(text: string, measure: (text: string) => Pick<TextMetrics, "width" | "actualBoundingBoxLeft" | "actualBoundingBoxRight" | "actualBoundingBoxAscent" | "actualBoundingBoxDescent">): { runs: { text: string; cjk: boolean; x: number; ascent: number; descent: number }[]; inset: number; width: number };
export function wrapCardLines(text: string, measure: (text: string) => number, maxWidth: number): CardLine[];
export function wrapCardText(text: string, measure: (text: string) => number, maxWidth: number): string[];
export function planQuestionCards(text: string, measure: (text: string) => number): Pick<CardPlan, "text" | "blank" | "pages">;
export function withDeadline<T>(operation: () => Promise<T>, ms: number, signal: AbortSignal | undefined, code: string): Promise<T>;
export function prepareQuestionCards(text: string, options?: { mode?: "handwriting" | "plain"; signal?: AbortSignal }): Promise<CardPlan>;
export function renderQuestionPage(plan: CardPlan, page: number, options?: { signal?: AbortSignal }): Promise<Blob>;
