import { Image, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roleHomePath, useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';
import type { ReactNode } from 'react';

export function AppHeader({ extra }: { extra?: ReactNode }) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { fs, s, pad } = useLayout();
  const logoHref = session ? roleHomePath(session.user.role) : '/';
  const onDocIdPage = pathname === '/docid';

  return (
    <View
      style={{
        paddingTop: insets.top + s(8),
        paddingHorizontal: pad,
        paddingBottom: s(12),
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: s(8),
      }}
    >
      <Pressable onPress={() => router.replace(logoHref as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <Image source={require('@candela/shared/assets/logo.jpeg')} style={{ width: fs(32), height: fs(32) }} resizeMode="contain" />
        <Text style={{ fontSize: fs(24), fontWeight: '800', color: colors.ink, letterSpacing: -0.4 }}>Kandela</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flexShrink: 1 }}>
        {session ? (
          <Text numberOfLines={1} style={{ maxWidth: s(100), fontSize: fs(13), fontWeight: '600', color: '#4B5563' }}>
            {session.user.name}
          </Text>
        ) : null}
        {session?.user.role === 'patient' ? (
          onDocIdPage ? (
            <Pressable
              onPress={() => router.push('/dashboard')}
              style={{
                paddingHorizontal: s(10),
                paddingVertical: s(7),
                borderRadius: s(12),
                backgroundColor: '#EFF6FF',
                borderWidth: 1,
                borderColor: '#BFDBFE',
              }}
            >
              <Text style={{ fontSize: fs(12), fontWeight: '700', color: '#1D4ED8' }}>Home</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/docid' as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(6),
                paddingHorizontal: s(10),
                paddingVertical: s(7),
                borderRadius: s(12),
                backgroundColor: '#EFF6FF',
                borderWidth: 1,
                borderColor: '#BFDBFE',
              }}
            >
              <Text style={{ fontSize: fs(12), fontWeight: '700', color: '#1D4ED8' }}>DocID</Text>
              {session.patient?.pendingDocIdRequest ? (
                <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: colors.blue }} />
              ) : null}
            </Pressable>
          )
        ) : null}
        {extra}
        {session ? (
          <Pressable
            onPress={async () => {
              await logout();
              router.replace('/login');
            }}
            style={{ paddingHorizontal: s(12), paddingVertical: s(7), borderRadius: s(12), backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' }}
          >
            <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#DC2626' }}>Sign out</Text>
          </Pressable>
        ) : (
          !loading && (
            <Pressable
              onPress={() => router.push('/login')}
              style={{ paddingHorizontal: s(12), paddingVertical: s(7), borderRadius: s(12), backgroundColor: '#F3F4F6' }}
            >
              <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151' }}>Sign in</Text>
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}
