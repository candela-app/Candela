import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GAME_CATALOG, GAME_FAMILIES, PEDIATRIC_GAME_FAMILIES, MODULE_LEVELS, canonicalizeDirectionSenseLevels, type IncomingDocIdRequest, type PatientSummary, type TherapyModuleId } from '@candela/shared/rn';
import { AnalyticsIcon, BellIcon, CheckIcon, ChevronUpIcon, LogOutIcon, MonitorIcon, SearchIcon, SideDockIcon, SlidersIcon, UserIcon, UsersIcon, XIcon } from '../src/components/icons';
import { AppHeader } from '../src/components/AppHeader';
import { CopyDocId } from '../src/components/CopyDocId';
import { AppToastHost, pushAppToast, type AppToastItem } from '../src/components/AppToast';
import { ScreenLoader } from '../src/components/ScreenLoader';
import { SessionAnalyticsPanel } from '../src/components/SessionAnalyticsPanel';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '../src/components/FloatingLabelInput';
import { ApiError, api, listPatientGameSessions, type StoredGameSessionRecord } from '../src/lib/api';
import { useAuth } from '../src/lib/auth-context';
import { useLayout } from '../src/lib/layout';
import { colors } from '../src/lib/theme';

const PHONE_SECTIONS = ['overview', 'patients', 'prescriptions', 'analytics', 'transfers', 'settings'] as const;
type PhoneSection = (typeof PHONE_SECTIONS)[number];

function prescriptionLabel(patient: PatientSummary) {
  const activities = patient.prescribedModuleIds.length;
  if (activities === 0) return 'None';
  const levels = Object.values(patient.prescribedLevels || {}).reduce((sum, ids) => sum + ids.length, 0);
  return levels > 0 ? `${activities} activities · ${levels} levels` : `${activities} activities`;
}

function patientInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const cardShadow = {
  shadowColor: '#0f172a',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.14,
  shadowRadius: 18,
  elevation: 4,
};

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
  fs,
  s,
}: {
  label: string;
  value: string;
  hint: string;
  fs: (n: number) => number;
  s: (n: number) => number;
}) {
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '47%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: s(13),
        backgroundColor: colors.white,
        borderRadius: s(13),
        padding: s(21),
        borderWidth: 1,
        borderColor: '#E5E7EB',
        ...cardShadow,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.text }}>{label}</Text>
        <Text style={{ marginTop: s(8), fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{hint}</Text>
      </View>
      <Text style={{ fontSize: fs(34), fontWeight: '600', color: colors.text }}>{value}</Text>
    </View>
  );
}

