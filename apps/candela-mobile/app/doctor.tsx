import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { GAME_CATALOG, GAME_FAMILIES, MODULE_LEVELS, canonicalizeDirectionSenseLevels, type IncomingDocIdRequest, type PatientSummary, type TherapyModuleId } from '@candela/shared/rn';
import { AnalyticsIcon, CheckIcon, ChevronUpIcon, SearchIcon, XIcon } from '../src/components/icons';
import { AppHeader } from '../src/components/AppHeader';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '../src/components/FloatingLabelInput';
import { ApiError, api } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

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

function SummaryCard({
  label,
  value,
  hint,
  labelColor,
  isTablet,
  fs,
  s,
}: {
  label: string;
  value: string;
  hint?: string;
  labelColor: string;
  isTablet: boolean;
  fs: (n: number) => number;
  s: (n: number) => number;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: isTablet ? '22%' : '47%',
        backgroundColor: colors.white,
        borderRadius: s(16),
        padding: s(14),
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <Text style={{ fontSize: fs(11), fontWeight: '700', color: labelColor, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: fs(22), fontWeight: '800', color: colors.text, marginTop: s(4) }}>{value}</Text>
      {hint ? <Text style={{ fontSize: fs(11), color: colors.muted, marginTop: s(4) }}>{hint}</Text> : null}
    </View>
  );
}

