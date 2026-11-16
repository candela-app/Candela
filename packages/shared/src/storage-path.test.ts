import { describe, expect, it } from 'vitest';
import { isDisallowedClientStoragePath, isHttpsUrl } from './storage-path';

describe('storage-path / website', () => {
  it('disallows client-supplied paths and URLs', () => {
    expect(isDisallowedClientStoragePath('https://evil.com/a.png')).toBe(true);
    expect(isDisallowedClientStoragePath('//cdn.example/x')).toBe(true);
    expect(isDisallowedClientStoragePath('../other/user.png')).toBe(true);
    expect(isDisallowedClientStoragePath('profile-photos/user-1/a.png')).toBe(true);
    expect(isDisallowedClientStoragePath(null)).toBe(false);
    expect(isDisallowedClientStoragePath('')).toBe(false);
  });

  it('requires https for websites', () => {
    expect(isHttpsUrl('https://example.com')).toBe(true);
    expect(isHttpsUrl('http://example.com')).toBe(false);
    expect(isHttpsUrl('ftp://example.com')).toBe(false);
    expect(isHttpsUrl('not a url')).toBe(false);
  });
});
