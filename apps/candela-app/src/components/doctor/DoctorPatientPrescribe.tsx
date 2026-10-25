'use client';

import { MODULE_CARDS } from '@/lib/shell';
import { ChevronUpIcon } from '@/components/icons/VectorIcons';
import {
  CATALOG_TO_UI_MODULE,
  GAME_CATALOG,
  GAME_FAMILIES,
  PEDIATRIC_GAME_FAMILIES,
  MODULE_LEVELS,
  canonicalizeDirectionSenseLevels,
  type PatientSummary,
  type TherapyModuleId,
} from '@candela/shared';
import type { StoredGameSessionRecord } from '@/lib/api';
import { useState } from 'react';

function formatSessionDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) {
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = (seconds / 3600).toFixed(1);
  return `${hours}h`;
}

function formatSessionDate(dateStr: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  } catch {
    return '—';
  }
}

type Props = {
  patient: PatientSummary;
  sessions?: StoredGameSessionRecord[];
  onToggleModule: (moduleId: TherapyModuleId, enabled: boolean) => void;
  onToggleLevel: (moduleId: TherapyModuleId, levelId: string, enabled: boolean) => void;
};

function moduleCount(families: { moduleIds: string[] }[]) {
  return families.reduce((sum, family) => sum + family.moduleIds.length, 0);
}

