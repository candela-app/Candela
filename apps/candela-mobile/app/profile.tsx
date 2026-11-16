import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  PROFILE_COUNTRY_OPTIONS,
  PROFILE_GENDER_OPTIONS,
  PROFILE_LANGUAGE_OPTIONS,
  ageFromIsoDate,
  type MeProfileResponse,
  type PatientIdentityProfile,
} from '@candela/shared/rn';
import { AppHeader } from '../src/components/AppHeader';
import { ProfileCompletionBanner } from '../src/components/ProfileCompletionBanner';
import { ApiError, api, deleteProfilePhoto, uploadProfilePhoto } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { clearProfilePromptDismiss } from '../src/lib/profile-prompt';
import { colors } from '../src/lib/theme';

export default function PatientProfileScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<PatientIdentityProfile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('');
  const [busy, setBusy] = useState(false);

  const isMinor = useMemo(() => {
    const age = dateOfBirth ? ageFromIsoDate(dateOfBirth) : null;
    return age != null && age < 18;
  }, [dateOfBirth]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (session.user.role !== 'patient') {
      router.replace('/');
      return;
    }
    void api<MeProfileResponse>('/api/me/profile').then((me) => {
      if (me.role !== 'patient') return;
      setProfile(me.profile);
      setName(me.profile.name || '');
      setPhone(me.profile.phone || '');
      setDateOfBirth(me.profile.dateOfBirth || '');
      setGender(me.profile.gender || '');
      setPreferredLanguage(me.profile.preferredLanguage || '');
      setCity(me.profile.city || '');
      setState(me.profile.state || '');
      setCountry(me.profile.country || '');
      setGuardianName(me.profile.guardianName || '');
      setGuardianPhone(me.profile.guardianPhone || '');
      setGuardianRelationship(me.profile.guardianRelationship || '');
    });
  }, [loading, session, router]);

  async function save() {
    setBusy(true);
    try {
      const me = await api<MeProfileResponse>('/api/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || null,
          dateOfBirth: dateOfBirth || null,
          gender: gender || null,
          preferredLanguage: preferredLanguage || null,
          city: city.trim() || null,
          state: state.trim() || null,
          country: country || null,
          guardianName: isMinor ? guardianName.trim() || null : null,
          guardianPhone: isMinor ? guardianPhone.trim() || null : null,
          guardianRelationship: isMinor ? guardianRelationship || null : null,
        }),
      });
      if (me.role === 'patient') setProfile(me.profile);
      Alert.alert('Saved', 'Profile updated.');
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
      if (me.role === 'patient') setProfile(me.profile);
      if (session?.user.id) await clearProfilePromptDismiss(session.user.id);
      Alert.alert('Completed', 'Identity profile marked complete.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not complete');
    } finally {
      setBusy(false);
    }
  }

  if (!session || session.user.role !== 'patient') return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F7FC' }}>
      <AppHeader />
      <ProfileCompletionBanner />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Identity profile</Text>
        <Text style={{ color: '#6B7280', marginBottom: 8 }}>
          {profile?.completion.profileComplete
            ? 'Complete'
            : `Missing: ${profile?.completion.missingFields.join(', ') || '…'}`}
        </Text>
        {(
          [
            ['Name', name, setName],
            ['Phone E.164', phone, setPhone],
            ['DOB YYYY-MM-DD', dateOfBirth, setDateOfBirth],
            ['Gender', gender, setGender],
            ['Language', preferredLanguage, setPreferredLanguage],
            ['City', city, setCity],
            ['State', state, setState],
            ['Country ISO-2', country, setCountry],
          ] as const
        ).map(([label, value, setter]) => (
          <View key={label}>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</Text>
            <TextInput
              value={value}
              onChangeText={setter}
              placeholder={
                label === 'Language'
                  ? PROFILE_LANGUAGE_OPTIONS.map((o) => o.value).join('/')
                  : label === 'Gender'
                    ? PROFILE_GENDER_OPTIONS.map((o) => o.value).join('/')
                    : label.startsWith('Country')
                      ? PROFILE_COUNTRY_OPTIONS.map((o) => o.value).join('/')
                      : undefined
              }
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
        {isMinor ? (
          <>
            <Text style={{ fontWeight: '700', marginTop: 8 }}>Guardian (required under 18)</Text>
            {(
              [
                ['Guardian name', guardianName, setGuardianName],
                ['Guardian phone', guardianPhone, setGuardianPhone],
                ['Guardian relationship', guardianRelationship, setGuardianRelationship],
              ] as const
            ).map(([label, value, setter]) => (
              <View key={label}>
                <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{label}</Text>
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
          </>
        ) : null}
        <Pressable
          disabled={busy}
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
          <Text style={{ fontWeight: '700', textAlign: 'center' }}>Upload profile photo</Text>
        </Pressable>
        <Pressable
          disabled={busy}
          onPress={() => void save()}
          style={{ backgroundColor: '#2563EB', borderRadius: 12, padding: 14 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>
            {busy ? 'Working…' : 'Save changes'}
          </Text>
        </Pressable>
        <Pressable
          disabled={busy || profile?.completion.profileComplete}
          onPress={() => void complete()}
          style={{ backgroundColor: '#111827', borderRadius: 12, padding: 14, opacity: profile?.completion.profileComplete ? 0.5 : 1 }}
        >
          <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>Mark complete</Text>
        </Pressable>
        <Pressable onPress={() => void deleteProfilePhoto()} style={{ padding: 8 }}>
          <Text style={{ color: '#DC2626', textAlign: 'center' }}>Remove photo</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
