'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  NO_ACTIVITIES_ASSIGNED_LABEL,
  NO_SESSION_SAVED_LABEL,
  TRUNCATED_HISTORY_NOTE,
  analyticsQueryRange,
  assignmentLevelName,
  formatReportSeconds,
  familyForModuleId,
  groupByGameFamily,
  groupFamilyItemsByModule,
  insightPresetRange,
  isTherapyFamilyId,
  isTherapyModuleId,
  resolvedTimeZone,
  GAME_CATALOG,
  type DoctorPrescriptionAnalytics,
  type FamilyGroup,
  type InsightPreset,
  type PatientPrescriptionPeriod,
  type PatientPrescriptionPractice,
  type PeriodActivity,
  type PrescriptionPeriod,
  type TherapyFamilyId,
} from '@candela/shared';
import { ChevronDownIcon } from '@/components/icons/VectorIcons';
import { Skeleton } from '@/components/common/Skeleton';
import { getMyPrescriptionPractice, getPatientPrescriptionAnalytics } from '@/lib/api';

const CARD = 'rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';
const CHEVRON =
  'mt-[8px] size-4 shrink-0 text-gray-500 transition-transform duration-300 ease-out motion-reduce:transition-none';

function SkeletonBar({ className = '' }: { className?: string }) {
  return <Skeleton className={`rounded-[13px] ${className}`} />;
}

