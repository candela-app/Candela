'use client';

import { useEffect, useState } from 'react';
import {
  EMPTY_LEVELS_LABEL,
  GAME_CATALOG,
  assignmentLevelName,
  groupByGameFamily,
  isTherapyModuleId,
  type FamilyGroup,
  type PatientAssignmentItem,
  type PatientAssignmentsHistory,
} from '@candela/shared';
import { ApiError, getPatientAssignmentsHistory } from '@/lib/api';
import Stack from './Stack';

const FAMILY_ORDER = ['tap_timing', 'look_jumps', 'glimpse_hold', 'trace_build', 'spin_field'];

function moduleName(moduleId: string): string {
  return isTherapyModuleId(moduleId) ? GAME_CATALOG[moduleId].name : moduleId;
}

function formatDate(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone,
  });
}

function FamilyAssignmentsMap({ family }: { family: FamilyGroup<PatientAssignmentItem> }) {
  return (
    <div className="border-t border-slate-100 px-3 pb-3 pt-2">
      <div className="ml-[3px] mt-1.5 grid grid-cols-1 gap-x-4 gap-y-2 border-l-2 border-slate-200 pl-3 sm:grid-cols-2">
        {family.items.map((item) => {
          const levels = item.levels.length > 0
            ? item.levels.map((level) => assignmentLevelName(item.moduleId, level))
            : [EMPTY_LEVELS_LABEL];
          return (
            <div key={item.moduleId} className="relative min-w-0 pl-2">
              <span aria-hidden className="absolute left-[-12px] top-[8px] h-px w-3 bg-slate-300" />
              <h5 className="text-[11px] font-semibold leading-4 text-gray-800">{moduleName(item.moduleId)}</h5>
              <ul className="ml-1 mt-0.5 border-l border-slate-200 pl-3">
                {levels.map((level, levelIndex) => (
                  <li
                    key={`${item.moduleId}-${levelIndex}`}
                    className={`relative py-0.5 text-[11px] leading-4 text-gray-600 ${
                      levelIndex < levels.length - 1 ? 'border-b border-slate-100' : ''
                    }`}
                  >
                    <span aria-hidden className="absolute -left-3 top-[10px] h-px w-2 bg-slate-300" />
                    {level}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DoctorPatientAssignments({
  patientId,
  timeZone,
  open,
}: {
  patientId: string;
  timeZone: string;
  open: boolean;
}) {
  const [data, setData] = useState<PatientAssignmentsHistory | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openRevisionId, setOpenRevisionId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data != null) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getPatientAssignmentsHistory(patientId)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          const active = res.revisions.find((revision) => revision.effectiveTo == null);
          const latest = res.revisions[res.revisions.length - 1];
          setOpenRevisionId(active?.id ?? latest?.id ?? null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Failed to load assignments.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, patientId, data]);

  if (!open) return null;

  if (loading) {
    return (
      <div className="space-y-2 pt-3 animate-pulse" aria-busy="true">
        <div className="h-4 w-40 rounded bg-slate-200/80" />
        <div className="h-14 rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => {
            setData(null);
            setError('');
          }}
          className="mt-2 cursor-pointer font-semibold underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const revisions = data.revisions.slice().reverse();

  return (
    <section aria-label="Prescription history" className="space-y-3">
      <h2 className="text-[14px] font-semibold text-gray-900">Prescription history</h2>
      <div className="space-y-2">
        {revisions.length === 0 ? (
          <p className="text-[13px] text-gray-500">No prescription revisions recorded.</p>
        ) : (
          <ul className="space-y-2">
            {revisions.map((revision) => {
                  const revisionOpen = openRevisionId === revision.id;
                  const families = groupByGameFamily(revision.assignments).sort((a, b) => {
                    const order = (familyId: string | null) => {
                      if (familyId == null) return FAMILY_ORDER.length;
                      const index = FAMILY_ORDER.indexOf(familyId);
                      return index < 0 ? FAMILY_ORDER.length : index;
                    };
                    return order(a.familyId) - order(b.familyId);
                  });
                  return (
                    <li key={revision.id} className="overflow-hidden rounded-[11px] border border-gray-200 bg-white">
                      <button
                        type="button"
                        aria-expanded={revisionOpen}
                        onClick={() => {
                          setOpenRevisionId(revisionOpen ? null : revision.id);
                        }}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 px-3.5 py-3 text-left hover:bg-gray-50"
                      >
                        <span className="min-w-0">
                          <span className="block text-[13px] font-semibold text-gray-900">
                            Prescribed {formatDate(revision.effectiveFrom, timeZone)} -{' '}
                            {revision.effectiveTo ? formatDate(revision.effectiveTo, timeZone) : 'Present'}
                          </span>
                          <span className="mt-1 block text-[12px] text-gray-500">
                            {revision.actorLabel}
                            {revision.effectiveTo == null ? ' - Current prescription' : ''}
                          </span>
                        </span>
                        <span aria-hidden className="shrink-0 text-gray-500">
                          {revisionOpen ? '-' : '+'}
                        </span>
                      </button>
                      {revisionOpen ? (
                        <div className="border-t border-gray-100 px-3 py-2.5">
                          {families.length === 0 ? (
                            <p className="text-[13px] text-gray-500">No games assigned in this revision.</p>
                          ) : (
                            <div
                              className="w-full"
                              style={{ height: `${340 + Math.max(families.length - 1, 0) * 45}px` }}
                            >
                              <Stack
                                key={revision.id}
                                layout="deck"
                                sendToBackOnClick
                                visible={families.length}
                                spread={1.4}
                                depth={0.04}
                                onChange={undefined}
                                style={{}}
                                cards={families.map((family) => {
                                  const levelCount = family.items.reduce(
                                    (total, item) => total + item.levels.length,
                                    0,
                                  );
                                  return (
                                    <div
                                      key={family.familyId ?? 'other'}
                                      className="h-full w-full overflow-hidden rounded-2xl border border-slate-200 bg-white"
                                    >
                                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/80 px-3.5 py-2.5">
                                        <span className="flex min-w-0 items-center gap-2 text-[12px] font-semibold text-gray-800">
                                          <span
                                            aria-hidden
                                            className="size-2 shrink-0 rounded-full"
                                            style={family.accent ? { backgroundColor: family.accent } : undefined}
                                          />
                                          <span className="truncate">{family.title}</span>
                                        </span>
                                        <span className="shrink-0 text-[11px] text-gray-500">
                                          {family.items.length} {family.items.length === 1 ? 'game' : 'games'} - {levelCount}{' '}
                                          {levelCount === 1 ? 'level' : 'levels'}
                                        </span>
                                      </div>
                                      <FamilyAssignmentsMap family={family} />
                                    </div>
                                  );
                                })}
                              />
                            </div>
                          )}
                        </div>
                      ) : null}
                    </li>
                    );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
