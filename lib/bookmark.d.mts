export const BOOKMARK_SOURCE: string;
export const BOOKMARK_FILENAME: string;
export function loadBookmark(fetcher?: typeof fetch, signal?: AbortSignal): Promise<Blob>;
