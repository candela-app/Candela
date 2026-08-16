import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DoctorSummary, PatientSummary } from '@candela/shared/rn';
import { AppHeader } from '../src/components/AppHeader';
import { ApiError, api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

export default function AdminScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { fs, s, pad } = useLayout();
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [nextDoctors, nextPatients] = await Promise.all([
      api<DoctorSummary[]>('/api/admin/doctors'),
      api<PatientSummary[]>('/api/admin/patients'),
    ]);
    setDoctors(nextDoctors);
    setPatients(nextPatients);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'admin') {
      router.replace('/login');
      return;
    }
    load().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [loading, session, router, load]);

  const grouped = useMemo(() => {
    const byDoctor = new Map<string, { doctorName: string; code: string; patients: PatientSummary[] }>();
    const unlinked: PatientSummary[] = [];
    for (const patient of patients) {
      if (!patient.doctorId) {
        unlinked.push(patient);
        continue;
      }
      const existing = byDoctor.get(patient.doctorId);
      if (existing) {
        existing.patients.push(patient);
      } else {
        byDoctor.set(patient.doctorId, {
          doctorName: patient.doctorName || 'Doctor',
          code: patient.referralCode || '—',
          patients: [patient],
        });
      }
    }
    return { byDoctor, unlinked };
  }, [patients]);

  async function onCreateDoctor() {
    setError('');
    setSaving(true);
    try {
      await api('/api/admin/doctors', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create doctor');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: s(12),
    paddingHorizontal: s(14),
    paddingVertical: s(12),
    fontSize: fs(14),
    marginBottom: s(10),
    backgroundColor: colors.white,
    color: colors.text,
  };

  if (loading || !session || session.user.role !== 'admin') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, justifyContent: 'center' }}>
        <Text style={{ textAlign: 'center', color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        <Text style={{ fontSize: fs(28), fontWeight: '800', color: colors.text }}>Admin</Text>
        <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4), marginBottom: s(20) }}>
          Create doctors and review every patient on the platform.
        </Text>
        {error ? <Text style={{ color: colors.red, marginBottom: s(12) }}>{error}</Text> : null}

        <View style={{ backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border, marginBottom: s(20) }}>
          <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(12) }}>Create doctor</Text>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={inputStyle} />
          <TextInput placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={inputStyle} />
          <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={inputStyle} />
          <TextInput placeholder="Password (min 8)" value={password} onChangeText={setPassword} secureTextEntry style={inputStyle} />
          <Pressable
            onPress={() => void onCreateDoctor()}
            disabled={saving}
            style={{ backgroundColor: colors.blue, borderRadius: s(12), padding: s(14), alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create doctor'}</Text>
          </Pressable>
        </View>

        <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(12) }}>Doctors</Text>
        {doctors.length === 0 ? <Text style={{ color: colors.muted, marginBottom: s(16) }}>No doctors yet.</Text> : null}
        {doctors.map((doctor) => (
          <View
            key={doctor.id}
            style={{ backgroundColor: colors.white, borderRadius: s(16), padding: s(16), marginBottom: s(10), borderWidth: 1, borderColor: colors.border }}
          >
            <Text style={{ fontWeight: '700', fontSize: fs(15) }}>{doctor.name}</Text>
            <Text style={{ color: colors.muted, fontSize: fs(13) }}>
              {doctor.email} · {doctor.phone}
            </Text>
            <Text
              style={{
                marginTop: s(8),
                alignSelf: 'flex-start',
                fontFamily: 'monospace',
                fontWeight: '800',
                letterSpacing: 2,
                color: '#1D4ED8',
                backgroundColor: '#EFF6FF',
                paddingHorizontal: s(12),
                paddingVertical: s(6),
                borderRadius: s(10),
                overflow: 'hidden',
              }}
            >
              {doctor.referralCode}
            </Text>
          </View>
        ))}

        <Text style={{ fontSize: fs(17), fontWeight: '700', marginTop: s(16), marginBottom: s(12) }}>Patients managed by doctors</Text>
        {[...grouped.byDoctor.entries()].map(([id, group]) => (
          <View key={id} style={{ backgroundColor: colors.white, borderRadius: s(16), padding: s(16), marginBottom: s(10), borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontWeight: '700' }}>
              {group.doctorName} <Text style={{ color: '#1D4ED8', fontFamily: 'monospace' }}>({group.code})</Text>
            </Text>
            {group.patients.map((patient) => (
              <Text key={patient.id} style={{ marginTop: s(6), color: '#374151', fontSize: fs(13) }}>
                {patient.name} · {patient.email} · {patient.phone}
              </Text>
            ))}
          </View>
        ))}
        {grouped.byDoctor.size === 0 ? <Text style={{ color: colors.muted }}>No doctor-managed patients yet.</Text> : null}

        <Text style={{ fontSize: fs(17), fontWeight: '700', marginTop: s(16), marginBottom: s(12) }}>Self-signup patients</Text>
        <View style={{ backgroundColor: colors.white, borderRadius: s(16), padding: s(16), borderWidth: 1, borderColor: colors.border }}>
          {grouped.unlinked.length === 0 ? <Text style={{ color: colors.muted }}>None yet.</Text> : null}
          {grouped.unlinked.map((patient) => (
            <Text key={patient.id} style={{ color: '#374151', fontSize: fs(13), marginBottom: s(6) }}>
              {patient.name} · {patient.email} · {patient.phone}
            </Text>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
