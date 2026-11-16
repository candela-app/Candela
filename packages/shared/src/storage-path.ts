/**
 * Client must not supply arbitrary storage paths. Paths are set only by
 * authenticated upload handlers (Wave 4). Profile PATCH rejects these fields.
 */

const EXTERNAL_URL = /^(https?:)?\/\//i;
const TRAVERSAL = /(^|\/)\.\.(\/|$)/;

export function isDisallowedClientStoragePath(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (EXTERNAL_URL.test(trimmed)) return true;
  if (TRAVERSAL.test(trimmed)) return true;
  // Any non-empty client-supplied path is disallowed until server-side upload exists.
  return true;
}

export function isHttpsUrl(value: string | null | undefined): boolean {
  if (value == null || value.trim() === '') return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}