export default function DoctorScreen() {
  const router = useRouter();
  const { session, loading, logout } = useAuth();
  const { fs, s, pad, isTablet } = useLayout();
  const insets = useSafeAreaInsets();
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
  const [catalog, setCatalog] = useState<'normal' | 'pediatric'>('normal');
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [phoneTab, setPhoneTab] = useState<'create' | 'patients'>('patients');
  const [phoneSection, setPhoneSection] = useState<PhoneSection>('patients');
  const [navOpen, setNavOpen] = useState(false);
  const [analyticsOrigin, setAnalyticsOrigin] = useState<{ section: PhoneSection; patientId: string | null } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [toasts, setToasts] = useState<AppToastItem[]>([]);
  const [sessions, setSessions] = useState<StoredGameSessionRecord[]>([]);
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

  useEffect(() => {
    if (!selectedId) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    setSessions([]);
    listPatientGameSessions(selectedId)
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .catch(() => {
        if (!cancelled) setSessions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const lastPlayed = sessions.length
    ? new Date(
        [...sessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[sessions.length - 1].recordedAt,
      ).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';
  const avgAccuracy =
    sessions.length === 0
      ? null
      : Math.round((sessions.reduce((sum, row) => sum + row.accuracy, 0) / sessions.length) * 10) / 10;

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
      setPhoneSection('patients');
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
      pushAppToast(
        setToasts,
        'success',
        enabled ? `Prescribed module for ${patientName}` : `Removed module for ${patientName}`,
      );
    } catch (err) {
      setPatients((prev) =>
        prev.map((p) => (p.id === patientId ? { ...p, prescribedModuleIds: previousIds, prescribedLevels: previousLevels } : p)),
      );
      const msg = err instanceof ApiError ? err.message : 'Could not update prescription';
      setError(msg);
      pushAppToast(setToasts, 'error', msg);
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
      pushAppToast(setToasts, 'success', `Updated levels for ${patientName}`);
    } catch (err) {
      setPatients((prev) => prev.map((p) => (p.id === patientId ? { ...p, prescribedLevels: previousLevels } : p)));
      const msg = err instanceof ApiError ? err.message : 'Could not update level';
      setError(msg);
      pushAppToast(setToasts, 'error', msg);
    } finally {
      setTimeout(() => {
        inFlightRef.current.delete(key);
      }, 400);
    }
  }

  if (loading || dataLoading || !session || session.user.role !== 'doctor') {
    return <ScreenLoader />;
  }

  const referralExtra = session.doctor ? <CopyDocId code={session.doctor.referralCode} /> : null;

  function openAnalytics(patientId: string) {
    setAnalyticsOrigin({ section: phoneSection, patientId: selectedId });
    setSelectedId(patientId);
    setShowAnalytics(true);
  }

  function closeAnalytics() {
    setShowAnalytics(false);
    if (analyticsOrigin) {
      setPhoneSection(analyticsOrigin.section);
      setPhoneTab('patients');
      setSelectedId(analyticsOrigin.patientId);
      setAnalyticsOrigin(null);
    }
  }

  if (showAnalytics && selected) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.page }}>
        <AppHeader onBack={closeAnalytics} extra={referralExtra} />
        <ScrollView contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
          <Text style={{ fontSize: fs(21), fontWeight: '600' }}>{selected.name}</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(4), marginBottom: s(20) }}>
            {selected.email} · {selected.phone}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(13), marginBottom: s(21) }}>
            <View
              style={{
                width: s(40),
                height: s(40),
                borderRadius: s(13),
                backgroundColor: '#EFF6FF',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AnalyticsIcon size={s(22)} color={colors.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: fs(13), color: colors.muted }}>
                Performance for {selected.name} across therapy modules
              </Text>
            </View>
            <Pressable
              onPress={() => Alert.alert('Coming soon.')}
              style={{
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: s(13),
                paddingHorizontal: s(13),
                paddingVertical: s(8),
                backgroundColor: colors.white,
              }}
            >
              <Text style={{ fontWeight: '600', fontSize: fs(13), color: colors.text }}>Other device games</Text>
            </Pressable>
          </View>
          <SessionAnalyticsPanel patientId={selected.id} patientName={selected.name} />
        </ScrollView>
        <AppToastHost toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))} />
      </View>
    );
  }

  const phoneProfile = !isTablet && Boolean(selected);
  const phoneHome = !isTablet && !phoneProfile;
  const sectionTitle: Record<PhoneSection, string> = {
    overview: 'Doctor dashboard',
    patients: 'My patients',
    prescriptions: 'Prescriptions',
    analytics: 'Analytics',
    transfers: 'Transfer requests',
    settings: 'Settings',
  };
  const phoneNav: { id: PhoneSection; label: string; icon: typeof UsersIcon }[] = [
    { id: 'overview', label: 'Overview', icon: MonitorIcon },
    { id: 'patients', label: 'My patients', icon: UsersIcon },
    { id: 'prescriptions', label: 'Prescriptions', icon: SlidersIcon },
    { id: 'analytics', label: 'Analytics', icon: AnalyticsIcon },
    { id: 'transfers', label: 'Transfer requests', icon: BellIcon },
    { id: 'settings', label: 'Settings', icon: UserIcon },
  ];
  const prescribedPatientCount = patients.filter((patient) => patient.prescribedModuleIds.length > 0).length;

  function openPhoneSection(next: PhoneSection) {
    setPhoneSection(next);
    setSelectedId(null);
    setShowAnalytics(false);
    setNavOpen(false);
  }

  function renderNav() {
    return (
    <View
      style={{
        backgroundColor: colors.white,
        borderRadius: s(13),
        borderWidth: 1,
        borderColor: colors.border,
        padding: s(13),
        gap: s(8),
        ...cardShadow,
      }}
    >
      {phoneNav.map((item) => {
        const Icon = item.icon;
        const active = phoneSection === item.id;
        return (
          <Pressable
            key={item.id}
            onPress={() => openPhoneSection(item.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(8),
              borderRadius: s(8),
              paddingHorizontal: s(13),
              paddingVertical: s(13),
              backgroundColor: active ? '#111827' : 'transparent',
            }}
          >
            <Icon size={s(16)} color={active ? colors.white : '#374151'} />
            <Text style={{ flex: 1, fontSize: fs(13), fontWeight: '600', color: active ? colors.white : '#374151' }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={() => {
          setNavOpen(false);
          void logout().then(() => router.replace('/' as never));
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(8),
          borderRadius: s(8),
          paddingHorizontal: s(13),
          paddingVertical: s(13),
          marginTop: s(13),
        }}
      >
        <LogOutIcon size={s(16)} color="#DC2626" />
        <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#DC2626' }}>Sign out</Text>
      </Pressable>
    </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <AppHeader
        extra={referralExtra}
        onBack={phoneProfile ? () => setSelectedId(null) : undefined}
        leading={
          phoneHome ? (
            <Pressable
              onPress={() => setNavOpen((open) => !open)}
              accessibilityRole="button"
              accessibilityLabel={navOpen ? 'Close sidebar' : 'Open sidebar'}
              hitSlop={s(8)}
              style={{ width: s(36), height: s(36), alignItems: 'center', justifyContent: 'center' }}
            >
              <SideDockIcon size={s(22)} color="#111827" open={navOpen} />
            </Pressable>
          ) : null
        }
      />
      <Modal visible={navOpen && !isTablet} transparent animationType="fade" onRequestClose={() => setNavOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.4)' }} onPress={() => setNavOpen(false)}>
          <View style={{ marginTop: insets.top + s(68), marginLeft: s(13), width: s(220) }}>
            {renderNav()}
          </View>
        </Pressable>
      </Modal>
      <View style={{ flex: 1, flexDirection: isTablet ? 'row' : 'column' }}>
        {isTablet ? (
          <View style={{ width: s(220), paddingLeft: pad, paddingTop: pad }}>
            {renderNav()}
          </View>
        ) : null}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: pad, paddingBottom: s(40) }}>
        {!phoneProfile ? (
          <Text style={{ fontSize: fs(21), fontWeight: '600', marginBottom: s(34) }}>{sectionTitle[phoneSection]}</Text>
        ) : null}
        {error ? <Text style={{ color: colors.red, marginBottom: s(13) }}>{error}</Text> : null}

        {!phoneProfile && phoneSection === 'overview' ? (
          <View style={{ gap: s(13), marginBottom: s(34) }}>
            {[
              { label: 'Assigned patients', value: String(patients.length), hint: 'Patients you can open', color: '#2563EB' },
              { label: 'Pending transfers', value: String(incoming.length), hint: 'Attach and change requests', color: '#D97706' },
              { label: 'Active prescriptions', value: String(prescribedPatientCount), hint: 'Patients with activities assigned', color: '#7C3AED' },
            ].map((card) => (
              <View
                key={card.label}
                style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}
              >
                <Text style={{ fontSize: fs(13), fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', color: card.color }}>{card.label}</Text>
                <Text style={{ fontSize: fs(34), fontWeight: '600', color: colors.text, marginTop: s(8) }}>{card.value}</Text>
                <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(8) }}>{card.hint}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {!phoneProfile && incoming.length > 0 && (phoneSection === 'overview' || phoneSection === 'transfers') ? (
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: s(13),
              padding: s(21),
              borderWidth: 1,
              borderColor: '#BFDBFE',
              marginBottom: s(21),
              ...cardShadow,
            }}
          >
            <Text style={{ fontSize: fs(21), fontWeight: '700', marginBottom: s(4) }}>Incoming attach requests</Text>
            <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(13) }}>
              Patients asked to join or switch to your DocID. Confirm or reject here if the email is delayed.
            </Text>
            {incoming.map((request) => (
              <View
                key={request.id}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: s(13),
                  padding: s(13),
                  marginBottom: s(8),
                }}
              >
                <Text style={{ fontWeight: '700', fontSize: fs(13) }}>{request.patientName}</Text>
                <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(2) }}>
                  {request.patientEmail}
                  {request.source === 'change' ? ' · reassignment' : ' · new attach'}
                </Text>
                <View style={{ flexDirection: 'row', gap: s(8), marginTop: s(13) }}>
                  <Pressable
                    onPress={() => void settleIncoming(request.id, true)}
                    disabled={incomingBusy === request.id}
                    style={{
                      flex: 1,
                      backgroundColor: colors.blue,
                      borderRadius: s(8),
                      paddingVertical: s(13),
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
                      borderRadius: s(8),
                      paddingVertical: s(13),
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

        {!phoneProfile && phoneSection === 'patients' ? (
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: '#E5E7EB',
              borderRadius: s(13),
              padding: s(4),
              marginBottom: s(21),
            }}
          >
            <Pressable
              onPress={() => setPhoneTab('create')}
              accessibilityRole="tab"
              accessibilityState={{ selected: phoneTab === 'create' }}
              style={{
                flex: 1,
                paddingVertical: s(13),
                borderRadius: s(8),
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
                paddingVertical: s(13),
                borderRadius: s(8),
                backgroundColor: phoneTab === 'patients' ? colors.white : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: fs(13), color: phoneTab === 'patients' ? colors.blue : colors.muted }}>
                Patients
              </Text>
            </Pressable>
          </View>
        ) : null}

        {!phoneProfile && phoneSection === 'patients' && phoneTab === 'create' ? (
        <View style={{ backgroundColor: colors.white, borderRadius: s(13), padding: s(21), borderWidth: 1, borderColor: colors.border, marginBottom: s(21), ...cardShadow }}>
          <Text style={{ fontSize: fs(21), fontWeight: '600', marginBottom: s(21) }}>Create patient</Text>
          <FloatingLabelInput label="Name" value={name} onChangeText={setName} scale="golden" />
          <FloatingLabelInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" scale="golden" />
          <FloatingLabelInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" scale="golden" />
          <FloatingLabelPasswordInput label="Password (min 8)" value={password} onChangeText={setPassword} scale="golden" style={{ marginBottom: s(21) }} />
          <Pressable
            onPress={() => void onCreatePatient()}
            disabled={saving}
            style={{ alignSelf: 'flex-start', backgroundColor: colors.blue, borderRadius: s(13), paddingHorizontal: s(21), paddingVertical: s(13), alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.white, fontSize: fs(13), fontWeight: '600' }}>{saving ? 'Creating…' : 'Create patient'}</Text>
          </Pressable>
        </View>
        ) : null}

        {phoneProfile || (phoneSection === 'patients' && phoneTab === 'patients') ? (
        <View style={{ flexDirection: isTablet ? 'row' : 'column', gap: s(13) }}>
          {isTablet || !selected ? (
          <View style={{ flex: 1, backgroundColor: colors.white, borderRadius: s(13), padding: s(21), borderWidth: 1, borderColor: colors.border, ...cardShadow }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(13), marginBottom: s(13) }}>
              {searchOpen ? (
                <View style={{ flex: 1 }}>
                  <FloatingLabelInput
                    label="Search patient name, email..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoFocus
                    scale="golden"
                    style={{ marginBottom: 0 }}
                  />
                </View>
              ) : (
                <>
                  <Text style={{ fontSize: fs(21), fontWeight: '600' }}>Patients</Text>
                  <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.muted, backgroundColor: '#F3F4F6', paddingHorizontal: s(8), paddingVertical: s(8), borderRadius: 999 }}>
                    {patients.length}
                  </Text>
                  <View style={{ flex: 1 }} />
                </>
              )}
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
                  borderRadius: s(13),
                  backgroundColor: searchOpen ? '#EFF6FF' : '#F3F4F6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {searchOpen ? <XIcon size={s(16)} color={colors.blue} /> : <SearchIcon size={s(18)} color={colors.muted} />}
              </Pressable>
            </View>
            {patients.length === 0 ? (
              <View style={{ paddingVertical: s(8) }}>
                <Text style={{ color: colors.muted }}>No patients yet.</Text>
                {!isTablet ? (
                  <Pressable
                    onPress={() => setPhoneTab('create')}
                    style={{ marginTop: s(13), backgroundColor: colors.blue, borderRadius: s(13), padding: s(13), alignItems: 'center' }}
                  >
                    <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(13) }}>Create a patient</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {patients.length > 0 && filteredPatients.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: s(16) }}>
                <SearchIcon size={s(28)} color="#D1D5DB" />
                <Text style={{ color: colors.muted, textAlign: 'center', marginTop: s(8), fontSize: fs(13), fontWeight: '600' }}>No patients found</Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(13), marginTop: s(2) }}>No match for "{searchQuery}"</Text>
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
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(13),
                  borderRadius: isTablet ? s(12) : 0,
                  padding: s(13),
                  marginBottom: isTablet ? s(8) : 0,
                  borderBottomWidth: isTablet ? 0 : 1,
                  borderBottomColor: '#E5E7EB',
                  backgroundColor: isTablet && selectedId === patient.id ? colors.blue : isTablet ? '#F9FAFB' : 'transparent',
                }}
              >
                {!isTablet ? (
                  <View
                    style={{
                      width: s(40),
                      height: s(40),
                      borderRadius: s(13),
                      backgroundColor: colors.blue,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(13) }}>{patientInitials(patient.name)}</Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: isTablet && selectedId === patient.id ? colors.white : colors.text }}>{patient.name}</Text>
                  {isTablet ? (
                    <Text style={{ fontSize: fs(13), color: selectedId === patient.id ? '#DBEAFE' : colors.muted }}>
                      {patient.email} · {patient.phone}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
          ) : null}

          {selected ? (
          <View style={{ flex: isTablet ? 2 : undefined, alignSelf: 'stretch', backgroundColor: colors.white, borderRadius: s(13), padding: s(21), borderWidth: 1, borderColor: colors.border, ...cardShadow }}>
                <View style={{ gap: s(8), marginBottom: s(13) }}>
                  <View>
                    <Text style={{ fontSize: fs(21), fontWeight: '700' }}>{selected.name}</Text>
                    <Text style={{ color: colors.muted, marginTop: s(2), fontSize: fs(13) }}>
                      {selected.email} · {selected.phone}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                    <Pressable
                      onPress={() => openAnalytics(selected.id)}
                      accessibilityRole="button"
                      accessibilityLabel="View Session Analytics"
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: s(6),
                        backgroundColor: colors.white,
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: s(13),
                        paddingHorizontal: s(13),
                        paddingVertical: s(8),
                      }}
                    >
                      <AnalyticsIcon size={s(18)} color={colors.blue} />
                      <Text style={{ fontWeight: '600', fontSize: fs(13) }}>Analytics</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => Alert.alert('Coming soon.')}
                      style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        borderRadius: s(13),
                        paddingHorizontal: s(13),
                        paddingVertical: s(8),
                        backgroundColor: colors.white,
                      }}
                    >
                      <Text style={{ fontWeight: '600', fontSize: fs(13), color: colors.text }}>Other device games</Text>
                    </Pressable>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(13), marginBottom: s(21) }}>
                  <SummaryCard
                    label="Sessions"
                    value={String(sessions.length)}
                    hint={sessions.length === 1 ? '1 finished play' : `${sessions.length} finished plays`}
                    fs={fs}
                    s={s}
                  />
                  <SummaryCard
                    label="Last played"
                    value={lastPlayed}
                    hint={sessions.length ? 'Most recent session' : 'Not played yet'}
                    fs={fs}
                    s={s}
                  />
                  <SummaryCard
                    label="Accuracy"
                    value={avgAccuracy != null ? `${avgAccuracy}%` : '—'}
                    hint={avgAccuracy != null ? 'Mean score' : 'No plays yet'}
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
                    fs={fs}
                    s={s}
                  />
                </View>
                <Text style={{ fontWeight: '600', marginBottom: s(13) }}>Prescribed modules & levels</Text>
                <View
                  style={{
                    alignSelf: 'center',
                    width: '100%',
                    maxWidth: s(420),
                    flexDirection: 'row',
                    backgroundColor: '#E5E7EB',
                    borderRadius: s(13),
                    padding: s(4),
                    marginBottom: s(13),
                  }}
                >
                  {(
                    [
                      { id: 'normal' as const, label: 'Standard games', count: GAME_FAMILIES.reduce((sum, family) => sum + family.moduleIds.length, 0) },
                      { id: 'pediatric' as const, label: 'Pediatric games', count: PEDIATRIC_GAME_FAMILIES.reduce((sum, family) => sum + family.moduleIds.length, 0) },
                    ]
                  ).map((tab) => {
                    const active = catalog === tab.id;
                    return (
                      <Pressable
                        key={tab.id}
                        onPress={() => {
                          setCatalog(tab.id);
                          setOpenFamilyId(null);
                        }}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: s(4),
                          borderRadius: s(13),
                          paddingVertical: s(8),
                          paddingHorizontal: s(6),
                          backgroundColor: active ? colors.white : 'transparent',
                        }}
                      >
                        <Text
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.8}
                          style={{ fontSize: fs(13), fontWeight: '700', color: active ? colors.blue : '#6B7280', textAlign: 'center' }}
                        >
                          {tab.label}
                        </Text>
                        <Text
                          style={{
                            fontSize: fs(13),
                            fontWeight: '700',
                            color: active ? colors.blue : '#6B7280',
                            backgroundColor: active ? '#EFF6FF' : '#F3F4F6',
                            paddingHorizontal: s(8),
                            paddingVertical: s(2),
                            borderRadius: 999,
                            overflow: 'hidden',
                          }}
                        >
                          {tab.count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {(catalog === 'normal' ? GAME_FAMILIES : PEDIATRIC_GAME_FAMILIES).length === 0 ? (
                  <Text style={{ color: colors.muted, fontSize: fs(13) }}>No pediatric games yet.</Text>
                ) : null}
                {(catalog === 'normal' ? GAME_FAMILIES : PEDIATRIC_GAME_FAMILIES).map((family) => {
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
                        borderRadius: s(13),
                        marginBottom: s(13),
                        overflow: 'hidden',
                      }}
                    >
                      <Pressable
                        onPress={() => setOpenFamilyId((current) => (current === family.id ? null : family.id))}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: s(13),
                          padding: s(13),
                          backgroundColor: '#F9FAFB',
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', fontSize: fs(15) }}>{family.title}</Text>
                          <Text style={{ fontSize: fs(13), color: colors.muted, marginTop: s(2) }}>{family.body}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                          <Text
                            style={{
                              fontSize: fs(13),
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
                                  padding: s(13),
                                }}
                              >
                                <Pressable onPress={() => void toggleModule(mod.id, !on)} style={{ flexDirection: 'row', gap: s(13) }}>
                                  <View style={{ marginTop: 2 }}>
                                    <PrescriptionTick checked={on} size={s(20)} />
                                  </View>
                                  <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '700' }}>{mod.name}</Text>
                                    <Text style={{ fontSize: fs(13), color: colors.muted }}>{mod.description}</Text>
                                  </View>
                                </Pressable>
                                {on && levels.length > 0 ? (
                                  <View style={{ marginTop: s(13), marginLeft: s(30), gap: s(6) }}>
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
                                            borderRadius: s(8),
                                            paddingHorizontal: s(13),
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
            <View style={{ flex: 2, backgroundColor: colors.white, borderRadius: s(13), padding: s(21), borderWidth: 1, borderColor: colors.border, ...cardShadow }}>
              <Text style={{ color: colors.muted }}>Select a patient to prescribe modules.</Text>
            </View>
          ) : null}
        </View>
        ) : null}
        {!phoneProfile && (phoneSection === 'overview' || phoneSection === 'prescriptions' || phoneSection === 'analytics') ? (
          <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
            <Text style={{ fontSize: fs(21), fontWeight: '700', marginBottom: s(8) }}>
              {phoneSection === 'overview' ? 'Patients' : 'Assigned patients'}
            </Text>
            {patients.length === 0 ? <Text style={{ color: colors.muted }}>No patients yet.</Text> : null}
            {patients.map((patient) => (
              <View
                key={patient.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(13),
                  paddingVertical: s(13),
                  borderBottomWidth: 1,
                  borderBottomColor: '#E5E7EB',
                }}
              >
                <View
                  style={{
                    width: s(40),
                    height: s(40),
                    borderRadius: s(13),
                    backgroundColor: colors.blue,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(13) }}>{patientInitials(patient.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={1}>{patient.name}</Text>
                  <Text style={{ fontSize: fs(13), color: colors.muted }} numberOfLines={1}>{prescriptionLabel(patient)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: s(16) }}>
                  <Pressable
                    onPress={() => {
                      if (isTablet) {
                        setPhoneSection('patients');
                        setPhoneTab('patients');
                      }
                      setSelectedId(patient.id);
                    }}
                    hitSlop={s(4)}
                  >
                    <Text style={{ color: colors.blue, fontWeight: '700', fontSize: fs(13), paddingVertical: s(4) }}>Open</Text>
                  </Pressable>
                  {phoneSection === 'analytics' ? (
                    <Pressable
                      onPress={() => openAnalytics(patient.id)}
                      hitSlop={s(4)}
                    >
                      <Text style={{ color: colors.blue, fontWeight: '700', fontSize: fs(13), paddingVertical: s(4) }}>Analytics</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}
        {!phoneProfile && phoneSection === 'transfers' && incoming.length === 0 ? (
          <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), ...cardShadow }}>
            <Text style={{ color: colors.muted, fontSize: fs(13) }}>No pending transfer requests.</Text>
          </View>
        ) : null}
        {!phoneProfile && phoneSection === 'settings' ? (
          <View style={{ backgroundColor: colors.white, borderRadius: s(13), borderWidth: 1, borderColor: colors.border, padding: s(21), gap: s(13), ...cardShadow }}>
            {[
              ['Name', session.user.name],
              ['Email', session.user.email],
              ['Phone', session.user.phone || '—'],
              ['Organization', session.organization?.name || '—'],
              ['DocID', session.doctor?.referralCode || '—'],
            ].map(([label, value]) => (
              <View key={label}>
                <Text style={{ fontSize: fs(13), color: colors.muted }}>{label}</Text>
                {label === 'DocID' && session.doctor?.referralCode ? (
                  <CopyDocId code={session.doctor.referralCode} plain />
                ) : (
                  <Text style={{ marginTop: s(8), fontSize: fs(21), fontWeight: '600', color: colors.text }}>{value}</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
      </View>
      <AppToastHost toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((item) => item.id !== id))} />
    </View>
  );
}
