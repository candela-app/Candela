import { useState, type ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { roleHomePath, useAuth } from '../lib/auth-context';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  CloseIcon,
  LogOutIcon,
  PencilIcon,
  UserIcon,
} from './icons';
import { EditPatientNameModal } from './EditPatientNameModal';

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
  const [showEditName, setShowEditName] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { fs, s, pad } = useLayout();
  const homeHref = session ? roleHomePath(session.user.role) : '/';
  const onDocIdPage = pathname === '/docid';
  const showBack = Boolean(onBack || backHref || onDocIdPage);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backHref) {
      router.push(backHref as never);
    } else if (onDocIdPage) {
      router.replace(homeHref as never);
    }
  };

  const initialLetter = session?.user?.name ? session.user.name.trim().charAt(0).toUpperCase() : '';

  return (
    <>
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
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {showBack ? (
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={s(8)}
              style={{
                width: s(36),
                height: s(36),
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ArrowLeftIcon size={s(22)} color="#111827" />
            </Pressable>
          ) : session ? (
            <Pressable onPress={() => router.replace(homeHref as never)} style={{ paddingVertical: s(4), maxWidth: '100%' }}>
              <Text numberOfLines={1} style={{ fontSize: fs(16), fontWeight: '700', color: '#111827' }}>
                {session.user.name}
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), flexShrink: 0 }}>
          {session?.user.role === 'patient' && !onDocIdPage ? (
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
          ) : null}

          {extra}

          {session ? (
            <Pressable
              onPress={() => setShowUserMenu(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: s(4),
                paddingHorizontal: s(8),
                paddingVertical: s(6),
                borderRadius: s(12),
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E5E7EB',
              }}
              accessibilityLabel="Account options"
            >
              <View
                style={{
                  width: s(28),
                  height: s(28),
                  borderRadius: s(8),
                  backgroundColor: colors.blue,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {initialLetter ? (
                  <Text style={{ fontSize: fs(13), fontWeight: '800', color: '#FFFFFF' }}>{initialLetter}</Text>
                ) : (
                  <UserIcon size={s(14)} color="#FFFFFF" />
                )}
              </View>
              <ChevronDownIcon size={s(12)} color="#6B7280" />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.push('/login')}
              style={{
                paddingHorizontal: s(14),
                paddingVertical: s(8),
                borderRadius: s(12),
                backgroundColor: colors.blue,
              }}
            >
              <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.white }}>Sign in</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* User profile dropdown modal */}
      {session && (
        <Modal
          visible={showUserMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowUserMenu(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.5)',
              justifyContent: 'center',
              paddingHorizontal: s(24),
            }}
            onPress={() => setShowUserMenu(false)}
          >
            <Pressable
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: s(24),
                padding: s(20),
                borderWidth: 1,
                borderColor: '#E5E7EB',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.15,
                shadowRadius: 24,
                elevation: 8,
              }}
              onPress={(e) => e.stopPropagation()}
            >
              <Pressable
                onPress={() => setShowUserMenu(false)}
                hitSlop={s(8)}
                style={{ position: 'absolute', top: s(16), right: s(16), padding: s(4) }}
              >
                <CloseIcon size={s(18)} color="#9CA3AF" />
              </Pressable>

              {/* Profile Card */}
              <View style={{ marginBottom: s(16) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8), marginBottom: s(4) }}>
                  <Text numberOfLines={1} style={{ fontSize: fs(17), fontWeight: '800', color: '#111827', flex: 1 }}>
                    {session.user.name}
                  </Text>
                  {session.user.role === 'patient' && (
                    <Pressable
                      onPress={() => {
                        setShowUserMenu(false);
                        setShowEditName(true);
                      }}
                      hitSlop={s(8)}
                      style={{
                        paddingHorizontal: s(8),
                        paddingVertical: s(4),
                        borderRadius: s(8),
                        backgroundColor: '#EFF6FF',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: s(4),
                      }}
                    >
                      <PencilIcon size={s(12)} color={colors.blue} />
                      <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.blue }}>Edit</Text>
                    </Pressable>
                  )}
                </View>
                <Text numberOfLines={1} style={{ fontSize: fs(12), color: '#6B7280', marginBottom: s(6) }}>
                  {session.user.email}
                </Text>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: '#F3F4F6',
                    paddingHorizontal: s(8),
                    paddingVertical: s(2),
                    borderRadius: s(6),
                  }}
                >
                  <Text style={{ fontSize: fs(10), fontWeight: '800', color: '#4B5563', textTransform: 'uppercase' }}>
                    {session.user.role}
                  </Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: '#F3F4F6', marginBottom: s(12) }} />

              {/* Sign out */}
              <Pressable
                onPress={async () => {
                  setShowUserMenu(false);
                  await logout();
                  router.replace('/');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(8),
                  paddingVertical: s(10),
                  paddingHorizontal: s(10),
                  borderRadius: s(12),
                  backgroundColor: '#FEF2F2',
                }}
              >
                <LogOutIcon size={s(16)} color="#DC2626" />
                <Text style={{ fontSize: fs(13), fontWeight: '700', color: '#DC2626' }}>Sign out</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}

      {session?.user.role === 'patient' && (
        <EditPatientNameModal
          visible={showEditName}
          onClose={() => setShowEditName(false)}
        />
      )}
    </>
  );
}


