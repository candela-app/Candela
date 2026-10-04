'use client';

import { MODULE_CARDS } from '@/lib/shell';
import { ChevronUpIcon } from '@/components/icons/VectorIcons';
import {
  CATALOG_TO_UI_MODULE,
  GAME_CATALOG,
  GAME_FAMILIES,
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

export function DoctorPatientPrescribe({ patient, sessions = [], onToggleModule, onToggleLevel }: Props) {
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);
  const [openModuleId, setOpenModuleId] = useState<TherapyModuleId | null>(null);

  return (
    <div>
      <p className="text-sm font-semibold text-gray-700 mb-3">Prescribed modules</p>
      <div className="space-y-3">
        {GAME_FAMILIES.map((family) => {
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
            <div key={family.id} className="rounded-2xl border border-gray-100 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setOpenFamilyId((current) => (current === family.id ? null : family.id));
                  setOpenModuleId(null);
                }}
                className="w-full text-left px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50 cursor-pointer"
              >
                <span>
                  <span className="block text-sm font-bold text-gray-900">{family.title}</span>
                  <span className="block text-xs text-gray-500">{family.body}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
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
                <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-gray-50/60 space-y-3">
                  {/* FAMILY LEVEL KPI SUMMARY CARDS */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="rounded-xl border border-gray-200/70 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Sessions</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-0.5">{famCount}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200/70 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Accuracy</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-0.5">{famAcc != null ? `${famAcc}%` : '—'}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200/70 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Last played</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-0.5 truncate">{famLast}</p>
                    </div>
                    <div className="rounded-xl border border-gray-200/70 bg-white p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">Time spent</p>
                      <p className="text-lg font-extrabold text-gray-900 mt-0.5">{formatSessionDuration(famDuration)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
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
                          className={`relative overflow-hidden rounded-2xl bg-white border ${
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
                            className="w-full text-left p-4 hover:bg-gray-50 cursor-pointer"
                          >
                            <div className="pt-1 flex items-start justify-between gap-2">
                              <div>
                                <span className="block font-bold text-gray-900">
                                  {card?.title || mod.name}
                                </span>
                                <span className="block text-xs text-gray-500 mt-1 leading-relaxed">
                                  {card?.body || mod.description}
                                </span>

                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-600">
                                    Sessions {modCount}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-600">
                                    Accuracy {modAcc != null ? `${modAcc}%` : '—'}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-600">
                                    Last played {modLast}
                                  </span>
                                </div>
                              </div>
                              <span className="flex items-center gap-2 shrink-0">
                                {on ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">
                                    On
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500">
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
                            <div className="px-4 pb-4 border-t border-gray-100">
                              <div className="flex items-center justify-end pt-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={(e) => onToggleModule(mod.id, e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <span className="text-sm font-semibold text-gray-700">Prescribe</span>
                                </label>
                              </div>
                              {levels.length > 0 ? (
                                <div className="mt-3 grid grid-cols-1 gap-2">
                                  {levels.map((level) => {
                                    const levelOn = selectedLevels.includes(level.id);
                                    return (
                                      <label
                                        key={level.id}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
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
                                        <span className="text-sm font-medium text-gray-700">
                                          {level.name}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-500 mt-3">
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
    </div>
  );
}
