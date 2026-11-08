'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NO_ACTIVITIES_ASSIGNED_LABEL,
  NO_SESSION_SAVED_LABEL,
  TRUNCATED_HISTORY_NOTE,
  analyticsQueryRange,
  assignmentLevelName,
  formatReportSeconds,
  insightPresetRange,
  isTherapyModuleId,
  resolvedTimeZone,
  GAME_CATALOG,
  type DoctorPrescriptionAnalytics,
  type InsightPreset,
  type PatientPrescriptionPeriod,
  type PatientPrescriptionPractice,
  type PeriodActivity,
  type PrescriptionPeriod,
} from '@candela/shared';
import { getMyPrescriptionPractice, getPatientPrescriptionAnalytics } from '@/lib/api';

const CARD = 'rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';

type RangeChoice = InsightPreset | 'custom';
type DoctorPractice = DoctorPrescriptionAnalytics & { period?: PrescriptionPeriod };
type PatientPractice = PatientPrescriptionPractice & { period?: PatientPrescriptionPeriod };

function moduleLabel(moduleId: string): string {
  return isTherapyModuleId(moduleId) ? GAME_CATALOG[moduleId].name : moduleId;
}

function formatWhen(iso: string | null, timeZone: string): string {
  if (!iso) return 'No date recorded';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'No date recorded';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone });
}

function performanceLine(activity: { performanceLabel: string | null; performanceValue: number | null; sessionCount: number }): string | null {
  if (activity.sessionCount === 0) return null;
  if (activity.performanceLabel == null || activity.performanceValue == null) return 'Performance not available';
  return `${activity.performanceLabel} ${activity.performanceValue}%`;
}

function ActivityCard({ activity, timeZone, showPerformance }: { activity: PeriodActivity; timeZone: string; showPerformance: boolean }) {
  const performance = showPerformance ? performanceLine(activity) : null;
  const reaction =
    showPerformance && activity.reactionLabel && activity.reactionMeanSec != null
      ? `${activity.reactionLabel} ${formatReportSeconds(activity.reactionMeanSec)}`
      : null;
  return (
    <div className="rounded-[13px] border border-gray-200 px-[13px] py-[13px]">
      <p className="text-[13px] font-semibold text-gray-900">{activity.moduleName}</p>
      <p className="mt-[4px] text-[13px] text-gray-500">{activity.levelName}</p>
      <p className="mt-[4px] text-[13px] text-gray-600">
        {activity.availability === 'none_saved'
          ? NO_SESSION_SAVED_LABEL
          : `${activity.sessionCount} saved · latest ${formatWhen(activity.lastRecordedAt, timeZone)}`}
      </p>
      {performance ? <p className="mt-[4px] text-[13px] text-gray-600">{performance}</p> : null}
      {reaction ? <p className="mt-[4px] text-[13px] text-gray-600">{reaction}</p> : null}
      {activity.daily.map((day) => (
        <p key={day.date} className="mt-[4px] text-[13px] text-gray-500">
          {day.date}: {day.sessionCount} saved
          {day.performance == null ? ' · Performance not available' : ` · ${day.performance}%`}
        </p>
      ))}
    </div>
  );
}

