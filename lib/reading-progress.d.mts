export type ReadingProgress = { version: number; overview: boolean; opened: number };
export const READING_STORAGE_KEY: string;
export const EMPTY_READING_PROGRESS: Readonly<ReadingProgress>;
export function parseReadingProgress(value: string | null): ReadingProgress;
export function advanceReadingProgress(record: ReadingProgress, event?: { atOverview?: boolean; openedFinding?: number | null }): ReadingProgress;
export function readingShortcutLabel(record: ReadingProgress): string | null;
export function updateReadingProgress(options: {
  storage: Pick<Storage, "getItem" | "setItem">;
  preview: boolean;
  current: ReadingProgress;
  atOverview?: boolean;
  openedFinding?: number | null;
}): ReadingProgress;
