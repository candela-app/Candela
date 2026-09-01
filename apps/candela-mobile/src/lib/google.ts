export const GOOGLE_WEB_CLIENT_ID =
  '405291424074-knff3jfq9b19bftr755b3kk99c25u6pv.apps.googleusercontent.com';

/** Android client is for native Play/SHA-1 sign-in only. Do not send it on the browser id_token flow. */
export const GOOGLE_ANDROID_CLIENT_ID =
  '405291424074-a4huuuicl40beg94cefqephabbqff7oa.apps.googleusercontent.com';

/** Must match Clients → Candela Web → Authorized redirect URIs exactly. */
export const GOOGLE_OAUTH_REDIRECT_URI = 'https://candela-app-eta.vercel.app/oauth/google';

export function googleOAuthRedirectUri(): string {
  return GOOGLE_OAUTH_REDIRECT_URI;
}

const consumedIdTokens = new Set<string>();

export function consumeGoogleIdToken(token: string): boolean {
  if (consumedIdTokens.has(token)) {
    return false;
  }
  consumedIdTokens.add(token);
  return true;
}

export const googleExpoRedirectUri = googleOAuthRedirectUri;
