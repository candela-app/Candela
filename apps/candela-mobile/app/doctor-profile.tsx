import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { PROFILE_LANGUAGE_OPTIONS, type DoctorIdentityProfile, type MeProfileResponse } from '@candela/shared/rn';
import { AppHeader } from '../src/components/AppHeader';
import { ProfileCompletionBanner } from '../src/components/ProfileCompletionBanner';
import { ApiError, api, uploadProfilePhoto } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { clearProfilePromptDismiss } from '../src/lib/profile-prompt';
import { colors } from '../src/lib/theme';

export default function DoctorProfileScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<DoctorIdentityProfile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [professionalTitle, setProfessionalTitle] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [externalRegistrationId, setExternalRegistrationId] = useState('');
  const [qualifications, setQualifications] = useState('MBBS');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'doctor') {
      router.replace('/login');
      return;
    }
    void api<MeProfileResponse>('/api/me/profile').then((me) => {
      if (me.role !== 'doctor') return;
      setProfile(me.profile);
      setName(me.profile.name || '');
      setPhone(me.profile.phone || '');
      setProfessionalTitle(me.profile.professionalTitle || '');
      setSpecialization(me.profile.specialization || '');
      setPreferredLanguage(me.profile.preferredLanguage || '');
      setYearsExperience(me.profile.yearsExperience != null ? String(me.profile.yearsExperience) : '');
      setExternalRegistrationId(me.profile.externalRegistrationId || '');
      setQualifications((me.profile.qualifications || []).join(', '));
    });
  }, [loading, session, router]);

  async function save() {
    setBusy(true);
    try {
      const years = yearsExperience.trim() === '' ? null : Number.parseInt(yearsExperience, 10);
      const quals = qualifications
        .split(',')
        .map((q) => q.trim())
        .filter(Boolean);
      const me = await api<MeProfileResponse>('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          professionalTitle: professionalTitle.trim() || null,
          specialization: specialization.trim() || null,
          preferredLanguage: preferredLanguage || null,
          yearsExperience: years,
          externalRegistrationId: externalRegistrationId.trim() || null,
          qualifications: quals.length ? quals : null,
        }),
      });
      if (me.role === 'doctor') setProfile(me.profile);
      Alert.alert('Saved', 'Professional profile updated.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    try {
      const me = await api<MeProfileResponse>('/api/me/profile/complete', { method: 'POST' });
      if (me.role === 'doctor') setProfile(me.profile);
      if (session?.user.id) await clearProfilePromptDismiss(session.user.id);
      Alert.alert('Completed', 'Professional profile marked complete.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not complete');
    } finally {
      setBusy(false);
    }
  }

  if (!session || session.user.role !== 'doctor') return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F7FC' }}>
      <AppHeader />
      <ProfileCompletionBanner />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Professional profile</Text>
        <Text style={{ color: '#6B7280' }}>DocID {profile?.referralCode || session.doctor?.referralCode}</Text>
        <Text style={{ color: '#6B7280', marginBottom: 8 }}>
          {profile?.completion.profileComplete
            ? 'Complete'
            : `Missing: ${profile?.completion.missingFields.join(', ') || '…'}`}
        </Text>
        {(
          [
            ['Name', name, setName],
            ['Phone', phone, setPhone],
            ['Professional title', professionalTitle, setProfessionalTitle],
            ['Specialization', specialization, setSpecialization],
            ['Language', preferredLanguage, setPreferredLanguage],
            ['Years experience', yearsExperience, setYearsExperience],
            ['External registration ID', externalRegistrationId, setExternalRegistrationId],
            ['Qualifications (comma-separated)', qualifications, setQualifications],
          ] as const
        ).map(([label, value, setter]) => (
          <View key={label}>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
              {label}
              {label === 'Language' ? ` (${PROFILE_LANGUAGE_OPTIONS.map((o) => o.value).join('/')})` : ''}
            </Text>
            <TextInput
              value={value}
              onChangeText={setter}
              style={{
                backgroundColor: '#fff',
                borderWidth: 1,
                borderColor: '#E5E7EB',
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            />
          </View>
        ))}
        <Pressable
          onPress={() =>
            void (async () => {
              const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
              });
              if (picked.canceled || !picked.assets[0]) return;
              try {
                await uploadProfilePhoto(picked.assets[0].uri, picked.assets[0].mimeType || undefined);
                Alert.alert('Photo updated');
              } catch (err) {
                Alert.alert('Error', err instanceof ApiError ? err.message : 'Upload failed');
              }
            })()
          }
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14 }}
        >
          <Text style={{ fontWeight: '700', textAlign: 'center' }}>Upload photo</Text>
        </Pressable>
        <Pressable disabled={busy} onPress={() => void save()} style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14 }}>
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{busy ? 'Working…' : 'Save'}</Text>
        </Pressable>
        <Pressable
          disabled={busy || profile?.completion.profileComplete}
          onPress={() => void complete()}
          style={{ backgroundColor: '#111827', borderRadius: 12, padding: 14, opacity: profile?.completion.profileComplete ? 0.5 : 1 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Mark complete</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
