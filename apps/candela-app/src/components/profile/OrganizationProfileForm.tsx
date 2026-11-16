'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  ORGANIZATION_TYPE_OPTIONS,
  PROFILE_COUNTRY_OPTIONS,
  type MeProfileResponse,
  type OrganizationIdentityProfile,
} from '@candela/shared';
import { ApiError, api, deleteOrganizationLogo, uploadOrganizationLogo } from '@/lib/api';
import { useToast } from '@/lib/toast-context';
import { FloatingLabelInput } from '@/components/ui/FloatingLabelInput';
import { clearProfilePromptDismiss } from '@/lib/profile-prompt';
import { useAuth } from '@/lib/auth-context';

type Draft = {
  name: string;
  contactEmail: string;
  organizationType: string;
  contactPhone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  website: string;
  licenseNumber: string;
};

function fromProfile(p: OrganizationIdentityProfile): Draft {
  return {
    name: p.name || '',
    contactEmail: p.contactEmail || '',
    organizationType: p.organizationType || '',
    contactPhone: p.contactPhone || '',
    addressLine1: p.addressLine1 || '',
    addressLine2: p.addressLine2 || '',
    city: p.city || '',
    state: p.state || '',
    country: p.country || '',
    website: p.website || '',
    licenseNumber: p.licenseNumber || '',
  };
}

export function OrganizationProfileForm({ organizationId }: { organizationId?: string }) {
  const toast = useToast();
  const { session } = useAuth();
  const [orgId, setOrgId] = useState(organizationId || '');
  const [profile, setProfile] = useState<OrganizationIdentityProfile | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [logoBusy, setLogoBusy] = useState(false);

  async function reload(id: string) {
    const profile = await api<OrganizationIdentityProfile>(`/api/organizations/${id}/profile`);
    setProfile(profile);
    setDraft(fromProfile(profile));
    setOrgId(id);
  }

  useEffect(() => {
    void (async () => {
      try {
        let id = organizationId || session?.user.organizationId || '';
        if (!id) {
          const me = await api<MeProfileResponse>('/api/me/profile');
          if (me.role === 'admin' && me.organizationId) {
            id = me.organizationId;
          }
        }
        if (!id) throw new Error('No organisation assigned');
        await reload(id);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not load organisation');
      } finally {
        setLoading(false);
      }
    })();
  }, [organizationId, session?.user.organizationId]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!draft || !orgId) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api<OrganizationIdentityProfile>(`/api/organizations/${orgId}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name.trim(),
          contactEmail: draft.contactEmail.trim() || null,
          organizationType: draft.organizationType || null,
          contactPhone: draft.contactPhone.trim() || null,
          addressLine1: draft.addressLine1.trim() || null,
          addressLine2: draft.addressLine2.trim() || null,
          city: draft.city.trim() || null,
          state: draft.state.trim() || null,
          country: draft.country || null,
          website: draft.website.trim() || null,
          licenseNumber: draft.licenseNumber.trim() || null,
        }),
      });
      setProfile(updated);
      setDraft(fromProfile(updated));
      toast.success('Organisation profile saved');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save organisation profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function onComplete() {
    if (!orgId) return;
    setCompleting(true);
    try {
      const updated = await api<OrganizationIdentityProfile>(`/api/organizations/${orgId}/profile/complete`, {
        method: 'POST',
      });
      setProfile(updated);
      setDraft(fromProfile(updated));
      if (session?.user.id) clearProfilePromptDismiss(session.user.id);
      toast.success('Organisation profile completed');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not complete organisation profile';
      setError(msg);
      toast.error(msg);
    } finally {
      setCompleting(false);
    }
  }

  if (loading || !draft || !profile) {
    return <p className="text-sm text-gray-500">{error || 'Loading organisation profile…'}</p>;
  }

  return (
    <form onSubmit={onSave} className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-500">Organisation code</p>
        <p className="mt-1 font-mono text-lg font-semibold">{profile.code}</p>
        <p className="mt-3 text-sm text-gray-600">
          {profile.completion.profileComplete
            ? 'Organisation profile complete'
            : `Missing: ${profile.completion.missingFields.join(', ')}`}
        </p>
        <div className="mt-4 flex items-center gap-3">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="" className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-100 text-xs text-gray-500">
              No logo
            </div>
          )}
          <label className="cursor-pointer rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold">
            {logoBusy ? 'Uploading…' : 'Upload logo'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={logoBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void (async () => {
                  setLogoBusy(true);
                  try {
                    await uploadOrganizationLogo(orgId, file);
                    await reload(orgId);
                    toast.success('Logo updated');
                  } catch (err) {
                    toast.error(err instanceof ApiError ? err.message : 'Upload failed');
                  } finally {
                    setLogoBusy(false);
                  }
                })();
              }}
            />
          </label>
          {profile.logoPath ? (
            <button
              type="button"
              className="text-sm text-red-600"
              onClick={() =>
                void (async () => {
                  await deleteOrganizationLogo(orgId);
                  await reload(orgId);
                })()
              }
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FloatingLabelInput label="Organisation name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} />
        <FloatingLabelInput
          label="Contact email"
          value={draft.contactEmail}
          onChange={(v) => setDraft({ ...draft, contactEmail: v })}
        />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Organisation type</span>
          <select
            value={draft.organizationType}
            onChange={(e) => setDraft({ ...draft, organizationType: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm"
          >
            <option value="">Select…</option>
            {ORGANIZATION_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <FloatingLabelInput
          label="Contact phone (E.164)"
          value={draft.contactPhone}
          onChange={(v) => setDraft({ ...draft, contactPhone: v })}
        />
        <FloatingLabelInput
          label="Address line 1"
          value={draft.addressLine1}
          onChange={(v) => setDraft({ ...draft, addressLine1: v })}
          className="sm:col-span-2"
        />
        <FloatingLabelInput
          label="Address line 2 (optional)"
          value={draft.addressLine2}
          onChange={(v) => setDraft({ ...draft, addressLine2: v })}
          className="sm:col-span-2"
        />
        <FloatingLabelInput label="City" value={draft.city} onChange={(v) => setDraft({ ...draft, city: v })} />
        <FloatingLabelInput label="State" value={draft.state} onChange={(v) => setDraft({ ...draft, state: v })} />
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Country</span>
          <select
            value={PROFILE_COUNTRY_OPTIONS.some((c) => c.value === draft.country) ? draft.country : 'other'}
            onChange={(e) =>
              setDraft({
                ...draft,
                country: e.target.value === 'other' ? draft.country || '' : e.target.value,
              })
            }
            className="w-full rounded-xl border border-gray-200 px-3 py-3 text-sm"
          >
            <option value="">Select…</option>
            {PROFILE_COUNTRY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {!PROFILE_COUNTRY_OPTIONS.some((c) => c.value === draft.country) ? (
          <FloatingLabelInput
            label="Country code (ISO-2)"
            value={draft.country}
            onChange={(v) => setDraft({ ...draft, country: v.toUpperCase() })}
          />
        ) : null}
        <FloatingLabelInput
          label="Website (https, optional)"
          value={draft.website}
          onChange={(v) => setDraft({ ...draft, website: v })}
        />
        <FloatingLabelInput
          label="Licence number (optional)"
          value={draft.licenseNumber}
          onChange={(v) => setDraft({ ...draft, licenseNumber: v })}
        />
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={saving} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={completing || profile.completion.profileComplete}
          onClick={() => void onComplete()}
          className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60"
        >
          {completing ? 'Completing…' : 'Mark profile complete'}
        </button>
      </div>
    </form>
  );
}
