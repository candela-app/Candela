import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import type { SessionUser } from '@candela/shared/rn';
import { AuthShell, Field, PrimaryButton, WebsiteExploreNote } from '../src/components/AuthForm';
import { AuthDivider, GoogleSignInButton } from '../src/components/GoogleSignInButton';
import { ScreenLoader } from '../src/components/ScreenLoader';
import { ApiError, api } from '../src/lib/api';
import { roleHomePath, useAuth } from '../src/lib/auth-context';
import { consumeGoogleIdToken } from '../src/lib/google';
import { clearTokens } from '../src/lib/tokens';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id_token?: string | string[] }>();
  const { session, loading, applySession } = useAuth();
  const { fs } = useLayout();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const finishing = submitting || googleBusy;

  useEffect(() => {
    if (loading || !session) {
      return;
    }
    router.replace(roleHomePath(session.user.role) as never);
  }, [loading, session, router]);

  useEffect(() => {
    const raw = params.id_token;
    const idToken = Array.isArray(raw) ? raw[0] : raw;
    if (!idToken || !consumeGoogleIdToken(idToken)) {
      return;
    }
    void onGoogle(idToken);
  }, [params.id_token]);

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await clearTokens();
      const next = await api<SessionUser>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      applySession(next);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof ApiError ? err.message : 'Could not create account');
    }
  }

  async function onGoogle(idToken: string) {
    setError('');
    setGoogleBusy(true);
    try {
      const next = await api<SessionUser>('/api/auth/google', {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      });
      applySession(next);
    } catch (err) {
      setGoogleBusy(false);
      setError(err instanceof ApiError ? err.message : 'Could not continue with Google');
    }
  }

  if (loading && !finishing) {
    return <ScreenLoader />;
  }

  if (session && !finishing) {
    return <ScreenLoader />;
  }

  return (
    <AuthShell title="User registration">
      <Field label="Name" value={name} onChange={setName} autoComplete="name" />
      <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChange={setPassword} autoComplete="password-new" secureTextEntry />
      {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 12 }}>{error}</Text> : null}
      <PrimaryButton disabled={finishing} onPress={() => void onSubmit()}>
        {submitting ? 'Creating…' : 'Create account'}
      </PrimaryButton>
      <AuthDivider />
      <GoogleSignInButton disabled={submitting} busy={googleBusy} returnPath="signup" onIdToken={onGoogle} />
      <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: 24, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: colors.blue, fontWeight: '700' }}>
          Sign in
        </Link>
      </Text>
      <WebsiteExploreNote />
    </AuthShell>
  );
}
