import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GAME_CATALOG, type PatientSummary, type TherapyModuleId } from '@candela/shared/rn';
import { AppHeader } from '../src/components/AppHeader';
import { ApiError, api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

const MODULES = Object.values(GAME_CATALOG);

export default function DoctorScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { fs, s, pad, isTablet } = useLayout();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = patients.find((p) => p.id === selectedId) ?? null;

  const load = useCallback(async () => {
    const next = await api<PatientSummary[]>('/api/doctors/me/patients');
    setPatients(next);
    setSelectedId((current) => (current && next.some((p) => p.id === current) ? current : next[0]?.id ?? null));
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'doctor') {
      router.replace('/login');
      return;
    }
    load().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [loading, session, router, load]);

  async function onCreatePatient() {
    setError('');
    setSaving(true);
    try {
      const created = await api<PatientSummary>('/api/doctors/me/patients', {
        method: 'POST',
        body: JSON.stringify({ name, phone, email, password }),
      });
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      await load();
      setSelectedId(created.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create patient');
    } finally {
      setSaving(false);
    }
  }

  async function toggleModule(moduleId: TherapyModuleId, enabled: boolean) {
    if (!selected) return;
    const patientId = selected.id;
    const previous = selected.prescribedModuleIds;
    setError('');
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const prescribedModuleIds = enabled
          ? Array.from(new Set([...p.prescribedModuleIds, moduleId]))
          : p.prescribedModuleIds.filter((id) => id !== moduleId);
        return { ...p, prescribedModuleIds };
      }),
    );
    try {
      const updated = enabled
        ? await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions`, {
            method: 'POST',
            body: JSON.stringify({ moduleId }),
          })
        : await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions/${moduleId}`, {
            method: 'DELETE',
          });
      setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, prescribedModuleIds: previous } : p)));
      setError(err instanceof ApiError ? err.message : 'Could not update prescription');
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

  if (loading || !session || session.user.role !== 'doctor') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, justifyContent: 'center' }}>
        <Text style={{ textAlign: 'center', color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader
        extra={
          session.doctor ? (
            <Text
              style={{
                fontFamily: 'monospace',
                fontSize: fs(12),
                fontWeight: '700',
                color: '#1D4ED8',
                backgroundColor: '#EFF6FF',
                paddingHorizontal: s(10),
                paddingVertical: s(4),
                borderRadius: s(8),
                overflow: 'hidden',
              }}
            >
              {session.doctor.referralCode}
            </Text>
          ) : null
        }
      />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        <Text style={{ fontSize: fs(28), fontWeight: '800' }}>Doctor dashboard</Text>
        <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4), marginBottom: s(16) }}>
          Patients you create are already linked to your referral code. Prescribe modules by adding or removing them.
        </Text>
        {error ? <Text style={{ color: colors.red, marginBottom: s(12) }}>{error}</Text> : null}

        <View style={{ backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border, marginBottom: s(16) }}>
          <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(12) }}>Create patient</Text>
          <TextInput placeholder="Name" value={name} onChangeText={setName} style={inputStyle} />
          <TextInput placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" style={inputStyle} />
          <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={inputStyle} />
          <TextInput placeholder="Password (min 8)" value={password} onChangeText={setPassword} secureTextEntry style={inputStyle} />
          <Pressable
            onPress={() => void onCreatePatient()}
            disabled={saving}
            style={{ backgroundColor: colors.blue, borderRadius: s(12), padding: s(14), alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create patient'}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: s(12) }}>
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(10) }}>Patients</Text>
            {patients.length === 0 ? <Text style={{ color: colors.muted }}>No patients yet.</Text> : null}
            {patients.map((patient) => (
              <Pressable
                key={patient.id}
                onPress={() => setSelectedId(patient.id)}
                style={{
                  borderRadius: s(12),
                  padding: s(12),
                  marginBottom: s(8),
                  backgroundColor: selectedId === patient.id ? colors.blue : '#F9FAFB',
                }}
              >
                <Text style={{ fontWeight: '700', color: selectedId === patient.id ? colors.white : colors.text }}>{patient.name}</Text>
                <Text style={{ fontSize: fs(12), color: selectedId === patient.id ? '#DBEAFE' : colors.muted }}>{patient.email}</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flex: 2, backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border }}>
            {!selected ? <Text style={{ color: colors.muted }}>Select a patient to prescribe modules.</Text> : null}
            {selected ? (
              <>
                <Text style={{ fontSize: fs(17), fontWeight: '700' }}>{selected.name}</Text>
                <Text style={{ color: colors.muted, marginBottom: s(16), fontSize: fs(13) }}>
                  {selected.email} · {selected.phone}
                </Text>
                <Text style={{ fontWeight: '600', marginBottom: s(10) }}>Prescribed modules</Text>
                {MODULES.map((mod) => {
                  const on = selected.prescribedModuleIds.includes(mod.id);
                  return (
                    <Pressable
                      key={mod.id}
                      onPress={() => void toggleModule(mod.id, !on)}
                      style={{
                        flexDirection: 'row',
                        gap: s(10),
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: s(14),
                        padding: s(12),
                        marginBottom: s(8),
                      }}
                    >
                      <View
                        style={{
                          width: s(20),
                          height: s(20),
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: on ? colors.blue : '#9CA3AF',
                          backgroundColor: on ? colors.blue : 'transparent',
                          marginTop: 2,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '700' }}>{mod.name}</Text>
                        <Text style={{ fontSize: fs(12), color: colors.muted }}>{mod.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
