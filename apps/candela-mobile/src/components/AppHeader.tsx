import { Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roleHomePath, useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';
import type { ReactNode } from 'react';
import { ArrowLeftIcon, LogOutIcon } from './icons';

export function AppHeader({
  extra,
  onBack,
  backHref,
}: {
  extra?: ReactNode;
  onBack?: () => void;
  backHref?: string;
}) {
  const { session, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { fs, s, pad } = useLayout();
  const homeHref = session ? roleHomePath(session.user.role) : '/';
  const onDocIdPage = pathname === '/docid';

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref as never);
    }
  };

  return (
    <View
      style={{
        paddingTop: insets.top + s(8),
        paddingHorizontal: pad,
        paddingBottom: s(12),
        minHeight: s(72),
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: s(8),
      }}
    >
      {session ? (
        <Pressable onPress={() => router.replace(homeHref as never)} style={{ flex: 1, paddingVertical: s(4) }}>
          <Text numberOfLines={1} style={{ fontSize: fs(16), fontWeight: '700', color: '#111827' }}>
            {session.user.name}
          </Text>
        </Pressable>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flexShrink: 1 }}>
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
        {onBack || backHref ? (
          <Pressable
            onPress={handleBack}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(4),
              paddingHorizontal: s(12),
              paddingVertical: s(7),
              borderRadius: s(12),
              backgroundColor: '#F3F4F6',
            }}
          >
            <ArrowLeftIcon size={s(14)} color="#6B7280" />
            <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151' }}>Back</Text>
          </Pressable>
        ) : null}
        {session ? (
          <Pressable
            onPress={async () => {
              await logout();
              router.replace('/');
            }}
            style={{
              width: s(36),
              height: s(36),
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: s(12),
              backgroundColor: '#FEF2F2',
              borderWidth: 1,
              borderColor: 'rgba(254,202,202,0.8)',
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <LogOutIcon size={s(16)} color="#DC2626" />
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
