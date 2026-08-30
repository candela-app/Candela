import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GAME_CATALOG, MODULE_LEVELS, canonicalizeDirectionSenseLevels, type IncomingDocIdRequest, type PatientSummary, type TherapyModuleId } from '@candela/shared/rn';
import { CheckIcon } from '../src/components/icons';
import { AppHeader } from '../src/components/AppHeader';
import { ScreenLoader } from '../src/components/ScreenLoader';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '../src/components/FloatingLabelInput';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [incoming, setIncoming] = useState<IncomingDocIdRequest[]>([]);
  const [incomingBusy, setIncomingBusy] = useState<string | null>(null);
  const inFlightRef = useRef(new Set<string>());

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q),
    );
  }, [patients, searchQuery]);

  const selected = useMemo(() => patients.find((p) => p.id === selectedId) ?? null, [patients, selectedId]);

  const load = useCallback(async () => {
    try {
      const [next, nextIncoming] = await Promise.all([
        api<PatientSummary[]>('/api/doctors/me/patients'),
        api<IncomingDocIdRequest[]>('/api/docid/incoming'),
      ]);
      setPatients(next);
      setIncoming(nextIncoming);
      setSelectedId((current) => (current && next.some((p) => p.id === current) ? current : next[0]?.id ?? null));
    } finally {
      setDataLoading(false);
    }
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
    const patientName = name.trim();
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
      Alert.alert('Success', `Patient ${patientName} created successfully!`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create patient';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  async function settleIncoming(id: string, accept: boolean) {
    setIncomingBusy(id);
    try {
      await api(`/api/docid/requests/${id}/${accept ? 'accept' : 'reject'}`, { method: 'POST' });
      await load();
      Alert.alert('Done', accept ? 'Patient attached to your DocID.' : 'Attach request rejected.');
    } catch (err) {
      Alert.alert('Error', err instanceof ApiError ? err.message : 'Could not update request');
    } finally {
      setIncomingBusy(null);
    }
  }

  async function toggleModule(moduleId: TherapyModuleId, enabled: boolean) {
    if (!selected) return;
    const patientId = selected.id;
    const patientName = selected.name;
    const key = `mod:${patientId}:${moduleId}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    const previousIds = selected.prescribedModuleIds;
    const previousLevels = { ...selected.prescribedLevels };
    setError('');
    const defaultLevels = enabled ? MODULE_LEVELS[moduleId]?.map((l) => l.id) || [] : [];

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
        await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions/${moduleId}`, { method: 'DELETE' });
      }
      Alert.alert('Updated', enabled ? `Prescribed module for ${patientName}` : `Removed module for ${patientName}`);
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedModuleIds: previousIds, prescribedLevels: previousLevels } : p)),
      );
      const msg = err instanceof ApiError ? err.message : 'Could not update prescription';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setTimeout(() => {
        inFlightRef.current.delete(key);
      }, 400);
    }
  }

  async function toggleLevel(moduleId: TherapyModuleId, levelId: string, enabled: boolean) {
    if (!selected) return;
    const patientId = selected.id;
    const patientName = selected.name;
    const key = `lvl:${patientId}:${moduleId}:${levelId}`;
    if (inFlightRef.current.has(key)) return;
    inFlightRef.current.add(key);
    const currentLevels =
      moduleId === 'direction_sense'
        ? canonicalizeDirectionSenseLevels(selected.prescribedLevels?.[moduleId] || [])
        : selected.prescribedLevels?.[moduleId] || [];
    const newLevels = enabled ? Array.from(new Set([...currentLevels, levelId])) : currentLevels.filter((id) => id !== levelId);
    const previousLevels = { ...selected.prescribedLevels };
    setError('');

    setPatients((prev) =>
      prev.map((p) => {
        if (p.id !== patientId) return p;
        return { ...p, prescribedLevels: { ...p.prescribedLevels, [moduleId]: newLevels } };
      }),
    );

    try {
      await api<PatientSummary>(`/api/doctors/me/patients/${patientId}/prescriptions`, {
        method: 'POST',
        body: JSON.stringify({ moduleId, levels: newLevels }),
      });
      Alert.alert('Updated', `Updated levels for ${patientName}`);
    } catch (err) {
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, prescribedLevels: previousLevels } : p)));
      const msg = err instanceof ApiError ? err.message : 'Could not update level';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setTimeout(() => {
        inFlightRef.current.delete(key);
      }, 400);
    }
  }

  if (loading || dataLoading || !session || session.user.role !== 'doctor') {
    return <ScreenLoader />;
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
          Patients you create are automatically linked to your DocID. Prescribe modules and levels by adding or removing them.
        </Text>
        {error ? <Text style={{ color: colors.red, marginBottom: s(12) }}>{error}</Text> : null}

        {incoming.length > 0 ? (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: s(20),
              padding: s(16),
              borderWidth: 1,
              borderColor: '#BFDBFE',
              marginBottom: s(16),
            }}
          >
            <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(4) }}>Incoming attach requests</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(12) }}>
              Patients asked to join or switch to your DocID. Confirm or reject here if the email is delayed.
            </Text>
            {incoming.map((request) => (
              <View
                key={request.id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: s(14),
                  padding: s(12),
                  marginBottom: s(8),
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: fs(14) }}>{request.patientName}</Text>
                <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(2) }}>
                  {request.patientEmail}
                  {request.source === 'change' ? ' · reassignment' : ' · new attach'}
                </Text>
                <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(10) }}>
                  <Pressable
                    onPress={() => void settleIncoming(request.id, true)}
                    disabled={incomingBusy === request.id}
                    style={{
                      flex: 1,
                      backgroundColor: colors.blue,
                      borderRadius: s(10),
                      paddingVertical: s(10),
                      alignItems: 'center',
                      opacity: incomingBusy === request.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(13) }}>Confirm</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void settleIncoming(request.id, false)}
                    disabled={incomingBusy === request.id}
                    style={{
                      flex: 1,
                      backgroundColor: '#F3F4F6',
                      borderRadius: s(10),
                      paddingVertical: s(10),
                      alignItems: 'center',
                      opacity: incomingBusy === request.id ? 0.6 : 1,
                    }}
                  >
                    <Text style={{ color: '#374151', fontWeight: '600', fontSize: fs(13) }}>Reject</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border, marginBottom: s(16) }}>
          <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(12) }}>Create patient</Text>
          <FloatingLabelInput label="Name" value={name} onChangeText={setName} />
          <FloatingLabelInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FloatingLabelInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <FloatingLabelPasswordInput label="Password (min 8)" value={password} onChangeText={setPassword} />
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: s(10) }}>
              <Text style={{ fontSize: fs(17), fontWeight: '700' }}>Patients</Text>
              <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.muted, backgroundColor: '#F3F4F6', paddingHorizontal: s(8), paddingVertical: s(2), borderRadius: 999 }}>
                {patients.length}
              </Text>
            </View>
            <FloatingLabelInput
              label="Search patient name, email..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{ marginBottom: s(12) }}
            />
            {patients.length === 0 ? <Text style={{ color: colors.muted }}>No patients yet.</Text> : null}
            {patients.length > 0 && filteredPatients.length === 0 ? (
              <Text style={{ color: colors.muted, textAlign: 'center', paddingVertical: s(16) }}>No match for "{searchQuery}"</Text>
            ) : null}
            {filteredPatients.map((patient) => (
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
                <Text style={{ fontSize: fs(12), color: selectedId === patient.id ? '#DBEAFE' : colors.muted }}>
                  {patient.email} · {patient.phone}
                </Text>
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
                  const selectedLevels =
                    mod.id === 'direction_sense'
                      ? canonicalizeDirectionSenseLevels(selected.prescribedLevels?.[mod.id] || [])
                      : selected.prescribedLevels?.[mod.id] || [];
                  return (
                    <View key={mod.id} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: s(14), padding: s(12), marginBottom: s(8) }}>
                      <Pressable onPress={() => void toggleModule(mod.id, !on)} style={{ flexDirection: 'row', gap: s(10) }}>
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
                                <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151', flex: 1 }}>{level.name}</Text>
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
