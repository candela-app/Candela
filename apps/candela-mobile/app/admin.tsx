import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { DoctorSummary, DocIdRequestResult, PatientSummary } from '@candela/shared/rn';
import { AppHeader } from '../src/components/AppHeader';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '../src/components/FloatingLabelInput';
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
  const [dataLoading, setDataLoading] = useState(true);

  const [editDoctor, setEditDoctor] = useState<DoctorSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [deleteDoctor, setDeleteDoctor] = useState<DoctorSummary | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [docIdFilter, setDocIdFilter] = useState('');
  const [transferPatientId, setTransferPatientId] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);
  const [showPatientPicker, setShowPatientPicker] = useState(false);

  const load = useCallback(async () => {
    try {
      const [nextDoctors, nextPatients] = await Promise.all([
        api<DoctorSummary[]>('/api/admin/doctors'),
        api<PatientSummary[]>('/api/admin/patients'),
      ]);
      setDoctors(nextDoctors);
      setPatients(nextPatients);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!session || session.user.role !== 'admin') {
      router.replace('/login');
      return;
    }
    load().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [loading, session, router, load]);

  const visiblePatients = useMemo(() => {
    const q = docIdFilter.trim().toUpperCase();
    if (!q) return patients;
    return patients.filter(
      (patient) =>
        (patient.referralCode || '').toUpperCase().includes(q) ||
        (patient.previousReferralCodes || []).some((code) => code.toUpperCase().includes(q)),
    );
  }, [patients, docIdFilter]);

  const grouped = useMemo(() => {
    const byDoctor = new Map<string, { doctorName: string; code: string; patients: PatientSummary[] }>();
    const unlinked: PatientSummary[] = [];
    for (const patient of visiblePatients) {
      if (!patient.doctorId) {
        unlinked.push(patient);
        continue;
      }
      const existing = byDoctor.get(patient.doctorId);
      if (existing) existing.patients.push(patient);
      else {
        byDoctor.set(patient.doctorId, {
          doctorName: patient.doctorName || 'Doctor',
          code: patient.referralCode || '—',
          patients: [patient],
        });
      }
    }
    return { byDoctor, unlinked };
  }, [visiblePatients]);

  const transferPatient = patients.find((p) => p.id === transferPatientId);

  async function onCreateDoctor() {
    setError('');
    setSaving(true);
    const doctorName = name.trim();
    try {
      await api('/api/admin/doctors', { method: 'POST', body: JSON.stringify({ name, phone, email, password }) });
      setName('');
      setPhone('');
      setEmail('');
      setPassword('');
      await load();
      Alert.alert('Success', `Doctor ${doctorName} created successfully!`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create doctor';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  }

  function openEditModal(doctor: DoctorSummary) {
    setEditDoctor(doctor);
    setEditName(doctor.name);
    setEditPhone(doctor.phone);
    setEditEmail(doctor.email);
    setEditPassword('');
    setEditError('');
  }

  async function onUpdateDoctor() {
    if (!editDoctor) return;
    setEditError('');
    setEditSaving(true);
    try {
      const payload: Record<string, string> = { name: editName.trim(), phone: editPhone.trim(), email: editEmail.trim() };
      if (editPassword.trim()) payload.password = editPassword.trim();
      await api(`/api/admin/doctors/${editDoctor.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      await load();
      Alert.alert('Success', `Updated details for Dr. ${editName.trim()}!`);
      setEditDoctor(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not update doctor';
      setEditError(msg);
      Alert.alert('Error', msg);
    } finally {
      setEditSaving(false);
    }
  }

  async function onConfirmDeleteDoctor() {
    if (!deleteDoctor) return;
    const deletedName = deleteDoctor.name;
    setDeleteError('');
    setDeleteSaving(true);
    try {
      await api(`/api/admin/doctors/${deleteDoctor.id}`, { method: 'DELETE' });
      await load();
      Alert.alert('Deleted', `Deleted doctor account for Dr. ${deletedName}.`);
      setDeleteDoctor(null);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not delete doctor';
      setDeleteError(msg);
      Alert.alert('Error', msg);
    } finally {
      setDeleteSaving(false);
    }
  }

  async function onTransfer() {
    setError('');
    setTransferSaving(true);
    try {
      const result = await api<DocIdRequestResult>('/api/docid/transfers', {
        method: 'POST',
        body: JSON.stringify({ patientId: transferPatientId, referralCode: transferCode.trim().toUpperCase() }),
      });
      setTransferCode('');
      await load();
      Alert.alert(
        'Transfer requested',
        result.emailSent
          ? `The patient must confirm DocID ${result.targetReferralCode} by email.`
          : `Transfer requested for DocID ${result.targetReferralCode}. The patient can confirm in their dashboard if the email is delayed.`,
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not request transfer';
      setError(msg);
      Alert.alert('Error', msg);
    } finally {
      setTransferSaving(false);
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

  if (loading || dataLoading || !session || session.user.role !== 'admin') {
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
          Create doctors, edit their details, and review every patient on the platform.
        </Text>
        {error ? <Text style={{ color: colors.red, marginBottom: s(12) }}>{error}</Text> : null}

        <View style={{ backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border, marginBottom: s(16) }}>
          <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(12) }}>Create doctor</Text>
          <FloatingLabelInput label="Name" value={name} onChangeText={setName} />
          <FloatingLabelInput label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <FloatingLabelInput label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <FloatingLabelPasswordInput label="Password (min 8)" value={password} onChangeText={setPassword} />
          <Pressable
            onPress={() => void onCreateDoctor()}
            disabled={saving}
            style={{ backgroundColor: colors.blue, borderRadius: s(12), padding: s(14), alignItems: 'center', opacity: saving ? 0.6 : 1 }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>{saving ? 'Creating…' : 'Create doctor'}</Text>
          </Pressable>
        </View>

        <View style={{ backgroundColor: colors.white, borderRadius: s(20), padding: s(16), borderWidth: 1, borderColor: colors.border, marginBottom: s(16) }}>
          <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(4) }}>Internal DocID transfer</Text>
          <Text style={{ fontSize: fs(13), color: colors.muted, marginBottom: s(12) }}>
            Sends a confirmation email to the patient. The current DocID is kept in history after they confirm.
          </Text>
          <Pressable
            onPress={() => setShowPatientPicker(true)}
            style={{ ...inputStyle, justifyContent: 'center', marginBottom: s(10) }}
          >
            <Text style={{ color: transferPatient ? colors.text : colors.muted, fontSize: fs(14) }}>
              {transferPatient
                ? `${transferPatient.name} ${transferPatient.referralCode ? `(${transferPatient.referralCode})` : '(unlinked)'}`
                : 'Select patient'}
            </Text>
          </Pressable>
          <FloatingLabelInput
            label="Target DocID"
            value={transferCode}
            onChangeText={(v) => setTransferCode(v.toUpperCase())}
            maxLength={6}
            autoCapitalize="characters"
          />
          <Pressable
            onPress={() => void onTransfer()}
            disabled={transferSaving || !transferPatientId || transferCode.trim().length !== 6}
            style={{
              backgroundColor: colors.indigo,
              borderRadius: s(12),
              padding: s(14),
              alignItems: 'center',
              opacity: transferSaving || !transferPatientId || transferCode.trim().length !== 6 ? 0.6 : 1,
            }}
          >
            <Text style={{ color: colors.white, fontWeight: '700' }}>{transferSaving ? 'Sending…' : 'Request transfer'}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: s(12) }}>
          <Text style={{ fontSize: fs(17), fontWeight: '700' }}>Doctors</Text>
          <Text style={{ fontSize: fs(11), fontWeight: '700', color: colors.muted, backgroundColor: '#F3F4F6', paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: 999 }}>
            {doctors.length}
          </Text>
        </View>
        {doctors.length === 0 ? <Text style={{ color: colors.muted, marginBottom: s(16) }}>No doctors yet.</Text> : null}
        {doctors.map((doctor) => (
          <View
            key={doctor.id}
            style={{
              backgroundColor: colors.white,
              borderRadius: s(16),
              padding: s(16),
              marginBottom: s(10),
              borderWidth: 1,
              borderColor: colors.border,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: s(8),
            }}
          >
            <View style={{ flex: 1 }}>
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
                }}
              >
                {doctor.referralCode}
              </Text>
            </View>
            <View style={{ gap: s(8) }}>
              <Pressable onPress={() => openEditModal(doctor)} style={{ backgroundColor: '#EFF6FF', borderRadius: s(10), padding: s(10) }}>
                <Text style={{ color: colors.blue, fontWeight: '700', fontSize: fs(12) }}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => { setDeleteDoctor(doctor); setDeleteError(''); }} style={{ backgroundColor: '#FEF2F2', borderRadius: s(10), padding: s(10) }}>
                <Text style={{ color: colors.red, fontWeight: '700', fontSize: fs(12) }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <FloatingLabelInput
          label="Filter by DocID"
          value={docIdFilter}
          onChangeText={(v) => setDocIdFilter(v.toUpperCase())}
          autoCapitalize="characters"
          style={{ marginTop: s(16) }}
        />

        <Text style={{ fontSize: fs(17), fontWeight: '700', marginBottom: s(12) }}>Patients managed by doctors</Text>
        {[...grouped.byDoctor.entries()].map(([id, group]) => (
          <View key={id} style={{ backgroundColor: colors.white, borderRadius: s(16), padding: s(16), marginBottom: s(10), borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ fontWeight: '700' }}>
              {group.doctorName} <Text style={{ color: '#1D4ED8', fontFamily: 'monospace' }}>({group.code})</Text>
            </Text>
            {group.patients.map((patient) => (
              <Text key={patient.id} style={{ marginTop: s(6), color: '#374151', fontSize: fs(13) }}>
                {patient.name} · {patient.email} · {patient.phone}
                {patient.previousReferralCodes?.length > 0 ? ` · previous ${patient.previousReferralCodes.join(', ')}` : ''}
              </Text>
            ))}
          </View>
        ))}
        {grouped.byDoctor.size === 0 ? <Text style={{ color: colors.muted, marginBottom: s(12) }}>No doctor-managed patients yet.</Text> : null}

        <Text style={{ fontSize: fs(17), fontWeight: '700', marginTop: s(8), marginBottom: s(12) }}>Self-signup patients</Text>
        <View style={{ backgroundColor: colors.white, borderRadius: s(16), padding: s(16), borderWidth: 1, borderColor: colors.border }}>
          {grouped.unlinked.length === 0 ? <Text style={{ color: colors.muted }}>None yet.</Text> : null}
          {grouped.unlinked.map((patient) => (
            <Text key={patient.id} style={{ color: '#374151', fontSize: fs(13), marginBottom: s(6) }}>
              {patient.name} · {patient.email} · {patient.phone}
              {patient.previousReferralCodes?.length > 0 ? ` · previous ${patient.previousReferralCodes.join(', ')}` : ''}
            </Text>
          ))}
        </View>
      </ScrollView>

      {/* Edit doctor modal */}
      <Modal visible={Boolean(editDoctor)} animationType="slide" transparent onRequestClose={() => setEditDoctor(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: pad }}>
          <ScrollView style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(20), maxHeight: '90%' }}>
            <Text style={{ fontSize: fs(20), fontWeight: '800', marginBottom: s(4) }}>Edit Doctor</Text>
            {editDoctor ? (
              <Text style={{ fontSize: fs(12), color: colors.muted, marginBottom: s(16) }}>
                DocID: <Text style={{ fontFamily: 'monospace', fontWeight: '800', color: colors.blue }}>{editDoctor.referralCode}</Text>
              </Text>
            ) : null}
            {editError ? <Text style={{ color: colors.red, marginBottom: s(12) }}>{editError}</Text> : null}
            <FloatingLabelInput label="Doctor Name" value={editName} onChangeText={setEditName} />
            <FloatingLabelInput label="Phone Number" value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" />
            <FloatingLabelInput label="Email Address" value={editEmail} onChangeText={setEditEmail} autoCapitalize="none" keyboardType="email-address" />
            <FloatingLabelPasswordInput label="New Password (optional)" value={editPassword} onChangeText={setEditPassword} />
            <View style={{ flexDirection: 'row', gap: s(10), marginTop: s(8) }}>
              <Pressable onPress={() => setEditDoctor(null)} style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: s(12), padding: s(14), alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#374151' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onUpdateDoctor()}
                disabled={editSaving}
                style={{ flex: 1, backgroundColor: colors.blue, borderRadius: s(12), padding: s(14), alignItems: 'center', opacity: editSaving ? 0.6 : 1 }}
              >
                <Text style={{ fontWeight: '700', color: colors.white }}>{editSaving ? 'Saving…' : 'Save Changes'}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Delete doctor modal */}
      <Modal visible={Boolean(deleteDoctor)} animationType="fade" transparent onRequestClose={() => setDeleteDoctor(null)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: pad }}>
          <View style={{ backgroundColor: colors.white, borderRadius: s(24), padding: s(24), alignItems: 'center' }}>
            <Text style={{ fontSize: fs(20), fontWeight: '800', marginBottom: s(8) }}>Delete Doctor Account</Text>
            {deleteDoctor ? (
              <>
                <Text style={{ fontSize: fs(14), color: colors.muted, textAlign: 'center', marginBottom: s(12) }}>
                  Are you sure you want to delete Dr. {deleteDoctor.name} ({deleteDoctor.email})?
                </Text>
                <Text style={{ fontSize: fs(12), color: colors.red, backgroundColor: '#FEF2F2', borderRadius: s(12), padding: s(12), textAlign: 'center', marginBottom: s(12) }}>
                  This will remove DocID {deleteDoctor.referralCode} and unlink any patients previously managed by this doctor.
                </Text>
              </>
            ) : null}
            {deleteError ? <Text style={{ color: colors.red, marginBottom: s(12) }}>{deleteError}</Text> : null}
            <View style={{ flexDirection: 'row', gap: s(10), width: '100%' }}>
              <Pressable onPress={() => setDeleteDoctor(null)} disabled={deleteSaving} style={{ flex: 1, backgroundColor: '#F3F4F6', borderRadius: s(12), padding: s(14), alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#374151' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void onConfirmDeleteDoctor()}
                disabled={deleteSaving}
                style={{ flex: 1, backgroundColor: colors.red, borderRadius: s(12), padding: s(14), alignItems: 'center', opacity: deleteSaving ? 0.6 : 1 }}
              >
                <Text style={{ fontWeight: '700', color: colors.white }}>{deleteSaving ? 'Deleting…' : 'Delete Doctor'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Patient picker for transfer */}
      <Modal visible={showPatientPicker} animationType="slide" transparent onRequestClose={() => setShowPatientPicker(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: colors.white, borderTopLeftRadius: s(24), borderTopRightRadius: s(24), maxHeight: '70%' }}>
            <Text style={{ fontSize: fs(18), fontWeight: '800', padding: s(20), borderBottomWidth: 1, borderBottomColor: colors.border }}>Select patient</Text>
            <ScrollView>
              {patients.map((patient) => (
                <Pressable
                  key={patient.id}
                  onPress={() => {
                    setTransferPatientId(patient.id);
                    setShowPatientPicker(false);
                  }}
                  style={{ paddingHorizontal: s(20), paddingVertical: s(14), borderBottomWidth: 1, borderBottomColor: colors.border }}
                >
                  <Text style={{ fontWeight: '700' }}>{patient.name}</Text>
                  <Text style={{ fontSize: fs(12), color: colors.muted }}>
                    {patient.referralCode ? patient.referralCode : 'unlinked'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => setShowPatientPicker(false)} style={{ padding: s(20), alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: colors.muted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
