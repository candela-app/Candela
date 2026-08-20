import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GAME_CATALOG, MODULE_LEVELS, type PatientSummary, type TherapyModuleId } from '@candela/shared/rn';
import { CheckIcon } from '../src/components/icons';
import { AppHeader } from '../src/components/AppHeader';
import { ApiError, api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

const MODULES = Object.values(GAME_CATALOG);

function PrescriptionTick({ checked, size }: { checked: boolean; size: number }) {
  return (
    <View
      pointerEvents="none"
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: checked ? colors.blue : '#9CA3AF',
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={{ opacity: checked ? 1 : 0 }}>
        <CheckIcon size={Math.round(size * 0.72)} color={colors.blue} />
      </View>
    </View>
  );
}

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
  const inFlightRef = useRef(new Set<string>());
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
    const key = `mod:${patientId}:${moduleId}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    const previousIds = selected.prescribedModuleIds;
    const previousLevels = { ...selected.prescribedLevels };
    const defaultLevels = enabled ? MODULE_LEVELS[moduleId]?.map((level) => level.id) || [] : [];
    setError('');
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        const prescribedModuleIds = enabled
          ? Array.from(new Set([...p.prescribedModuleIds, moduleId]))
          : p.prescribedModuleIds.filter((id) => id !== moduleId);
        const prescribedLevels = { ...p.prescribedLevels };
        if (enabled) prescribedLevels[moduleId] = defaultLevels;
        else delete prescribedLevels[moduleId];
        return { ...p, prescribedModuleIds, prescribedLevels };
      }),
    );
    try {
      if (enabled) {
        await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions`, {
          method: 'POST',
          body: JSON.stringify({ moduleId, levels: defaultLevels }),
        });
      } else {
        await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions/${moduleId}`, {
          method: 'DELETE',
        });
      }
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) =>
          p.id === patientId ? { ...p, prescribedModuleIds: previousIds, prescribedLevels: previousLevels } : p,
        ),
      );
      setError(err instanceof ApiError ? err.message : 'Could not update prescription');
    } finally {
      setTimeout(() => {
        inFlightRef.current.delete(key);
      }, 400);
    }
  }

  async function toggleLevel(moduleId: TherapyModuleId, levelId: string, enabled: boolean) {
    if (!selected) return;
    const patientId = selected.id;
    const key = `lvl:${patientId}:${moduleId}:${levelId}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    const currentLevels = selected.prescribedLevels?.[moduleId] || [];
    const newLevels = enabled
      ? Array.from(new Set([...currentLevels, levelId]))
      : currentLevels.filter((id) => id !== levelId);
    const previousLevels = { ...selected.prescribedLevels };
    setError('');
    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return {
          ...p,
          prescribedLevels: {
            ...p.prescribedLevels,
            [moduleId]: newLevels,
          },
        };
      }),
    );
    try {
      await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify({ moduleId, levels: newLevels }),
      });
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedLevels: previousLevels } : p)),
      );
      setError(err instanceof ApiError ? err.message : 'Could not update level');
    } finally {
      setTimeout(() => {
        inFlightRef.current.delete(key);
      }, 400);
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
      <AppHeader />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: s(8), marginBottom: s(4) }}>
          <Text style={{ fontSize: fs(28), fontWeight: '800' }}>Doctor dashboard</Text>
          {session.doctor ? (
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
          ) : null}
        </View>
        <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(16) }}>
          Patients you create are already linked to your referral code. Prescribe modules and levels by adding or removing them.
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
                <Text style={{ fontWeight: '600', marginBottom: s(10) }}>Prescribed modules & levels</Text>
                {MODULES.map((mod) => {
                  const on = selected.prescribedModuleIds.includes(mod.id);
                  const levels = MODULE_LEVELS[mod.id] || [];
                  const selectedLevels = selected.prescribedLevels?.[mod.id] || [];
                  return (
                    <View
                      key={mod.id}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: s(14),
                        padding: s(12),
                        marginBottom: s(8),
                      }}
                    >
                      <Pressable
                        onPress={() => void toggleModule(mod.id, !on)}
                        style={{ flexDirection: 'row', gap: s(10) }}
                      >
                        <View style={{ marginTop: 2 }}>
                          <PrescriptionTick checked={on} size={s(20)} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700' }}>{mod.name}</Text>
                          <Text style={{ fontSize: fs(12), color: colors.muted }}>{mod.description}</Text>
                        </View>
                      </Pressable>
                      {on && levels.length > 0 ? (
                        <View style={{ marginTop: s(10), marginLeft: s(30), gap: s(6) }}>
                          {levels.map((level) => {
                            const levelOn = selectedLevels.includes(level.id);
                            return (
                              <Pressable
                                key={level.id}
                                onPress={() => void toggleLevel(mod.id, level.id, !levelOn)}
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: s(8),
                                  backgroundColor: '#F9FAFB',
                                  borderWidth: 1,
                                  borderColor: colors.border,
                                  borderRadius: s(10),
                                  paddingHorizontal: s(10),
                                  paddingVertical: s(8),
                                }}
                              >
                                <PrescriptionTick checked={levelOn} size={s(16)} />
                                <Text style={{ flex: 1, fontSize: fs(13), fontWeight: '600', color: '#374151' }}>
                                  {level.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      ) : null}
                    </View>
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