export function DoctorPatientPrescribe({ patient, sessions = [], onToggleModule, onToggleLevel }: Props) {
  const [catalog, setCatalog] = useState<'normal' | 'pediatric'>('normal');
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);
  const [openModuleId, setOpenModuleId] = useState<TherapyModuleId | null>(null);
  const families = catalog === 'normal' ? GAME_FAMILIES : PEDIATRIC_GAME_FAMILIES;

  function selectCatalog(next: 'normal' | 'pediatric') {
    setCatalog(next);
    setOpenFamilyId(null);
    setOpenModuleId(null);
  }

  return (
    <div>
      <p className="mb-[13px] text-[13px] font-semibold text-gray-700">Prescribed modules</p>
      <div className="mx-auto mb-[21px] flex w-full max-w-[576px] rounded-[13px] bg-gray-200 p-[8px]">
        <button
          type="button"
          onClick={() => selectCatalog('normal')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-[8px] rounded-[8px] py-[13px] text-[13px] font-semibold ${
            catalog === 'normal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          Standard games
          <span
            className={`rounded-full px-[8px] py-[8px] text-[13px] ${
              catalog === 'normal' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {moduleCount(GAME_FAMILIES)}
          </span>
        </button>
        <button
          type="button"
          onClick={() => selectCatalog('pediatric')}
          className={`flex flex-1 cursor-pointer items-center justify-center gap-[8px] rounded-[8px] py-[13px] text-[13px] font-semibold ${
            catalog === 'pediatric' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
          }`}
        >
          Pediatric games
          <span
            className={`rounded-full px-[8px] py-[8px] text-[13px] ${
              catalog === 'pediatric' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {moduleCount(PEDIATRIC_GAME_FAMILIES)}
          </span>
        </button>
      </div>
      {families.length === 0 ? (
        <p className="text-[13px] text-gray-500">No pediatric games yet.</p>
      ) : (
      <div className="space-y-[13px]">
        {families.map((family) => {
          const familyOpen = openFamilyId === family.id;
          const prescribedInFamily = family.moduleIds.filter((id) =>
            patient.prescribedModuleIds.includes(id),
          ).length;

          const famSessions = sessions.filter((s) =>
            family.moduleIds.includes(s.gameId as TherapyModuleId),
          );
          const famCount = famSessions.length;
          const famAcc = famCount
            ? Math.round((famSessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / famCount) * 10) / 10
            : null;
          const famLast = famCount
            ? formatSessionDate(
                [...famSessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[famCount - 1]
                  .recordedAt,
              )
            : '—';
          const famDuration = famSessions.reduce((sum, s) => sum + (s.durationSec || 0), 0);

          return (
            <div key={family.id} className="overflow-hidden rounded-[13px] border border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setOpenFamilyId((current) => (current === family.id ? null : family.id));
                  setOpenModuleId(null);
                }}
                className="flex w-full cursor-pointer items-center justify-between gap-[13px] px-[13px] py-[13px] text-left hover:bg-gray-50"
              >
                <span>
                  <span className="block text-[13px] font-semibold text-gray-900">{family.title}</span>
                  <span className="mt-[8px] block text-[13px] text-gray-500">{family.body}</span>
                </span>
                <span className="flex shrink-0 items-center gap-[8px]">
                  <span
                    className="rounded-full px-[8px] py-[8px] text-[13px] font-semibold"
                    style={{ color: family.accent, backgroundColor: `${family.accent}14` }}
                  >
                    {prescribedInFamily}/{family.moduleIds.length}
                  </span>
                  <ChevronUpIcon
                    className={`w-4 h-4 text-gray-400 transition-transform ${familyOpen ? '' : 'rotate-180'}`}
                  />
                </span>
              </button>

              {familyOpen && (
                <div className="space-y-[13px] border-t border-gray-100 bg-gray-50/60 px-[13px] pb-[13px] pt-[13px]">
                  <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-4">
                    <div className="rounded-[13px] border border-gray-200/70 bg-white p-[13px]">
                      <p className="text-[13px] font-bold uppercase tracking-wider text-blue-600">Sessions</p>
                      <p className="mt-[8px] text-[21px] font-semibold leading-none text-gray-900">{famCount}</p>
                    </div>
                    <div className="rounded-[13px] border border-gray-200/70 bg-white p-[13px]">
                      <p className="text-[13px] font-bold uppercase tracking-wider text-emerald-600">Accuracy</p>
                      <p className="mt-[8px] text-[21px] font-semibold leading-none text-gray-900">{famAcc != null ? `${famAcc}%` : '—'}</p>
                    </div>
                    <div className="rounded-[13px] border border-gray-200/70 bg-white p-[13px]">
                      <p className="text-[13px] font-bold uppercase tracking-wider text-amber-600">Last played</p>
                      <p className="mt-[8px] truncate text-[21px] font-semibold leading-none text-gray-900">{famLast}</p>
                    </div>
                    <div className="rounded-[13px] border border-gray-200/70 bg-white p-[13px]">
                      <p className="text-[13px] font-bold uppercase tracking-wider text-violet-600">Time spent</p>
                      <p className="mt-[8px] text-[21px] font-semibold leading-none text-gray-900">{formatSessionDuration(famDuration)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 items-start gap-[13px] sm:grid-cols-2">
                    {family.moduleIds.map((moduleId) => {
                      const mod = GAME_CATALOG[moduleId];
                      const card = MODULE_CARDS.find(
                        (item) => item.uiId === CATALOG_TO_UI_MODULE[moduleId],
                      );
                      const on = patient.prescribedModuleIds.includes(mod.id);
                      const moduleOpen = openModuleId === mod.id;
                      const levels = MODULE_LEVELS[mod.id] || [];
                      const selectedLevels =
                        mod.id === 'direction_sense'
                          ? canonicalizeDirectionSenseLevels(
                              patient.prescribedLevels?.[mod.id] || [],
                            )
                          : patient.prescribedLevels?.[mod.id] || [];
                      const modSessions = sessions.filter((s) => s.gameId === mod.id);
                      const modCount = modSessions.length;
                      const modAcc = modCount
                        ? Math.round((modSessions.reduce((sum, s) => sum + (s.accuracy || 0), 0) / modCount) * 10) / 10
                        : null;
                      const modLast = modCount
                        ? formatSessionDate(
                            [...modSessions].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))[modCount - 1]
                              .recordedAt,
                          )
                        : '—';

                      return (
                        <div
                          key={mod.id}
                          className={`relative overflow-hidden rounded-[13px] border bg-white ${
                            moduleOpen
                              ? 'border-blue-400 ring-2 ring-blue-100'
                              : 'border-gray-100'
                          }`}
                        >
                          <div
                            className="absolute top-0 left-0 right-0 h-1.5"
                            style={{ backgroundColor: card?.bar || family.bar }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOpenModuleId((current) => (current === mod.id ? null : mod.id))
                            }
                            className="w-full cursor-pointer p-[13px] text-left hover:bg-gray-50"
                          >
                            <div className="flex items-start justify-between gap-[8px] pt-[8px]">
                              <div>
                                <span className="block text-[13px] font-semibold text-gray-900">
                                  {card?.title || mod.name}
                                </span>
                                <span className="mt-[8px] block text-[13px] leading-relaxed text-gray-500">
                                  {card?.body || mod.description}
                                </span>

                                <div className="mt-[13px] flex flex-wrap items-center gap-[8px]">
                                  <span className="rounded-[8px] bg-gray-100 px-[8px] py-[8px] text-[13px] font-semibold text-gray-600">
                                    Sessions {modCount}
                                  </span>
                                  <span className="rounded-[8px] bg-gray-100 px-[8px] py-[8px] text-[13px] font-semibold text-gray-600">
                                    Accuracy {modAcc != null ? `${modAcc}%` : '—'}
                                  </span>
                                  <span className="rounded-[8px] bg-gray-100 px-[8px] py-[8px] text-[13px] font-semibold text-gray-600">
                                    Last played {modLast}
                                  </span>
                                </div>
                              </div>
                              <span className="flex shrink-0 items-center gap-[8px]">
                                {on ? (
                                  <span className="rounded-full bg-emerald-50 px-[8px] py-[8px] text-[13px] font-semibold text-emerald-700">
                                    On
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-gray-100 px-[8px] py-[8px] text-[13px] font-semibold text-gray-500">
                                    Off
                                  </span>
                                )}
                                <ChevronUpIcon
                                  className={`w-4 h-4 text-gray-400 transition-transform ${moduleOpen ? '' : 'rotate-180'}`}
                                />
                              </span>
                            </div>
                          </button>

                          {moduleOpen && (
                            <div className="border-t border-gray-100 px-[13px] pb-[13px]">
                              <div className="flex items-center justify-end pt-[13px]">
                                <label className="flex cursor-pointer items-center gap-[8px]">
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={(e) => onToggleModule(mod.id, e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-[13px] font-semibold text-gray-700">Prescribe</span>
                                </label>
                              </div>
                              {levels.length > 0 ? (
                                <div className="mt-[13px] grid grid-cols-1 gap-[8px]">
                                  {levels.map((level) => {
                                    const levelOn = selectedLevels.includes(level.id);
                                    return (
                                      <label
                                        key={level.id}
                                        className={`flex items-center gap-[8px] rounded-[8px] border px-[13px] py-[13px] ${
                                          on
                                            ? 'cursor-pointer bg-gray-50 border-gray-200'
                                            : 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-100'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={on && levelOn}
                                          disabled={!on}
                                          onChange={(e) =>
                                            onToggleLevel(mod.id, level.id, e.target.checked)
                                          }
                                          className="h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-[13px] font-medium text-gray-700">
                                          {level.name}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="mt-[13px] text-[13px] text-gray-500">
                                  Turn prescribe on to assign this module. There are no extra levels.
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
