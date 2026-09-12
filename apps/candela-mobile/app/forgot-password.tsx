import { useState } from 'react';
import { Text } from 'react-native';
import { Link } from 'expo-router';
import { AuthShell, Field, PrimaryButton } from '../src/components/AuthForm';
import { ApiError, api } from '../src/lib/api';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function ForgotPasswordScreen() {
  const { fs } = useLayout();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setError('');
    setSubmitting(true);
    try {
      await api('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a reset link');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell title="Forgot password">
      {done ? (
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20) }}>
          If an account exists for that email, we sent a reset link. Open it in a browser to choose a new
          password, then return here to sign in. Google Sign-In accounts keep using Google.
        </Text>
      ) : (
        <>
          <Field label="Email" value={email} onChange={setEmail} keyboardType="email-address" autoComplete="email" />
          {error ? <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 12 }}>{error}</Text> : null}
          <PrimaryButton disabled={submitting} onPress={() => void onSubmit()}>
            {submitting ? 'Sending…' : 'Send reset link'}
          </PrimaryButton>
        </>
      )}
      <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: 24, textAlign: 'center' }}>
        <Link href="/login" style={{ color: colors.blue, fontWeight: '700' }}>
          Back to sign in
        </Link>
      </Text>
    </AuthShell>
  );
}
