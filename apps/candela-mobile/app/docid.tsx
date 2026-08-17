import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader } from '../src/components/AppHeader';
import { DocIdRequestCard } from '../src/components/DocIdRequestCard';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function DocIdScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { fs, s, pad } = useLayout();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.user.role !== 'patient') {
      router.replace(session.user.role === 'admin' ? '/admin' : '/doctor');
    }
  }, [loading, session, router]);

  if (loading || !session || session.user.role !== 'patient') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader />
        <Text style={{ padding: 32, textAlign: 'center', color: colors.muted, fontWeight: '600' }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        <Text style={{ fontSize: fs(28), fontWeight: '800', color: colors.ink }}>Doctor link</Text>
        <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8), marginBottom: s(20), lineHeight: fs(20) }}>
          Attach to a clinic with a DocID, or request a switch if you are already linked. The requested doctor confirms
          attach and reassignment. An admin transfer is confirmed here by you.
        </Text>
        <DocIdRequestCard />
      </ScrollView>
    </View>
  );
}
