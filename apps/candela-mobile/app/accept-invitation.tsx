import { useMemo, useState } from 'react';
import { Text } from 'react-native';
import { Link, useLocalSearchParams } from 'expo-router';
import { AuthShell, PasswordField, PrimaryButton } from '../src/components/AuthForm';
import { ApiError, api } from '../src/lib/api';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function AcceptInvitationScreen() {
  const { fs } = useLayout();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const rawToken = params.token;
  const queryToken = (Array.isArray(rawToken) ? rawToken[0] : rawToken)?.trim() ?? '';
  const [consumedToken, setConsumedToken] = useState<string | null>(null);
  const token = useMemo(
    () => (consumedToken !== null ? '' : queryToken),
    [consumedToken, queryToken],
  );
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit() {
    setError('');
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!token) {
      setError('This invitation link is invalid or has expired');
      return;
    }
    setSubmitting(true);
    try {
      await api('/api/auth/invitations/accept', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
      });
      setConsumedToken(token);
      setPassword('');
      setConfirm('');
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not activate your account');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token && !done) {
    return (
      <AuthShell title="Activate account">
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20) }}>
          This invitation link is missing or incomplete. Ask your clinic to resend the invitation, or{' '}
          <Link href="/login" style={{ color: colors.blue, fontWeight: '700' }}>
            sign in
          </Link>{' '}
          if you already activated.
        </Text>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Activate your account">
      {done ? (
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20) }}>
          Your account is ready.{' '}
          <Link href="/login" style={{ color: colors.blue, fontWeight: '700' }}>
            Sign in
          </Link>
        </Text>
      ) : (
        <>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: 16, lineHeight: fs(20) }}>
            Set a password to finish activating the account your clinician created for you.
          </Text>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            autoComplete="password-new"
          />
          <PasswordField
            label="Confirm password"
            value={confirm}
            onChange={setConfirm}
            autoComplete="password-new"
          />
          {error ? (
            <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 12 }}>{error}</Text>
          ) : null}
          <PrimaryButton disabled={submitting} onPress={() => void onSubmit()}>
            {submitting ? 'Activating…' : 'Activate account'}
          </PrimaryButton>
        </>
      )}
    </AuthShell>
  );
}
