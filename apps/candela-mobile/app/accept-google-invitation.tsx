import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import type { SessionUser } from '@candela/shared/rn';
import { AuthShell, PrimaryButton } from '../src/components/AuthForm';
import { ApiError, api } from '../src/lib/api';
import { roleHomePath, useAuth } from '../src/lib/auth-context';
import {
  clearGoogleInvitationAcceptance,
  peekGoogleInvitationAcceptance,
  takeGoogleInvitationAcceptance,
  type StoredGoogleInvitationAcceptance,
} from '../src/lib/google-invitation';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function AcceptGoogleInvitationScreen() {
  const { fs, s } = useLayout();
  const router = useRouter();
  const { applySession } = useAuth();
  const [stored, setStored] = useState<StoredGoogleInvitationAcceptance | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStored(peekGoogleInvitationAcceptance());
    setReady(true);
  }, []);

  async function onAccept() {
    const current = peekGoogleInvitationAcceptance();
    if (!current?.acceptanceToken) {
      setError('Your Google confirmation expired. Sign in with Google again.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const next = await api<SessionUser>('/api/auth/invitations/accept-google', {
        method: 'POST',
        body: JSON.stringify({ acceptanceToken: current.acceptanceToken }),
      });
      takeGoogleInvitationAcceptance();
      applySession(next);
      router.replace(roleHomePath(next.user.role) as never);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Could not activate your account. Sign in with Google again, or ask your clinic for a new invitation.',
      );
      setSubmitting(false);
    }
  }

  function onDecline() {
    clearGoogleInvitationAcceptance();
    router.replace('/login');
  }

  if (!ready) {
    return (
      <AuthShell title="Confirm invitation">
        <Text style={{ fontSize: fs(13), color: colors.muted }}>Loading…</Text>
      </AuthShell>
    );
  }

  if (!stored) {
    return (
      <AuthShell title="Invitation confirmation expired">
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20), marginBottom: 16 }}>
          Please sign in with Google again to continue activating your clinic invitation.
        </Text>
        <Link href="/login" style={{ color: colors.blue, fontWeight: '700' }}>
          Back to sign in
        </Link>
      </AuthShell>
    );
  }

  const invite = stored.invitation;

  return (
    <AuthShell title="Accept your clinic invitation">
      <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20), marginBottom: s(16) }}>
        {stored.message ||
          'Your clinic invited you to Kandela. Confirm to finish activating your account with Google.'}
      </Text>
      <View
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: '#F9FAFB',
          borderRadius: s(16),
          padding: s(16),
          marginBottom: s(16),
          gap: s(8),
        }}
      >
        <Text style={{ fontSize: fs(13), color: colors.text }}>
          <Text style={{ fontWeight: '700' }}>Account: </Text>
          {invite.patientName}
        </Text>
        <Text style={{ fontSize: fs(13), color: colors.text }}>
          <Text style={{ fontWeight: '700' }}>Email: </Text>
          {invite.email}
        </Text>
        {invite.doctorName ? (
          <Text style={{ fontSize: fs(13), color: colors.text }}>
            <Text style={{ fontWeight: '700' }}>Clinician: </Text>
            {invite.doctorName}
          </Text>
        ) : null}
        {invite.organizationName ? (
          <Text style={{ fontSize: fs(13), color: colors.text }}>
            <Text style={{ fontWeight: '700' }}>Organisation: </Text>
            {invite.organizationName}
          </Text>
        ) : null}
        <Text style={{ fontSize: fs(12), color: colors.muted }}>
          Invitation expires {new Date(invite.invitationExpiresAt).toLocaleString()}
        </Text>
      </View>
      {error ? (
        <Text style={{ color: colors.red, fontWeight: '600', marginBottom: 12 }}>{error}</Text>
      ) : null}
      <PrimaryButton disabled={submitting} onPress={() => void onAccept()}>
        {submitting ? 'Activating…' : 'Accept invitation'}
      </PrimaryButton>
      <Pressable onPress={onDecline} disabled={submitting} style={{ marginTop: s(16), alignItems: 'center' }}>
        <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.muted }}>Not now</Text>
      </Pressable>
    </AuthShell>
  );
}
