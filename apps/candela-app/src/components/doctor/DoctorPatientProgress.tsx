'use client';

import { MODULE_CARDS } from '@/lib/shell';
import { ArrowLeftIcon } from '@/components/icons/VectorIcons';
import {
  CATALOG_TO_UI_MODULE,
  GAME_CATALOG,
  GAME_FAMILIES,
  MODULE_LEVELS,
  canonicalizeDirectionSenseLevels,
  getGameFamily,
  type PatientSummary,
  type TherapyModuleId,
} from '@candela/shared';

function EmptyStats() {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-500">Last played —</span>
      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-500">Accuracy —</span>
      <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-500">Sessions 0</span>
    </div>
  );
}

function cardFor(moduleId: TherapyModuleId) {
  return MODULE_CARDS.find((item) => item.uiId === CATALOG_TO_UI_MODULE[moduleId]);
}

function prescribedLevelsFor(patient: PatientSummary, moduleId: TherapyModuleId): string[] {
  const raw = patient.prescribedLevels?.[moduleId] || [];
  return moduleId === 'direction_sense' ? canonicalizeDirectionSenseLevels(raw) : raw;
}

type Props = {
  patient: PatientSummary;
  familyId: string | null;
  moduleId: TherapyModuleId | null;
  onSelectFamily: (id: string | null) => void;
  onSelectModule: (id: TherapyModuleId | null) => void;
};

export function DoctorPatientProgress({
  patient,
  familyId,
  moduleId,
  onSelectFamily,
  onSelectModule,
}: Props) {
  const family = getGameFamily(familyId);
  const moduleEntry = moduleId ? GAME_CATALOG[moduleId] : null;
  const card = moduleId ? cardFor(moduleId) : undefined;
  const levels = moduleId ? MODULE_LEVELS[moduleId] || [] : [];
  const assignedLevels = moduleId ? prescribedLevelsFor(patient, moduleId) : [];
  const moduleOn = moduleId ? patient.prescribedModuleIds.includes(moduleId) : false;

  return (
    <div>
      {family && (
        <button
          type="button"
          onClick={() => {
            if (moduleId) {
              onSelectModule(null);
            } else {
              onSelectFamily(null);
            }
          }}
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          {moduleId ? family.title : 'All families'}
        </button>
      )}

      {!family && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {GAME_FAMILIES.map((item) => {
            const prescribedCount = item.moduleIds.filter((id) =>
              patient.prescribedModuleIds.includes(id),
            ).length;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectFamily(item.id);
                  onSelectModule(null);
                }}
                className="relative overflow-hidden min-h-[140px] w-full rounded-2xl bg-white text-left flex flex-col justify-between p-4 border border-gray-100 hover:border-blue-200 cursor-pointer transition-colors"
              >
                <div className="absolute top-0 left-0 right-0 h-1.5" style={{ backgroundColor: item.bar }} />
                <div className="pt-1">
                  <h3 className="m-0 text-sm font-bold text-gray-900">{item.title}</h3>
                  <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">{item.body}</p>
                </div>
                <span
                  className="self-start mt-3 px-2 py-0.5 rounded-full text-[10px] font-bold"
                  style={{ color: item.accent, backgroundColor: `${item.accent}14` }}
                >
                  {prescribedCount}/{item.moduleIds.length} prescribed
                </span>
              </button>
            );
          })}
        </div>
      )}

      {family && !moduleId && (
        <div>
          <h3 className="text-sm font-bold text-gray-900">{family.title}</h3>
          <p className="text-xs text-gray-500 mb-3">{family.body}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {family.moduleIds.map((id) => {
              const item = cardFor(id);
              const on = patient.prescribedModuleIds.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelectModule(id)}
                  className="relative overflow-hidden min-h-[140px] w-full rounded-2xl bg-white text-left flex flex-col justify-between p-4 border border-gray-100 hover:border-blue-200 cursor-pointer transition-colors"
                >
                  <div
                    className="absolute top-0 left-0 right-0 h-1.5"
                    style={{ backgroundColor: item?.bar || family.bar }}
                  />
                  <div className="pt-1">
                    <h3 className="m-0 text-sm font-bold text-gray-900">{item?.title || GAME_CATALOG[id].name}</h3>
                    <p className="text-xs text-gray-500 mt-1.5 font-medium leading-relaxed">
                      {item?.body || GAME_CATALOG[id].description}
                    </p>
                    <EmptyStats />
                  </div>
                  <span
                    className={`self-start mt-3 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      on ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {on ? 'Prescribed' : 'Not prescribed'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {family && moduleEntry && moduleId && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: family.accent }}>
            {family.title}
          </p>
          <h3 className="text-sm font-bold text-gray-900">{card?.title || moduleEntry.name}</h3>
          <p className="text-xs text-gray-500 mb-3">{card?.body || moduleEntry.description}</p>
          {!moduleOn && (
            <p className="text-xs font-semibold text-amber-700 mb-3">This activity is not prescribed.</p>
          )}
          {levels.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-800">No extra levels</p>
              <EmptyStats />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {levels.map((level) => {
                const assigned = moduleOn && assignedLevels.includes(level.id);
                return (
                  <div
                    key={level.id}
                    className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-800">{level.name}</p>
                      <span
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          assigned ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {assigned ? 'Assigned' : 'Not assigned'}
                      </span>
                    </div>
                    <EmptyStats />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