export function PrescriptionPractice({
  audience,
  patientId,
}: {
  audience: 'patient' | 'doctor';
  patientId?: string;
}) {
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const [choice, setChoice] = useState<RangeChoice>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [patientPractice, setPatientPractice] = useState<PatientPractice | null>(null);
  const [doctorAnalytics, setDoctorAnalytics] = useState<DoctorPractice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const range = useMemo(() => {
    if (choice === 'custom') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo)) return null;
      return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
    }
    return insightPresetRange(choice, new Date().toISOString(), timeZone);
  }, [choice, customFrom, customTo, timeZone]);

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

  return (
    <section className={`${CARD} space-y-[13px]`}>
      <div>
        <h2 className="text-[21px] font-semibold text-gray-900">Assigned activities</h2>
        <p className="mt-[8px] text-[13px] leading-[21px] text-gray-500">
          Saved sessions in this date range that match an assigned level. The practice record counts every saved session.
          A missing session is not a missed activity.
        </p>
      </div>
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
            onClick={() => setChoice(id)}
            className={`rounded-[13px] border px-[13px] py-[8px] text-[13px] font-semibold ${
              choice === id ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-200 bg-white text-gray-900'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {choice === 'custom' ? (
        <div className="flex flex-wrap gap-[13px]">
          <label className="flex flex-col gap-[8px] text-[13px] font-semibold text-gray-500">
            From
            <input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} className="rounded-[13px] border border-gray-200 px-[13px] py-[8px] text-gray-900" />
          </label>
          <label className="flex flex-col gap-[8px] text-[13px] font-semibold text-gray-500">
            To
            <input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} className="rounded-[13px] border border-gray-200 px-[13px] py-[8px] text-gray-900" />
          </label>
        </div>
      ) : null}
      {loading ? <p className="text-[13px] text-gray-500">Loading assigned activities…</p> : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {patientPeriod ? (
        <div className="space-y-[13px]">
          {patientPeriod.emptyLabel ? <p className="text-[13px] leading-[21px] text-gray-500">{patientPeriod.emptyLabel}</p> : null}
          {patientPeriod.modulesWithoutLevels.map((module) => (
            <p key={module.moduleName} className="text-[13px] leading-[21px] text-gray-600">
              {module.moduleName}: {module.label}
            </p>
          ))}
          {patientPeriod.activities.map((activity) => (
            <div key={`${activity.moduleName}-${activity.levelName}`} className="rounded-[13px] border border-gray-200 px-[13px] py-[13px]">
              <p className="text-[13px] font-semibold text-gray-900">{activity.moduleName}</p>
              <p className="mt-[4px] text-[13px] text-gray-500">{activity.levelName}</p>
              <p className="mt-[4px] text-[13px] text-gray-600">
                {activity.availability === 'none_saved' ? NO_SESSION_SAVED_LABEL : `${activity.sessionCount} saved`}
              </p>
              {activity.lastRecordedAt ? (
                <p className="mt-[4px] text-[13px] text-gray-500">Latest {formatWhen(activity.lastRecordedAt, timeZone)}</p>
              ) : null}
            </div>
          ))}
          {patientPeriod.truncated ? <p className="text-[13px] leading-[21px] text-gray-600">{TRUNCATED_HISTORY_NOTE}</p> : null}
        </div>
      ) : null}
      {period ? (
        <div className="space-y-[21px]">
          {period.modulesWithoutLevels.map((module) => (
            <p key={module.moduleId} className="text-[13px] leading-[21px] text-gray-600">
              {module.moduleName}: {module.label}
            </p>
          ))}
          <section className="space-y-[8px]">
            <h3 className="text-[13px] font-semibold text-gray-900">Assigned activities</h3>
            {current.length === 0 ? <p className="text-[13px] text-gray-500">{NO_ACTIVITIES_ASSIGNED_LABEL}</p> : null}
            {current.map((activity) => (
              <ActivityCard key={`${activity.moduleId}-${activity.levelId}`} activity={activity} timeZone={timeZone} showPerformance />
            ))}
          </section>
          {previous.length > 0 ? (
            <section className="space-y-[8px]">
              <h3 className="text-[13px] font-semibold text-gray-900">No longer prescribed</h3>
              {previous.map((activity) => (
                <ActivityCard key={`${activity.moduleId}-${activity.levelId}`} activity={activity} timeZone={timeZone} showPerformance />
              ))}
            </section>
          ) : null}
          {period.truncated ? <p className="text-[13px] leading-[21px] text-gray-600">{TRUNCATED_HISTORY_NOTE}</p> : null}
          <section className="space-y-[8px]">
            <h3 className="text-[13px] font-semibold text-gray-900">Assignment history</h3>
            {doctorAnalytics?.revisions.length === 0 ? <p className="text-[13px] text-gray-500">No assignment history</p> : null}
            {doctorAnalytics?.revisions.map((revision) => (
              <div key={revision.id} className="text-[13px] leading-[21px] text-gray-600">
                <p>
                  {formatWhen(revision.effectiveFrom, timeZone)}
                  {revision.effectiveTo ? ` to ${formatWhen(revision.effectiveTo, timeZone)}` : ' onward'} · {revision.actorLabel}
                </p>
                <p>
                  {revision.assignments.length === 0
                    ? NO_ACTIVITIES_ASSIGNED_LABEL
                    : revision.assignments
                        .map((assignment) =>
                          assignment.levels.length === 0
                            ? `${moduleLabel(assignment.moduleId)}: no specific levels assigned`
                            : `${moduleLabel(assignment.moduleId)}: ${assignment.levels.map((levelId) => assignmentLevelName(assignment.moduleId, levelId)).join(', ')}`,
                        )
                        .join(' · ')}
                </p>
              </div>
            ))}
          </section>
          {period.recordedButNotAssigned.length > 0 ? (
            <section className="space-y-[8px]">
              <h3 className="text-[13px] font-semibold text-gray-900">Recorded but not assigned</h3>
              {period.recordedButNotAssigned.map((session) => (
                <p key={session.id} className="text-[13px] leading-[21px] text-gray-600">
                  {session.levelName} · {formatWhen(session.recordedAt, timeZone)} · {session.label}
                  {session.note ? ` ${session.note}` : ''}
                </p>
              ))}
            </section>
          ) : null}
          {period.unattributed.length > 0 ? (
            <section className="space-y-[8px]">
              <h3 className="text-[13px] font-semibold text-gray-900">Sessions not linked to an assignment</h3>
              {period.unattributed.map((session) => (
                <p key={session.id} className="text-[13px] leading-[21px] text-gray-600">
                  {session.levelName} · {formatWhen(session.recordedAt, timeZone)} · {session.label}
                </p>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
