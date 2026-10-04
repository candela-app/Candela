'use client';

import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast-context';
import { ApiError, api } from '@/lib/api';
import type { DoctorSummary, DocIdRequestResult, PatientSummary } from '@candela/shared';
import { AppHeader } from '@/components/layout/AppHeader';
import { AdminDashboardSkeleton } from '@/components/common/Skeleton';
import { ArrowLeftIcon, EditIcon, TrashIcon, XIcon } from '@/components/icons/VectorIcons';
import { SearchInput } from '@/components/common/SearchInput';
import {
  FloatingLabelInput,
  FloatingLabelPasswordInput,
} from '@/components/ui/FloatingLabelInput';
import { useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

export default function AdminPage() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const toast = useToast();
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Search Doctors State
  const [doctorSearch, setDoctorSearch] = useState('');

  // Selected Doctor Drill-Down State
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [doctorPatientFilter, setDoctorPatientFilter] = useState('');

  // Edit Doctor Modal State
  const [editDoctor, setEditDoctor] = useState<DoctorSummary | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete Confirmation Modal State
  const [deleteDoctor, setDeleteDoctor] = useState<DoctorSummary | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [transferPatientId, setTransferPatientId] = useState('');
  const [transferCode, setTransferCode] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);

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
    if (loading) {
      return;
    }
    if (!session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
      router.replace('/');
      return;
    }
    load().catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'));
  }, [loading, session, router, load]);

  const doctorPatientCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of patients) {
      if (p.doctorId) {
        map.set(p.doctorId, (map.get(p.doctorId) || 0) + 1);
      }
    }
    return map;
  }, [patients]);

  const filteredDoctors = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.email.toLowerCase().includes(q) ||
        d.referralCode.toLowerCase().includes(q) ||
        (d.phone && d.phone.toLowerCase().includes(q)),
    );
  }, [doctors, doctorSearch]);

  const selectedDoctor = useMemo(() => {
    if (!selectedDoctorId) return null;
    return doctors.find((d) => d.id === selectedDoctorId) || null;
  }, [doctors, selectedDoctorId]);

  const selectedDoctorPatients = useMemo(() => {
    if (!selectedDoctorId) return [];
    const docPatients = patients.filter((p) => p.doctorId === selectedDoctorId);
    const q = doctorPatientFilter.trim().toLowerCase();
    if (!q) return docPatients;
    return docPatients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone && p.phone.toLowerCase().includes(q)) ||
        (p.referralCode && p.referralCode.toLowerCase().includes(q)) ||
        (p.previousReferralCodes && p.previousReferralCodes.some((c) => c.toLowerCase().includes(q))),
    );
  }, [patients, selectedDoctorId, doctorPatientFilter]);

  async function onCreateDoctor(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    const doctorName = name.trim();
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
      toast.success(`Doctor ${doctorName} created successfully!`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not create doctor';
      setError(msg);
      toast.error(msg);
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

  function closeEditModal() {
    setEditDoctor(null);
    setEditError('');
  }

  async function onUpdateDoctor(e: FormEvent) {
    e.preventDefault();
    if (!editDoctor) return;
    setEditError('');
    setEditSaving(true);
    try {
      const payload: Record<string, string> = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
      };
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }
      await api(`/api/admin/doctors/${editDoctor.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      await load();
      toast.success(`Updated details for Dr. ${editName.trim()}!`);
      closeEditModal();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not update doctor';
      setEditError(msg);
      toast.error(msg);
    } finally {
      setEditSaving(false);
    }
  }

  function openDeleteModal(doctor: DoctorSummary) {
    setDeleteDoctor(doctor);
    setDeleteError('');
  }

  function closeDeleteModal() {
    setDeleteDoctor(null);
    setDeleteError('');
  }

  async function onConfirmDeleteDoctor() {
    if (!deleteDoctor) return;
    const deletedName = deleteDoctor.name;
    setDeleteError('');
    setDeleteSaving(true);
    try {
      await api(`/api/admin/doctors/${deleteDoctor.id}`, {
        method: 'DELETE',
      });
      await load();
      toast.info(`Deleted doctor account for Dr. ${deletedName}.`);
      closeDeleteModal();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not delete doctor';
      setDeleteError(msg);
      toast.error(msg);
    } finally {
      setDeleteSaving(false);
    }
  }

  async function onTransfer(e: FormEvent) {
    e.preventDefault();
    setError('');
    setTransferSaving(true);
    try {
      const result = await api<DocIdRequestResult>('/api/docid/transfers', {
        method: 'POST',
        body: JSON.stringify({
          patientId: transferPatientId,
          referralCode: transferCode.trim().toUpperCase(),
        }),
      });
      setTransferCode('');
      await load();
      toast.success(
        result.emailSent
          ? `Transfer requested. The patient must confirm DocID ${result.targetReferralCode} by email.`
          : `Transfer requested for DocID ${result.targetReferralCode}. The patient can confirm in their dashboard if the email is delayed.`,
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not request transfer';
      setError(msg);
      toast.error(msg);
    } finally {
      setTransferSaving(false);
    }
  }

  if (loading || dataLoading || !session || (session.user.role !== 'admin' && session.user.role !== 'super_admin')) {
    return (
      <div className="min-h-screen bg-[#F4F7FC]">
        <AppHeader />
        <AdminDashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FC]">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900">Admin Portal</h1>
            {session.organization && (
              <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
                {session.organization.name}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {session.organization
              ? `Manage doctors and review patients enrolled under ${session.organization.name}.`
              : 'Create doctors, edit their details, and review every patient on the platform.'}
          </p>
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Create doctor</h2>
          <form onSubmit={onCreateDoctor} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FloatingLabelInput label="Name" value={name} onChange={setName} required />
            <FloatingLabelInput label="Phone" value={phone} onChange={setPhone} required />
            <FloatingLabelInput label="Email" type="email" value={email} onChange={setEmail} required />
            <FloatingLabelPasswordInput
              label="Password (min 8)"
              value={password}
              onChange={setPassword}
              required
              minLength={8}
            />
            <button type="submit" disabled={saving} className="sm:col-span-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer">
              {saving ? 'Creating…' : 'Create doctor'}
            </button>
          </form>
        </section>

        <section className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Internal DocID transfer</h2>
          <p className="text-sm text-gray-500 mb-4">
            Sends a confirmation email to the patient. The current DocID is kept in history after they confirm.
          </p>
          <form onSubmit={onTransfer} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm bg-white"
              value={transferPatientId}
              onChange={(e) => setTransferPatientId(e.target.value)}
              required
            >
              <option value="">Select patient</option>
              {patients
                .filter((patient) => patient.doctorId)
                .map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.name} ({patient.referralCode || 'DocID'})
                  </option>
                ))}
            </select>
            <FloatingLabelInput
              label="Target DocID"
              value={transferCode}
              onChange={(v) => setTransferCode(v.toUpperCase())}
              minLength={6}
              maxLength={6}
              required
              className="[&_input]:font-mono [&_input]:font-bold [&_input]:tracking-widest [&_input]:uppercase"
            />
            <button
              type="submit"
              disabled={transferSaving || !transferPatientId || transferCode.trim().length !== 6}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
            >
              {transferSaving ? 'Sending…' : 'Request transfer'}
            </button>
          </form>
        </section>

        {!selectedDoctorId ? (
          /* Doctors List View */
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Doctors</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Click on any doctor to view their assigned patients.
                </p>
              </div>
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                {doctors.length} {doctors.length === 1 ? 'Doctor' : 'Doctors'}
              </span>
            </div>

            {/* Doctor Search Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <SearchInput
                value={doctorSearch}
                onChange={setDoctorSearch}
                placeholder="Search doctors by name, DocID, email..."
                className="w-full sm:w-80"
                aria-label="Search doctors"
              />
              <span className="text-xs text-gray-500">
                Showing {filteredDoctors.length} of {doctors.length} doctors
              </span>
            </div>

            <div className="grid gap-3">
              {filteredDoctors.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500 text-sm">
                  {doctorSearch ? 'No matching doctors found.' : 'No doctors yet. Create one above to get started.'}
                </div>
              ) : (
                filteredDoctors.map((doctor) => {
                  const count = doctorPatientCountMap.get(doctor.id) ?? 0;
                  return (
                    <div
                      key={doctor.id}
                      onClick={() => {
                        setSelectedDoctorId(doctor.id);
                        setDoctorPatientFilter('');
                      }}
                      className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:shadow-md hover:border-blue-200 transition-all cursor-pointer group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-extrabold flex items-center justify-center text-sm">
                          {doctor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-gray-900 text-base group-hover:text-blue-600 transition-colors">
                              {doctor.name}
                            </p>
                            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                              {count} {count === 1 ? 'patient' : 'patients'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {doctor.email} · {doctor.phone || 'No phone'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-extrabold tracking-wider text-blue-700 bg-blue-50 px-3.5 py-1.5 rounded-xl border border-blue-100">
                          {doctor.referralCode}
                        </span>
                        <span className="text-xs text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline">
                          View patients →
                        </span>
                        <div className="flex items-center gap-1 pl-2 border-l border-gray-100" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => openEditModal(doctor)}
                            className="p-2 rounded-xl text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title={`Edit Dr. ${doctor.name}`}
                          >
                            <EditIcon className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(doctor)}
                            className="p-2 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                            title={`Delete Dr. ${doctor.name}`}
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ) : selectedDoctor ? (
          /* Doctor Drill-Down Managed Patients View */
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedDoctorId(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 hover:text-blue-600 hover:border-blue-300 text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer"
              >
                <ArrowLeftIcon className="w-3.5 h-3.5" />
                <span>Back to all doctors</span>
              </button>
              <span className="text-xs text-gray-500">
                Doctor details & managed patients
              </span>
            </div>

            {/* Doctor Profile Summary Card */}
            <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
                  {selectedDoctor.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-xl font-bold text-gray-900">{selectedDoctor.name}</h3>
                    <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                      DocID: {selectedDoctor.referralCode}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Email: <strong className="text-gray-700">{selectedDoctor.email}</strong> · Phone: <strong className="text-gray-700">{selectedDoctor.phone || '—'}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(selectedDoctor)}
                  className="px-3.5 py-2 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                >
                  Edit Doctor
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteModal(selectedDoctor)}
                  className="px-3.5 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors cursor-pointer"
                >
                  Delete Doctor
                </button>
              </div>
            </div>

            {/* Managed Patients Search & Table */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <SearchInput
                  value={doctorPatientFilter}
                  onChange={setDoctorPatientFilter}
                  placeholder={`Search patients of Dr. ${selectedDoctor.name}...`}
                  className="w-full sm:w-80"
                  aria-label="Search managed patients"
                />
                <span className="text-xs text-gray-500">
                  Showing {selectedDoctorPatients.length} of {doctorPatientCountMap.get(selectedDoctor.id) ?? 0} managed patients
                </span>
              </div>

              {selectedDoctorPatients.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-500 text-sm">
                  {doctorPatientFilter
                    ? 'No matching patients found.'
                    : `No patients currently registered under Dr. ${selectedDoctor.name}.`}
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-600">
                      <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200 text-xs uppercase tracking-wider">
                        <tr>
                          <th className="px-6 py-3.5">Patient Name</th>
                          <th className="px-6 py-3.5">Contact Email</th>
                          <th className="px-6 py-3.5">Phone Number</th>
                          <th className="px-6 py-3.5">DocID Referral History</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedDoctorPatients.map((p) => (
                          <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                            <td className="px-6 py-4 font-semibold text-gray-900">{p.name}</td>
                            <td className="px-6 py-4 text-gray-700">{p.email}</td>
                            <td className="px-6 py-4 text-gray-500">{p.phone || '—'}</td>
                            <td className="px-6 py-4 text-xs text-gray-500">
                              <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 mr-2">
                                {p.referralCode || selectedDoctor.referralCode}
                              </span>
                              {p.previousReferralCodes && p.previousReferralCodes.length > 0 && (
                                <span className="text-gray-400">
                                  (prev: {p.previousReferralCodes.join(', ')})
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}
      </main>

      {/* EDIT DOCTOR MODAL */}
      {editDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-lg w-full p-6 sm:p-8 relative animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Edit Doctor</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  DocID: <span className="font-mono font-bold text-blue-600">{editDoctor.referralCode}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {editError && <p className="text-sm text-red-600 font-medium mb-4">{editError}</p>}

            <form onSubmit={onUpdateDoctor} className="space-y-4">
              <FloatingLabelInput label="Doctor Name" value={editName} onChange={setEditName} required />
              <FloatingLabelInput label="Phone Number" value={editPhone} onChange={setEditPhone} required />
              <FloatingLabelInput
                label="Email Address"
                type="email"
                value={editEmail}
                onChange={setEditEmail}
                required
              />
              <FloatingLabelPasswordInput
                label="New Password (optional)"
                value={editPassword}
                onChange={setEditPassword}
                minLength={8}
              />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-60 cursor-pointer"
                >
                  {editSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DOCTOR CONFIRMATION MODAL */}
      {deleteDoctor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-2xl max-w-md w-full p-6 sm:p-8 text-center relative animate-in fade-in zoom-in duration-150 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-50 text-red-500 border border-red-100 flex items-center justify-center mx-auto mb-2">
              <TrashIcon className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-gray-900">Delete Doctor Account</h3>
            <p className="text-sm text-gray-500 leading-relaxed">
              Are you sure you want to delete <strong className="text-gray-800">Dr. {deleteDoctor.name}</strong> ({deleteDoctor.email})?
            </p>
            <p className="text-xs text-red-600 bg-red-50 rounded-xl p-3 border border-red-100">
              This will remove DocID <strong>{deleteDoctor.referralCode}</strong> and unlink any patients previously managed by this doctor.
            </p>

            {deleteError && <p className="text-sm text-red-600 font-medium">{deleteError}</p>}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteSaving}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDeleteDoctor}
                disabled={deleteSaving}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-md shadow-red-500/20 transition-all disabled:opacity-60 cursor-pointer"
              >
                {deleteSaving ? 'Deleting…' : 'Delete Doctor'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