function ActivitiesHistorySkeleton() {
  return (
    <div className="space-y-[21px]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading activities history</span>
      <div className="flex flex-wrap gap-[8px]">
        <SkeletonBar className="h-[37px] w-[110px]" />
        <SkeletonBar className="h-[37px] w-[96px]" />
        <SkeletonBar className="h-[37px] w-[110px]" />
        <SkeletonBar className="h-[37px] w-[120px]" />
        <SkeletonBar className="h-[37px] w-[88px]" />
      </div>
      {[0, 1, 2].map((index) => (
        <div key={index} className="overflow-hidden rounded-[13px] border border-gray-200">
          <div className="flex items-start gap-[13px] px-[13px] py-[13px]">
            <SkeletonBar className="mt-[6px] h-[34px] w-[5px] rounded-full" />
            <div className="min-w-0 flex-1 space-y-[8px]">
              <SkeletonBar className="h-[21px] w-[140px]" />
              <SkeletonBar className="h-[13px] w-[220px]" />
              <SkeletonBar className="h-[13px] w-[88px]" />
            </div>
            <SkeletonBar className="mt-[8px] size-4 rounded-full" />
          </div>
          {index === 0 ? (
            <div className="space-y-[13px] border-t border-gray-100 p-[13px]">
              <SkeletonBar className="h-[13px] w-[120px]" />
              <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                <SkeletonBar className="h-[89px] w-full" />
                <SkeletonBar className="h-[89px] w-full" />
              </div>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

type RangeChoice = InsightPreset | 'custom';
type DoctorPractice = DoctorPrescriptionAnalytics & { period?: PrescriptionPeriod };
type PatientPractice = PatientPrescriptionPractice & { period?: PatientPrescriptionPeriod };
type PatientActivity = PatientPrescriptionPractice['activities'][number];
type PatientModuleWithoutLevels = PatientPrescriptionPractice['modulesWithoutLevels'][number];
type FamilyFilter = 'all' | TherapyFamilyId | 'other';

function parseRangeChoice(raw: string | null): RangeChoice {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'custom') return raw;
  return '30d';
}

function parseFamilyFilter(raw: string | null): FamilyFilter {
  if (!raw || raw === 'all') return 'all';
  if (raw === 'other') return 'other';
  if (isTherapyFamilyId(raw)) return raw;
  return 'all';
}

function isDayKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function moduleLabel(moduleId: string): string {
  return isTherapyModuleId(moduleId) ? GAME_CATALOG[moduleId].name : moduleId;
}

function formatWhen(iso: string | null, timeZone: string): string {
  if (!iso) return 'No date recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No date recorded';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone });
}

function performanceLine(activity: {
  performanceLabel: string | null;
  performanceValue: number | null;
  sessionCount: number;
}): string | null {
  if (activity.sessionCount === 0) return null;
  if (activity.performanceLabel == null || activity.performanceValue == null) return 'Performance not available';
  return `${activity.performanceLabel} ${activity.performanceValue}%`;
}

function filterFamilyGroups<T>(groups: FamilyGroup<T>[], filter: FamilyFilter): FamilyGroup<T>[] {
  if (filter === 'all') return groups;
  if (filter === 'other') return groups.filter((group) => group.familyId == null);
  return groups.filter((group) => group.familyId === filter);
}

function ActivityCard({
  activity,
  timeZone,
  showPerformance,
}: {
  activity: PeriodActivity | PatientActivity;
  timeZone: string;
  showPerformance: boolean;
}) {
  const periodActivity = 'daily' in activity ? (activity as PeriodActivity) : null;
  const performance = showPerformance && periodActivity ? performanceLine(periodActivity) : null;
  const reaction =
    showPerformance && periodActivity?.reactionLabel && periodActivity.reactionMeanSec != null
      ? `${periodActivity.reactionLabel} ${formatReportSeconds(periodActivity.reactionMeanSec)}`
      : null;
  const sessionLine =
    activity.availability === 'none_saved'
      ? NO_SESSION_SAVED_LABEL
      : showPerformance && periodActivity
        ? `${activity.sessionCount} saved · latest ${formatWhen(activity.lastRecordedAt, timeZone)}`
        : `${activity.sessionCount} saved`;

  return (
    <div className="rounded-[13px] border border-gray-200 px-[13px] py-[13px]">
      <p className="text-[13px] font-semibold text-gray-900">{activity.levelName}</p>
      <p className="mt-[4px] text-[13px] text-gray-600">{sessionLine}</p>
      {!showPerformance && activity.lastRecordedAt ? (
        <p className="mt-[4px] text-[13px] text-gray-500">Latest {formatWhen(activity.lastRecordedAt, timeZone)}</p>
      ) : null}
      {performance ? <p className="mt-[4px] text-[13px] text-gray-600">{performance}</p> : null}
      {reaction ? <p className="mt-[4px] text-[13px] text-gray-600">{reaction}</p> : null}
      {periodActivity?.daily.map((day) => (
        <p key={day.date} className="mt-[4px] text-[13px] text-gray-500">
          {day.date}: {day.sessionCount} saved
          {day.performance == null ? ' · Performance not available' : ` · ${day.performance}%`}
        </p>
      ))}
    </div>
  );
}

function familyKey(group: FamilyGroup<unknown>): string {
  return group.familyId ?? 'other';
}

function FamilyBoard<T extends { moduleId: string; moduleName: string }>({
  groups,
  filter,
  onFilterChange,
  renderItem,
  emptyLabel,
}: {
  groups: FamilyGroup<T>[];
  filter: FamilyFilter;
  onFilterChange: (next: FamilyFilter) => void;
  renderItem: (item: T) => ReactNode;
  emptyLabel?: string | null;
}) {
  const visible = filterFamilyGroups(groups, filter);
  const visibleKey = visible.map(familyKey).join('|');
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    setOpenKeys([]);
  }, [filter, visibleKey]);

  function toggleFamily(key: string) {
    setOpenKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  }

  if (groups.length === 0) {
    return emptyLabel ? <p className="text-[13px] text-gray-500">{emptyLabel}</p> : null;
  }

  return (
    <div className="space-y-[21px]">
      <div className="flex flex-wrap gap-[8px]">
        <button
          type="button"
          onClick={() => onFilterChange('all')}
          className={`rounded-[13px] border px-[13px] py-[8px] text-[13px] font-semibold ${
            filter === 'all' ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-900'
          }`}
        >
          All families
        </button>
        {groups.map((group) => {
          const id: FamilyFilter = group.familyId ?? 'other';
          const selected = filter === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onFilterChange(id)}
              className={`rounded-[13px] border px-[13px] py-[8px] text-[13px] font-semibold ${
                selected ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-gray-900'
              }`}
            >
              {group.title}
              <span className="ml-[8px] tabular-nums text-[11px] opacity-70">{group.items.length}</span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? <p className="text-[13px] text-gray-500">No activities in this family.</p> : null}

      {visible.map((group) => {
        const key = familyKey(group);
        const open = openKeys.includes(key);
        const modules = groupFamilyItemsByModule(group.items);
        const accent = group.bar ?? group.accent ?? '#9CA3AF';
        const panelId = `family-panel-${key}`;
        return (
          <section
            key={key}
            className="overflow-hidden rounded-[13px] border border-gray-200 bg-white"
          >
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggleFamily(key)}
                className="flex w-full cursor-pointer items-start gap-[13px] px-[13px] py-[13px] text-left hover:bg-gray-50"
              >
                <span className="mt-[6px] h-[34px] w-[5px] shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-gray-900">{group.title}</span>
                  {group.body ? (
                    <span className="mt-[4px] block text-[13px] leading-[21px] font-normal text-gray-500">{group.body}</span>
                  ) : null}
                  <span className="mt-[4px] block text-[13px] font-semibold tabular-nums text-gray-500">
                    {group.items.length} {group.items.length === 1 ? 'level' : 'levels'}
                  </span>
                </span>
                <ChevronDownIcon className={`${CHEVRON} ${open ? 'rotate-180' : 'rotate-0'}`} />
              </button>
            </h3>
            {open ? (
              <div id={panelId} className="space-y-[21px] border-t border-gray-100 p-[13px]">
                {modules.map((module) => (
                  <div key={module.moduleId} className="space-y-[8px]">
                    <p className="text-[13px] font-semibold text-gray-700">{module.moduleName}</p>
                    <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">{module.items.map(renderItem)}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function NoteFamilyBoard<T extends { moduleId: string }>({
  title,
  items,
  renderItem,
}: {
  title: string;
  items: readonly T[];
  renderItem: (item: T) => ReactNode;
}) {
  const groups = groupByGameFamily(items);
  const groupsKey = groups.map(familyKey).join('|');
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    setOpenKeys([]);
  }, [groupsKey]);

  if (groups.length === 0) return null;

  return (
    <section className="space-y-[13px]">
      <h3 className="text-[13px] font-semibold text-gray-900">{title}</h3>
      {groups.map((group) => {
        const key = familyKey(group);
        const open = openKeys.includes(key);
        const panelId = `note-family-panel-${title}-${key}`.replace(/\s+/g, '-').toLowerCase();
        return (
          <div key={key} className="overflow-hidden rounded-[13px] border border-gray-200">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() =>
                setOpenKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
              }
              className="flex w-full cursor-pointer items-center justify-between gap-[13px] px-[13px] py-[13px] text-left hover:bg-gray-50"
            >
              <span className="text-[13px] font-semibold text-gray-700">
                {group.title}
                <span className="ml-[8px] tabular-nums text-gray-500">{group.items.length}</span>
              </span>
              <ChevronDownIcon className={`size-4 shrink-0 text-gray-500 transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? 'rotate-180' : 'rotate-0'}`} />
            </button>
            {open ? (
              <div id={panelId} className="space-y-[8px] border-t border-gray-100 px-[13px] py-[13px]">
                {group.items.map(renderItem)}
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

export function PrescriptionPractice({
  audience,
  patientId,
}: {
  audience: 'patient' | 'doctor';
  patientId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const rangeParam = searchParams.get('range');
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');
  const familyParam = searchParams.get('family');

  const [choice, setChoice] = useState<RangeChoice>(() => parseRangeChoice(rangeParam));
  const [draftFrom, setDraftFrom] = useState(() => (fromParam && isDayKey(fromParam) ? fromParam : ''));
  const [draftTo, setDraftTo] = useState(() => (toParam && isDayKey(toParam) ? toParam : ''));
  const [appliedFrom, setAppliedFrom] = useState(() => (fromParam && isDayKey(fromParam) ? fromParam : ''));
  const [appliedTo, setAppliedTo] = useState(() => (toParam && isDayKey(toParam) ? toParam : ''));
  const [patientPractice, setPatientPractice] = useState<PatientPractice | null>(null);
  const [doctorAnalytics, setDoctorAnalytics] = useState<DoctorPractice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [familyFilter, setFamilyFilter] = useState<FamilyFilter>(() => parseFamilyFilter(familyParam));
  const [doctorFamilyFilter, setDoctorFamilyFilter] = useState<FamilyFilter>(() => parseFamilyFilter(familyParam));
  const [previousFamilyFilter, setPreviousFamilyFilter] = useState<FamilyFilter>('all');
  const requestId = useRef(0);

  const range = useMemo(() => {
    if (choice === 'custom') {
      if (!isDayKey(appliedFrom) || !isDayKey(appliedTo)) return null;
      return appliedFrom <= appliedTo
        ? { from: appliedFrom, to: appliedTo }
        : { from: appliedTo, to: appliedFrom };
    }
    return insightPresetRange(choice, new Date().toISOString(), timeZone);
  }, [choice, appliedFrom, appliedTo, timeZone]);

  const draftReady = isDayKey(draftFrom) && isDayKey(draftTo);

  function writeFilterParams(next: {
    range: RangeChoice;
    from?: string;
    to?: string;
    family: FamilyFilter;
  }) {
    const params = new URLSearchParams(searchParams.toString());
    if (audience === 'patient') params.set('page', 'activities');
    params.set('range', next.range);
    if (next.range === 'custom' && next.from && next.to) {
      params.set('from', next.from);
      params.set('to', next.to);
    } else {
      params.delete('from');
      params.delete('to');
    }
    if (next.family === 'all') params.delete('family');
    else params.set('family', next.family);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function selectRange(next: RangeChoice) {
    if (next === 'custom') {
      const preset = insightPresetRange(
        choice === 'custom' ? '30d' : choice,
        new Date().toISOString(),
        timeZone,
      );
      const from = appliedFrom || draftFrom || preset.from;
      const to = appliedTo || draftTo || preset.to;
      setDraftFrom(from);
      setDraftTo(to);
      setAppliedFrom(from);
      setAppliedTo(to);
      setChoice('custom');
      writeFilterParams({
        range: 'custom',
        from,
        to,
        family: audience === 'doctor' ? doctorFamilyFilter : familyFilter,
      });
      return;
    }
    setChoice(next);
    writeFilterParams({
      range: next,
      family: audience === 'doctor' ? doctorFamilyFilter : familyFilter,
    });
  }

  function applyCustomRange() {
    if (!draftReady) return;
    const from = draftFrom <= draftTo ? draftFrom : draftTo;
    const to = draftFrom <= draftTo ? draftTo : draftFrom;
    setDraftFrom(from);
    setDraftTo(to);
    setAppliedFrom(from);
    setAppliedTo(to);
    setChoice('custom');
    writeFilterParams({
      range: 'custom',
      from,
      to,
      family: audience === 'doctor' ? doctorFamilyFilter : familyFilter,
    });
  }

  function setActiveFamilyFilter(next: FamilyFilter) {
    if (audience === 'doctor') setDoctorFamilyFilter(next);
    else setFamilyFilter(next);
    writeFilterParams({
      range: choice,
      from: choice === 'custom' ? appliedFrom : undefined,
      to: choice === 'custom' ? appliedTo : undefined,
      family: next,
    });
  }

  useEffect(() => {
    const nextChoice = parseRangeChoice(rangeParam);
    const nextFrom = fromParam && isDayKey(fromParam) ? fromParam : '';
    const nextTo = toParam && isDayKey(toParam) ? toParam : '';
    const nextFamily = parseFamilyFilter(familyParam);
    setChoice(nextChoice);
    if (nextChoice === 'custom') {
      setDraftFrom(nextFrom);
      setDraftTo(nextTo);
      setAppliedFrom(nextFrom);
      setAppliedTo(nextTo);
    }
    setFamilyFilter(nextFamily);
    setDoctorFamilyFilter(nextFamily);
  }, [rangeParam, fromParam, toParam, familyParam]);

  useEffect(() => {
    if ((audience === 'doctor' && !patientId) || !range) {
      requestId.current += 1;
      setPatientPractice(null);
      setDoctorAnalytics(null);
      setLoading(false);
      setError('');
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    setPatientPractice(null);
    setDoctorAnalytics(null);
    const query = { ...analyticsQueryRange(range.from, range.to, timeZone), timeZone };
    const request =
      audience === 'doctor' && patientId
        ? getPatientPrescriptionAnalytics(patientId, query)
        : getMyPrescriptionPractice(query);
    request
      .then((result) => {
        if (id !== requestId.current) return;
        if (audience === 'doctor') setDoctorAnalytics(result as DoctorPractice);
        else setPatientPractice(result as PatientPractice);
      })
      .catch((err: unknown) => {
        if (id !== requestId.current) return;
        setPatientPractice(null);
        setDoctorAnalytics(null);
        setError(err instanceof Error ? err.message : 'Could not load assigned activities');
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [audience, patientId, range, timeZone]);

  const period = doctorAnalytics?.period;
  const patientPeriod = patientPractice?.period;
  const current = period?.activities.filter((activity) => activity.status === 'current') ?? [];
  const previous = period?.activities.filter((activity) => activity.status === 'no_longer_prescribed') ?? [];
  const patientGroups = useMemo(
    () => groupByGameFamily(patientPeriod?.activities ?? []),
    [patientPeriod?.activities],
  );
  const currentGroups = useMemo(() => groupByGameFamily(current), [current]);
  const previousGroups = useMemo(() => groupByGameFamily(previous), [previous]);
  const modulesWithoutLevelsGroups = useMemo(
    () =>
      groupByGameFamily([
        ...(patientPeriod?.modulesWithoutLevels ?? []),
        ...(period?.modulesWithoutLevels ?? []),
      ] as Array<PatientModuleWithoutLevels | { moduleId: string; moduleName: string; label: string }>),
    [patientPeriod?.modulesWithoutLevels, period?.modulesWithoutLevels],
  );

  return (
    <section className={`${CARD} space-y-[13px]`}>
      <div className="flex flex-wrap items-center justify-between gap-[13px]">
        <h2 className="text-[21px] font-semibold text-gray-900">Activities history</h2>
        <div className="flex flex-wrap gap-[8px]">
          {(
            [
              ['7d', '7 days'],
              ['30d', '30 days'],
              ['90d', '90 days'],
              ['custom', 'Custom'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => selectRange(id)}
              className={`rounded-[13px] border px-[13px] py-[8px] text-[13px] font-semibold ${
                choice === id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {choice === 'custom' ? (
        <div className="flex flex-wrap items-end gap-[13px]">
          <label className="flex flex-col gap-[8px] text-[13px] font-semibold text-gray-500">
            From
            <input
              type="date"
              value={draftFrom}
              onChange={(event) => setDraftFrom(event.target.value)}
              className="rounded-[13px] border border-gray-200 px-[13px] py-[8px] text-gray-900"
            />
          </label>
          <label className="flex flex-col gap-[8px] text-[13px] font-semibold text-gray-500">
            To
            <input
              type="date"
              value={draftTo}
              onChange={(event) => setDraftTo(event.target.value)}
              className="rounded-[13px] border border-gray-200 px-[13px] py-[8px] text-gray-900"
            />
          </label>
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!draftReady}
            className="rounded-[13px] border border-blue-600 bg-blue-600 px-[13px] py-[8px] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500"
          >
            Apply
          </button>
        </div>
      ) : null}
      {loading ? <ActivitiesHistorySkeleton /> : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}

      {patientPeriod ? (
        <div className="space-y-[21px]">
          {patientPeriod.emptyLabel ? (
            <p className="text-[13px] leading-[21px] text-gray-500">{patientPeriod.emptyLabel}</p>
          ) : null}
          {modulesWithoutLevelsGroups.length > 0 ? (
            <NoteFamilyBoard
              title="Modules without specific levels"
              items={patientPeriod.modulesWithoutLevels}
              renderItem={(module) => (
                <p key={module.moduleId} className="text-[13px] leading-[21px] text-gray-600">
                  {module.moduleName}: {module.label}
                </p>
              )}
            />
          ) : null}
          <FamilyBoard
            groups={patientGroups}
            filter={familyFilter}
            onFilterChange={setActiveFamilyFilter}
            emptyLabel={
              patientPeriod.activities.length === 0 && !patientPeriod.emptyLabel
                ? NO_ACTIVITIES_ASSIGNED_LABEL
                : null
            }
            renderItem={(activity) => (
              <ActivityCard
                key={`${activity.moduleId}-${activity.levelId}`}
                activity={activity}
                timeZone={timeZone}
                showPerformance={false}
              />
            )}
          />
          {patientPeriod.truncated ? (
            <p className="text-[13px] leading-[21px] text-gray-600">{TRUNCATED_HISTORY_NOTE}</p>
          ) : null}
        </div>
      ) : null}

      {period ? (
        <div className="space-y-[21px]">
          {period.modulesWithoutLevels.length > 0 ? (
            <NoteFamilyBoard
              title="Modules without specific levels"
              items={period.modulesWithoutLevels}
              renderItem={(module) => (
                <p key={module.moduleId} className="text-[13px] leading-[21px] text-gray-600">
                  {module.moduleName}: {module.label}
                </p>
              )}
            />
          ) : null}

          <div className="space-y-[13px]">
            <h3 className="text-[13px] font-semibold text-gray-900">Current assignment</h3>
            <FamilyBoard
              groups={currentGroups}
              filter={doctorFamilyFilter}
              onFilterChange={setActiveFamilyFilter}
              emptyLabel={NO_ACTIVITIES_ASSIGNED_LABEL}
              renderItem={(activity) => (
                <ActivityCard
                  key={`${activity.moduleId}-${activity.levelId}`}
                  activity={activity}
                  timeZone={timeZone}
                  showPerformance
                />
              )}
            />
          </div>

          {previous.length > 0 ? (
            <div className="space-y-[13px]">
              <h3 className="text-[13px] font-semibold text-gray-900">No longer prescribed</h3>
              <FamilyBoard
                groups={previousGroups}
                filter={previousFamilyFilter}
                onFilterChange={setPreviousFamilyFilter}
                renderItem={(activity) => (
                  <ActivityCard
                    key={`${activity.moduleId}-${activity.levelId}`}
                    activity={activity}
                    timeZone={timeZone}
                    showPerformance
                  />
                )}
              />
            </div>
          ) : null}

          {period.truncated ? (
            <p className="text-[13px] leading-[21px] text-gray-600">{TRUNCATED_HISTORY_NOTE}</p>
          ) : null}

          <section className="space-y-[8px]">
            <h3 className="text-[13px] font-semibold text-gray-900">Assignment history</h3>
            {doctorAnalytics?.revisions.length === 0 ? (
              <p className="text-[13px] text-gray-500">No assignment history</p>
            ) : null}
            {doctorAnalytics?.revisions.map((revision) => (
              <div key={revision.id} className="text-[13px] leading-[21px] text-gray-600">
                <p>
                  {formatWhen(revision.effectiveFrom, timeZone)}
                  {revision.effectiveTo ? ` to ${formatWhen(revision.effectiveTo, timeZone)}` : ' onward'} ·{' '}
                  {revision.actorLabel}
                </p>
                <p>
                  {revision.assignments.length === 0
                    ? NO_ACTIVITIES_ASSIGNED_LABEL
                    : revision.assignments
                        .map((assignment) => {
                          const familyTitle = familyForModuleId(assignment.moduleId)?.title ?? 'Other';
                          return assignment.levels.length === 0
                            ? `${familyTitle} · ${moduleLabel(assignment.moduleId)}: no specific levels assigned`
                            : `${familyTitle} · ${moduleLabel(assignment.moduleId)}: ${assignment.levels
                                .map((levelId) => assignmentLevelName(assignment.moduleId, levelId))
                                .join(', ')}`;
                        })
                        .join(' · ')}
                </p>
              </div>
            ))}
          </section>

          {period.recordedButNotAssigned.length > 0 ? (
            <NoteFamilyBoard
              title="Recorded but not assigned"
              items={period.recordedButNotAssigned.map((session) => ({
                ...session,
                moduleId: session.gameId,
                moduleName: moduleLabel(session.gameId),
              }))}
              renderItem={(session) => (
                <p key={session.id} className="text-[13px] leading-[21px] text-gray-600">
                  {session.levelName} · {formatWhen(session.recordedAt, timeZone)} · {session.label}
                  {session.note ? ` ${session.note}` : ''}
                </p>
              )}
            />
          ) : null}

          {period.unattributed.length > 0 ? (
            <NoteFamilyBoard
              title="Sessions not linked to an assignment"
              items={period.unattributed.map((session) => ({
                ...session,
                moduleId: session.gameId,
                moduleName: moduleLabel(session.gameId),
              }))}
              renderItem={(session) => (
                <p key={session.id} className="text-[13px] leading-[21px] text-gray-600">
                  {session.levelName} · {formatWhen(session.recordedAt, timeZone)} · {session.label}
                </p>
              )}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
