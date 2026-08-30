/**
 * pg v8 treats sslmode=require as verify-full. Supabase pooler certs then fail
 * with "self-signed certificate in certificate chain" on Render.
 */
export function postgresConnectionUrl(raw: string): string {
  const url = new URL(raw);
  url.searchParams.set('sslmode', 'no-verify');
  return url.toString();
}
