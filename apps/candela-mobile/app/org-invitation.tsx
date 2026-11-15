import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import type { DoctorOrganizationInvitationView } from '@candela/shared/rn';
import { AuthShell, PrimaryButton } from '../src/components/AuthForm';
import { ApiError, api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import {
  clearOrgInvitationToken,
  readOrgInvitationToken,
  storeOrgInvitationToken,
} from '../src/lib/org-invitation';
import { colors } from '../src/lib/theme';

export default function OrgInvitationScreen() {
  const { fs, s } = useLayout();
  const router = useRouter();
  const { session, loading } = useAuth();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const rawParam = params.token;
  const queryToken = (Array.isArray(rawParam) ? rawParam[0] : rawParam)?.trim() ?? '';

  const [token, setToken] = useState(() => queryToken || readOrgInvitationToken() || '');
  const [preview, setPreview] = useState<DoctorOrganizationInvitationView | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<'accepted' | 'declined' | null>(null);

  useEffect(() => {
    if (queryToken) {
      storeOrgInvitationToken(queryToken);
      setToken(queryToken);
    }
  }, [queryToken]);

  const loadPreview = useCallback(async (raw: string) => {
    if (!raw) {
      setError('This invitation link is missing or incomplete.');
      return;
    }
    setError('');
    try {
      const data = await api<DoctorOrganizationInvitationView>(
        `/api/doctor-organization-invitations/${encodeURIComponent(raw)}/preview`,
      );
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof ApiError ? err.message : 'Could not load this invitation');
    }
  }, []);

  useEffect(() => {
    if (token) void loadPreview(token);
  }, [token, loadPreview]);

  useEffect(() => {
    if (loading || !token) return;
    if (!session) {
      router.replace('/login' as never);
    }
  }, [loading, session, token, router]);

  const wrongRole = useMemo(
    () => Boolean(session && session.user.role !== 'doctor'),
    [session],
  );

  async function onAccept() {
    if (!token || !session) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/doctor-organization-invitations/${encodeURIComponent(token)}/accept`, {
        method: 'POST',
      });
      clearOrgInvitationToken();
      setDone('accepted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not accept invitation');
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!token || !session) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/doctor-organization-invitations/${encodeURIComponent(token)}/decline`, {
        method: 'POST',
      });
      clearOrgInvitationToken();
      setDone('declined');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not decline invitation');
    } finally {
      setBusy(false);
    }
  }

  if (loading || (!session && token)) {
    return (
      <AuthShell title="Organisation invitation">
        <Text style={{ fontSize: fs(13), color: colors.muted }}>Checking your session…</Text>
      </AuthShell>
    );
  }

  if (!token) {
    return (
      <AuthShell title="Organisation invitation">
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20) }}>
          This invitation link is incomplete. Ask your hospital administrator to resend it, or{' '}
          <Link href="/login" style={{ color: colors.blue, fontWeight: '700' }}>
            sign in
          </Link>
          .
        </Text>
      </AuthShell>
    );
  }

  if (wrongRole) {
    return (
      <AuthShell title="Organisation invitation">
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20) }}>
          Sign in with the invited doctor account to respond to this invitation.
        </Text>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title={done === 'accepted' ? 'Membership activated' : 'Invitation declined'}>
        <Text style={{ fontSize: fs(13), color: colors.muted, lineHeight: fs(20), marginBottom: 16 }}>
          {done === 'accepted'
            ? 'You can now work in this organisation from your doctor workspace.'
            : 'No membership was created.'}
        </Text>
        <PrimaryButton onPress={() => router.replace('/doctor' as never)}>
          Open doctor workspace
        </PrimaryButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Organisation invitation">
      {preview ? (
        <View style={{ marginBottom: 16, gap: 6 }}>
          <Text style={{ fontSize: fs(13), color: colors.ink }}>
            Organisation: {preview.organizationName}
          </Text>
          <Text style={{ fontSize: fs(13), color: colors.muted }}>Status: {preview.status}</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted }}>
            Expires: {new Date(preview.expiresAt).toLocaleString()}
          </Text>
        </View>
      ) : null}

      {error ? (
        <Text style={{ fontSize: fs(13), color: colors.red, marginBottom: 12 }}>{error}</Text>
      ) : null}

      {preview?.status === 'pending' ? (
        <View style={{ gap: 12 }}>
          <PrimaryButton disabled={busy || !session} onPress={() => void onAccept()}>
            {busy ? 'Working…' : 'Accept invitation'}
          </PrimaryButton>
          <Pressable
            disabled={busy || !session}
            onPress={() => void onDecline()}
            style={{
              marginTop: s(4),
              borderRadius: s(12),
              borderWidth: 1,
              borderColor: '#e5e7eb',
              paddingVertical: s(14),
              alignItems: 'center',
              opacity: busy || !session ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.ink, fontWeight: '700', fontSize: fs(14) }}>Decline</Text>
          </Pressable>
        </View>
      ) : preview ? (
        <Text style={{ fontSize: fs(13), color: colors.muted }}>
          This invitation is already {preview.status}.
        </Text>
      ) : null}
    </AuthShell>
  );
}
