import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import type { SessionUser } from '@candela/shared/rn';
import { ApiError, api } from '../src/lib/api';
import { roleHomePath, useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function OAuthReturnScreen() {
  const router = useRouter();
  const { applySession } = useAuth();
  const { fs } = useLayout();
  const params = useLocalSearchParams<{ id_token?: string | string[] }>();
  const raw = params.id_token;
  const idToken = Array.isArray(raw) ? raw[0] : raw;
  const [message, setMessage] = useState('Finishing Google sign-in…');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    if (!idToken) {
      setMessage('Missing Google token. Go back to sign in.');
      return;
    }
    started.current = true;
    void (async () => {
      try {
        const next = await api<SessionUser>('/api/auth/google', {
          method: 'POST',
          body: JSON.stringify({ idToken }),
        });
        applySession(next);
        router.replace(roleHomePath(next.user.role) as never);
      } catch (err) {
        const detail = err instanceof ApiError ? err.message : 'Could not sign in with Google';
        setMessage(
          idToken === 'testtoken'
            ? 'Return path works. testtoken is not a real Google token (expected).'
            : detail,
        );
      }
    })();
  }, [applySession, idToken, router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: fs(14), fontWeight: '600', color: colors.muted, textAlign: 'center' }}>{message}</Text>
      <Link href="/login" style={{ marginTop: 20, color: colors.blue, fontWeight: '700' }}>
        Sign in
      </Link>
    </View>
  );
}
