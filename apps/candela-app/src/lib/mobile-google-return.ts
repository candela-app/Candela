export function readOAuthParams(): URLSearchParams {
  const merged = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    new URLSearchParams(hash).forEach((value, key) => {
      merged.set(key, value);
    });
  }
  return merged;
}

export function isAppReturnUrl(url: string): boolean {
  return /^(exp:\/\/|candela:\/\/)/i.test(url);
}

export function returnToMobileApp(): boolean {
  const params = readOAuthParams();
  const idToken = params.get('id_token');
  const returnTo = params.get('state');
  if (!idToken || !returnTo || !isAppReturnUrl(returnTo)) {
    return false;
  }
  const join = returnTo.includes('?') ? '&' : '?';
  window.location.replace(`${returnTo}${join}id_token=${encodeURIComponent(idToken)}`);
  return true;
}
