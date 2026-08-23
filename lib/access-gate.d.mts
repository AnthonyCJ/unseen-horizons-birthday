export const ACCESS_KEY_SHA256: string;
export function parseAccessKey(hash: unknown): string | null;
export function constantTimeEqual(left: unknown, right: unknown): boolean;
export function sha256Hex(value: string): Promise<string>;
export function verifyAccessHash(hash: string): Promise<boolean>;
