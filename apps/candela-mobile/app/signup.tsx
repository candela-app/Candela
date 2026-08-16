import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import type { SessionUser } from '@candela/shared/rn';
import { AuthShell, Field, PrimaryButton } from '../src/components/AuthForm';
import { ApiError, api } from '../src/lib/api';
import { roleHomePath, useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { session, loading, applySession } = useAuth();
  const { fs } = useLayout();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!loading && session) {
      setRedirecting(true);
      router.replace(roleHomePath(session.user.role) as never);
    }
  }, [loading, session, router]);

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      const next = await api<SessionUser>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      setRedirecting(true);
      applySession(next);
      router.replace(roleHomePath(next.user.role) as never);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof ApiError ? err.message : 'Could not create account');
    }
  }

  if (loading || session || redirecting) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: fs(14), fontWeight: '600', color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <AuthShell title="User registration">
      <Field label="Name" value={name} onChange={setName} autoComplete="name" />
      <Field label="Phone" value={phone} onChange={setPhone} keyboardType="phone-pad" autoComplete="tel" />
      <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoComplete="email" />
      <Field label="Password" value={password} onChange={setPassword} autoComplete="password-new" secureTextEntry />
      {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 12 }}>{error}</Text> : null}
      <PrimaryButton disabled={submitting} onPress={() => void onSubmit()}>
        {submitting ? 'Creating…' : 'Create account'}
      </PrimaryButton>
      <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: 24, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link href="/login" style={{ color: colors.blue, fontWeight: '700' }}>
          Sign in
        </Link>
      </Text>
    </AuthShell>
  );
}
