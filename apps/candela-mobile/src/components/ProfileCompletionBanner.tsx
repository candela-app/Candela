import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { MeProfileResponse, ProfileCompletionStatus } from '@candela/shared/rn';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { dismissProfilePrompt, isProfilePromptDismissed } from '../lib/profile-prompt';
import { colors } from '../lib/theme';

function hrefFor(role: string): string {
  if (role === 'doctor') return '/doctor-profile';
  if (role === 'admin') return '/organization-profile';
  return '/profile';
}

export function ProfileCompletionBanner() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [completion, setCompletion] = useState<ProfileCompletionStatus | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading || !session || session.user.role === 'super_admin') {
      setVisible(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      if (await isProfilePromptDismissed(session.user.id)) {
        if (!cancelled) setVisible(false);
        return;
      }
      try {
        const me = await api<MeProfileResponse>('/api/me/profile');
        if (cancelled) return;
        const status =
          me.role === 'patient' || me.role === 'doctor'
            ? me.profile.completion
            : me.role === 'admin'
              ? me.profile?.completion ?? null
              : null;
        setCompletion(status);
        setVisible(Boolean(status && !status.profileComplete));
      } catch {
        if (!cancelled) setVisible(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, session]);

  if (!session || !visible || !completion || completion.profileComplete) return null;

  return (
    <View style={{ backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FDE68A', padding: 12 }}>
      <Text style={{ fontWeight: '700', color: '#78350F', marginBottom: 4 }}>Complete your profile</Text>
      <Text style={{ color: '#92400E', fontSize: 13, marginBottom: 8 }}>
        Missing: {completion.missingFields.slice(0, 3).join(', ') || 'required fields'}. Games stay available.
      </Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={() => router.push(hrefFor(session.user.role) as never)}
          style={{ backgroundColor: '#78350F', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Complete</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            void dismissProfilePrompt(session.user.id).then(() => setVisible(false));
          }}
          style={{
            backgroundColor: '#fff',
            borderWidth: 1,
            borderColor: '#FCD34D',
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: colors.text || '#111', fontWeight: '700', fontSize: 13 }}>Later</Text>
        </Pressable>
      </View>
    </View>
  );
}
