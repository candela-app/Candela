import type { CookieOptions, Response } from 'express';

export const ACCESS_COOKIE = 'candela_access';
export const REFRESH_COOKIE = 'candela_refresh';

export const ACCESS_MAX_AGE_SEC = 60 * 60 * 24;
export const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 14;

function baseCookieOptions(maxAgeSec: number): CookieOptions {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeSec * 1000,
  };
}

export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(ACCESS_COOKIE, accessToken, baseCookieOptions(ACCESS_MAX_AGE_SEC));
  res.cookie(REFRESH_COOKIE, refreshToken, baseCookieOptions(REFRESH_MAX_AGE_SEC));
}

export function clearAuthCookies(res: Response): void {
  const isProd = process.env.NODE_ENV === 'production';
  const clear: CookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  };
  res.clearCookie(ACCESS_COOKIE, clear);
  res.clearCookie(REFRESH_COOKIE, clear);
}