function EmptyChartCard({
  title,
  hint,
  fs,
  s,
}: {
  title: string;
  hint: string;
  fs: (n: number) => number;
  s: (n: number) => number;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: s(16),
        padding: s(16),
        borderWidth: 1,
        borderColor: colors.border,
        marginBottom: s(12),
      }}
    >
      <Text style={{ fontSize: fs(14), fontWeight: '700', color: colors.text }}>{title}</Text>
      <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(2) }}>{hint}</Text>
      <View
        style={{
          marginTop: s(16),
          height: s(160),
          borderRadius: s(12),
          backgroundColor: '#F9FAFB',
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <Text style={{ fontSize: fs(12), fontWeight: '600', color: '#9CA3AF' }}>No sessions yet</Text>
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
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [phoneTab, setPhoneTab] = useState<'create' | 'patients'>('patients');
  const [searchOpen, setSearchOpen] = useState(false);
  const inFlightRef = useRef(new Set<string>());

  const filteredPatients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q),
    );
  }, [patients, searchQuery]);

  const selected = useMemo(() => patients.find((p) => p.id === selectedId) ?? null, [patients, selectedId]);
  const prescribedCount = selected?.prescribedModuleIds.length ?? 0;
  const assignedLevelCount = useMemo(() => {
    if (!selected) return 0;
    return Object.values(selected.prescribedLevels || {}).reduce((sum, levels) => sum + levels.length, 0);
  }, [selected]);

  useEffect(() => {
    setOpenFamilyId(null);
    setShowAnalytics(false);
  }, [selectedId]);

  const load = useCallback(async () => {
    try {
      const [next, nextIncoming] = await Promise.all([
        api<PatientSummary[]>('/api/doctors/me/patients'),
        api<IncomingDocIdRequest[]>('/api/docid/incoming'),
      ]);
      setPatients(next);
      setIncoming(nextIncoming);
      setSelectedId((current) => (current && next.some((p) => p.id === current) ? current : null));
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
      setSelectedId(created.id);
      setPhoneTab('patients');
      await load();
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
    return (
      <View style={{ flex: 1, backgroundColor: colors.page, justifyContent: 'center' }}>
        <Text style={{ textAlign: 'center', color: colors.muted }}>Loading…</Text>
      </View>
    );
  }

  const referralExtra = session.doctor ? (
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
  ) : null;

  if (showAnalytics && selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={() => setShowAnalytics(false)} extra={referralExtra} />
        <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
          <Text style={{ fontSize: fs(28), fontWeight: '800' }}>{selected.name}</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4), marginBottom: s(20) }}>
            {selected.email} · {selected.phone}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginBottom: s(16) }}>
            <View
              style={{
                width: s(40),
                height: s(40),
                borderRadius: s(12),
                backgroundColor: '#EFF6FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AnalyticsIcon size={s(22)} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(20), fontWeight: '800' }}>Session Analytics</Text>
              <Text style={{ fontSize: fs(13), color: colors.muted }}>
                Performance for {selected.name} across therapy modules
              </Text>
            </View>
          </View>
          <EmptyChartCard
            title="Accuracy over time"
            hint="Session accuracy will plot here after play is saved"
            fs={fs}
            s={s}
          />
          <EmptyChartCard
            title="Sessions by family"
            hint="Counts per family will appear here after play is saved"
            fs={fs}
            s={s}
          />
        </ScrollView>
      </View>
    );
  }

  const phoneProfile = !isTablet && Boolean(selected);

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader
        extra={referralExtra}
        onBack={phoneProfile ? () => setSelectedId(null) : undefined}
      />
      <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        {!phoneProfile ? (
          <>
            <Text style={{ fontSize: fs(28), fontWeight: '800' }}>Doctor dashboard</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4), marginBottom: s(16) }}>
              Patients you create are automatically linked to your DocID. Prescribe modules and levels by adding or removing them.
            </Text>
          </>
        ) : null}
        {error ? <Text style={{ color: colors.red, marginBottom: s(12) }}>{error}</Text> : null}

        {!phoneProfile && incoming.length > 0 ? (
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

        {!isTablet && !phoneProfile ? (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#E5E7EB',
              borderRadius: s(14),
              padding: s(4),
              marginBottom: s(16),
            }}
          >
            <Pressable
              onPress={() => setPhoneTab('create')}
              accessibilityRole="tab"
              accessibilityState={{ selected: phoneTab === 'create' }}
              style={{
                flex: 1,
                paddingVertical: s(10),
                borderRadius: s(11),
                backgroundColor: phoneTab === 'create' ? colors.white : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: fs(13), color: phoneTab === 'create' ? colors.blue : colors.muted }}>
                Create patient
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setPhoneTab('patients')}
              accessibilityRole="tab"
              accessibilityState={{ selected: phoneTab === 'patients' }}
              style={{
                flex: 1,
                paddingVertical: s(10),
                borderRadius: s(11),
                backgroundColor: phoneTab === 'patients' ? colors.white : 'transparent',
                alignItems: 'center',
                flexDirection: 'row',
                justifyContent: 'center',
                gap: s(6),
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: fs(13), color: phoneTab === 'patients' ? colors.blue : colors.muted }}>
                Patients
              </Text>
              <Text
                style={{
                  fontSize: fs(11),
                  fontWeight: '700',
                  color: phoneTab === 'patients' ? colors.blue : colors.muted,
                  backgroundColor: phoneTab === 'patients' ? '#EFF6FF' : '#F3F4F6',
                  paddingHorizontal: s(7),
                  paddingVertical: s(1),
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                {patients.length}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {isTablet || (phoneTab === 'create' && !phoneProfile) ? (
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
        ) : null}

        {isTablet || phoneTab === 'patients' || phoneProfile ? (
        <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: s(12) }}>
          {isTablet || !selected ? (
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: s(10) }}>
              <Text style={{ fontSize: fs(17), fontWeight: '700' }}>Patients</Text>
              <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.muted, backgroundColor: '#F3F4F6', paddingHorizontal: s(8), paddingVertical: s(2), borderRadius: 999, marginLeft: s(8) }}>
                {patients.length}
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable
                onPress={() => {
                  if (searchOpen) {
                    setSearchOpen(false);
                    setSearchQuery('');
                  } else {
                    setSearchOpen(true);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={searchOpen ? 'Close search' : 'Search patients'}
                hitSlop={s(8)}
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(12),
                  backgroundColor: searchOpen ? '#EFF6FF' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {searchOpen ? <XIcon size={s(16)} color={colors.blue} /> : <SearchIcon size={s(18)} color={colors.muted} />}
              </Pressable>
            </View>
            {searchOpen ? (
              <FloatingLabelInput
                label="Search patient name, email..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                style={{ marginBottom: s(12) }}
                endAdornment={
                  searchQuery ? (
                    <Pressable onPress={() => setSearchQuery('')} accessibilityLabel="Clear search" hitSlop={8}>
                      <XIcon size={s(14)} color="#9CA3AF" />
                    </Pressable>
                  ) : (
                    <SearchIcon size={s(16)} color="#9CA3AF" />
                  )
                }
              />
            ) : null}
            {patients.length === 0 ? (
              <View style={{ paddingVertical: s(8) }}>
                <Text style={{ color: colors.muted }}>No patients yet.</Text>
                {!isTablet ? (
                  <Pressable
                    onPress={() => setPhoneTab('create')}
                    style={{ marginTop: s(12), backgroundColor: colors.blue, borderRadius: s(12), padding: s(12), alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(13) }}>Create a patient</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {patients.length > 0 && filteredPatients.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: s(16) }}>
                <SearchIcon size={s(28)} color="#D1D5DB" />
                <Text style={{ color: colors.muted, textAlign: 'center', marginTop: s(8), fontSize: fs(12), fontWeight: '600' }}>No patients found</Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: s(2) }}>No match for "{searchQuery}"</Text>
              </View>
            ) : null}
            {filteredPatients.map((patient) => (
              <Pressable
                key={patient.id}
                onPress={() => {
                  setSelectedId(patient.id);
                  setSearchOpen(false);
                }}
                style={{
                  borderRadius: s(12),
                  padding: s(12),
                  marginBottom: s(8),
                  backgroundColor: isTablet && selectedId === patient.id ? colors.blue : '#F9FAFB',
                }}
              >
                <Text style={{ fontWeight: '700', color: isTablet && selectedId === patient.id ? colors.white : colors.text }}>{patient.name}</Text>
                <Text style={{ fontSize: fs(12), color: isTablet && selectedId === patient.id ? '#DBEAFE' : colors.muted }}>
                  {patient.email} · {patient.phone}
                </Text>
              </Pressable>
            ))}
          </View>
          ) : null}

          {selected ? (
          <View style={{ flex: 2, backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: s(8), marginBottom: s(12) }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: fs(17), fontWeight: '700' }}>{selected.name}</Text>
                    <Text style={{ color: colors.muted, marginTop: s(2), fontSize: fs(13) }}>
                      {selected.email} · {selected.phone}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setShowAnalytics(true)}
                    accessibilityRole="button"
                    accessibilityLabel="View Session Analytics"
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: s(6),
                      backgroundColor: colors.white,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: s(12),
                      paddingHorizontal: s(12),
                      paddingVertical: s(8),
                    }}
                  >
                    <AnalyticsIcon size={s(18)} color={colors.blue} />
                    <Text style={{ fontWeight: '600', fontSize: fs(13) }}>Analytics</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginBottom: s(16) }}>
                  <SummaryCard
                    label="Sessions"
                    value="0"
                    hint="No sessions yet"
                    labelColor="#2563EB"
                    isTablet={isTablet}
                    fs={fs}
                    s={s}
                  />
                  <SummaryCard
                    label="Last played"
                    value="—"
                    hint="Not stored yet"
                    labelColor="#D97706"
                    isTablet={isTablet}
                    fs={fs}
                    s={s}
                  />
                  <SummaryCard
                    label="Accuracy"
                    value="—"
                    hint="Not stored yet"
                    labelColor="#059669"
                    isTablet={isTablet}
                    fs={fs}
                    s={s}
                  />
                  <SummaryCard
                    label="Prescribed"
                    value={String(prescribedCount)}
                    hint={
                      prescribedCount === 1
                        ? '1 activity'
                        : `${prescribedCount} activities${assignedLevelCount ? ` · ${assignedLevelCount} levels` : ''}`
                    }
                    labelColor="#7C3AED"
                    isTablet={isTablet}
                    fs={fs}
                    s={s}
                  />
                </View>
                <Text style={{ fontWeight: '600', marginBottom: s(10) }}>Prescribed modules & levels</Text>
                {GAME_FAMILIES.map((family) => {
                  const familyOpen = openFamilyId === family.id;
                  const prescribedInFamily = family.moduleIds.filter((id) =>
                    selected.prescribedModuleIds.includes(id),
                  ).length;
                  return (
                    <View
                      key={family.id}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: s(14),
                        marginBottom: s(10),
                        overflow: 'hidden',
                      }}
                    >
                      <Pressable
                        onPress={() => setOpenFamilyId((current) => (current === family.id ? null : family.id))}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: s(10),
                          padding: s(12),
                          backgroundColor: '#F9FAFB',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', fontSize: fs(15) }}>{family.title}</Text>
                          <Text style={{ fontSize: fs(12), color: colors.muted, marginTop: s(2) }}>{family.body}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                          <Text
                            style={{
                              fontSize: fs(10),
                              fontWeight: '700',
                              color: family.accent,
                              backgroundColor: `${family.accent}14`,
                              paddingHorizontal: s(8),
                              paddingVertical: s(3),
                              borderRadius: 999,
                              overflow: 'hidden',
                            }}
                          >
                            {prescribedInFamily}/{family.moduleIds.length}
                          </Text>
                          <View style={{ transform: [{ rotate: familyOpen ? '0deg' : '180deg' }] }}>
                            <ChevronUpIcon size={s(14)} color="#9CA3AF" />
                          </View>
                        </View>
                      </Pressable>
                      {familyOpen ? (
                        <>
                          {family.moduleIds.map((moduleId) => {
                            const mod = GAME_CATALOG[moduleId];
                            const on = selected.prescribedModuleIds.includes(mod.id);
                            const levels = MODULE_LEVELS[mod.id] || [];
                            const selectedLevels =
                              mod.id === 'direction_sense'
                                ? canonicalizeDirectionSenseLevels(selected.prescribedLevels?.[mod.id] || [])
                                : selected.prescribedLevels?.[mod.id] || [];
                            return (
                              <View
                                key={mod.id}
                                style={{
                                  borderTopWidth: 1,
                                  borderTopColor: colors.border,
                                  padding: s(12),
                                }}
                              >
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
                  );
                })}
          </View>
          ) : isTablet ? (
            <View style={{ flex: 2, backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.muted }}>Select a patient to prescribe modules.</Text>
            </View>
          ) : null}
        </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
