import { Redirect } from 'expo-router';
import { Text, View } from 'react-native';
import { roleHomePath, useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function HomeScreen() {
  const { session, loading } = useAuth();
  const { fs } = useLayout();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: fs(14), fontWeight: '600', color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  if (session) {
    return <Redirect href={roleHomePath(session.user.role) as never} />;
  }

  return <Redirect href="/login" />;
}
