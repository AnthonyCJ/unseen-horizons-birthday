export const QUESTION_DRAFT_LIMIT: number;
export const QUESTION_TEXT_BYTES: number;
export function visibleLength(text: string): number;
export function normalizeQuestionText(text: string): string;
export function splitGraphemes(text: string): IterableIterator<string>;
export class QuestionTextError extends RangeError { code: string; }
export function validateQuestionText(text: string): { text: string; length: number };
