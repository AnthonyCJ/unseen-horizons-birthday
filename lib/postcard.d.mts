export const POSTCARD_SOURCE: string;
export const POSTCARD_FILENAME: string;
export function loadPostcard(fetcher?: typeof fetch, signal?: AbortSignal): Promise<Blob>;
