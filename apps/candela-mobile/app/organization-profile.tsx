import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ORGANIZATION_TYPE_OPTIONS,
  type MeProfileResponse,
  type OrganizationIdentityProfile,
} from '@candela/shared/rn';
import { AppHeader } from '../src/components/AppHeader';
import { ProfileCompletionBanner } from '../src/components/ProfileCompletionBanner';
import { ApiError, api, uploadOrganizationLogo } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { clearProfilePromptDismiss } from '../src/lib/profile-prompt';
import { colors } from '../src/lib/theme';

export default function OrganizationProfileScreen() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const [orgId, setOrgId] = useState('');
  const [profile, setProfile] = useState<OrganizationIdentityProfile | null>(null);
  const [name, setName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [organizationType, setOrganizationType] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [website, setWebsite] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      router.replace('/login');
      return;
    }
    void (async () => {
      const me = await api<MeProfileResponse>('/api/me/profile');
      const id =
        me.role === 'admin'
          ? me.organizationId || session.user.organizationId || ''
          : session.user.organizationId || '';
      if (!id) {
        Alert.alert('No organisation', 'This account is not assigned to an organisation.');
        return;
      }
      setOrgId(id);
      const org = await api<OrganizationIdentityProfile>(`/api/organizations/${id}/profile`);
      setProfile(org);
      setName(org.name || '');
      setContactEmail(org.contactEmail || '');
      setOrganizationType(org.organizationType || '');
      setContactPhone(org.contactPhone || '');
      setAddressLine1(org.addressLine1 || '');
      setAddressLine2(org.addressLine2 || '');
      setCity(org.city || '');
      setState(org.state || '');
      setCountry(org.country || '');
      setWebsite(org.website || '');
      setLicenseNumber(org.licenseNumber || '');
    })().catch((err) => {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not load organisation');
    });
  }, [loading, session, router]);

  async function save() {
    if (!orgId) return;
    setBusy(true);
    try {
      const updated = await api<OrganizationIdentityProfile>(`/api/organizations/${orgId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          contactEmail: contactEmail.trim() || null,
          organizationType: organizationType || null,
          contactPhone: contactPhone.trim() || null,
          addressLine1: addressLine1.trim() || null,
          addressLine2: addressLine2.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          country: country || null,
          website: website.trim() || null,
          licenseNumber: licenseNumber.trim() || null,
        }),
      });
      setProfile(updated);
      Alert.alert('Saved', 'Organisation profile updated.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    if (!orgId) return;
    setBusy(true);
    try {
      const updated = await api<OrganizationIdentityProfile>(`/api/organizations/${orgId}/profile/complete`, {
        method: 'POST',
      });
      setProfile(updated);
      if (session?.user.id) await clearProfilePromptDismiss(session.user.id);
      Alert.alert('Completed', 'Organisation profile marked complete.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not complete');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F7FC' }}>
      <AppHeader />
      <ProfileCompletionBanner />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Organisation profile</Text>
        <Text style={{ color: '#6B7280' }}>Code {profile?.code || '—'}</Text>
        <Text style={{ color: '#6B7280', marginBottom: 8 }}>
          {profile?.completion.profileComplete
            ? 'Complete'
            : `Missing: ${profile?.completion.missingFields.join(', ') || '…'}`}
        </Text>
        {(
          [
            ['Name', name, setName],
            ['Contact email', contactEmail, setContactEmail],
            [
              `Type (${ORGANIZATION_TYPE_OPTIONS.map((o) => o.value).join('/')})`,
              organizationType,
              setOrganizationType,
            ],
            ['Contact phone', contactPhone, setContactPhone],
            ['Address line 1', addressLine1, setAddressLine1],
            ['Address line 2', addressLine2, setAddressLine2],
            ['City', city, setCity],
            ['State', state, setState],
            ['Country ISO-2', country, setCountry],
            ['Website', website, setWebsite],
            ['Licence number', licenseNumber, setLicenseNumber],
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
        <Pressable
          onPress={() =>
            void (async () => {
              if (!orgId) return;
              const picked = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                quality: 0.85,
              });
              if (picked.canceled || !picked.assets[0]) return;
              try {
                await uploadOrganizationLogo(orgId, picked.assets[0].uri, picked.assets[0].mimeType || undefined);
                Alert.alert('Logo updated');
              } catch (err) {
                Alert.alert('Error', err instanceof ApiError ? err.message : 'Upload failed');
              }
            })()
          }
          style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 14 }}
        >
          <Text style={{ fontWeight: '700', textAlign: 'center' }}>Upload logo</Text>
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
