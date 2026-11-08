'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  EMPTY_PERIOD_LABEL,
  TRUNCATED_HISTORY_NOTE,
  analyticsQueryRange,
  buildPatientOverview,
  formatDoctorDetail,
  formatPatientSummary,
  formatReportSeconds,
  formatSessionReport,
  insightPresetRange,
  levelContextMatchText,
  projectPatientOverview,
  resolvedTimeZone,
  type DurationSummary,
  type InsightPreset,
  type OverviewLevel,
  type PatientLevelView,
  type PatientOverview,
  type PatientOverviewView,
  type PracticeInsightRow,
  type PracticePeriod,
} from '@candela/shared';
import {
  listMyGameSessionOverview,
  listPatientGameSessionOverview,
  type StoredGameSessionRecord,
} from '@/lib/api';

const CARD = 'rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';

type RangeChoice = InsightPreset | 'custom';

function toInsight(row: StoredGameSessionRecord): PracticeInsightRow {
  return {
    id: row.id,
    sessionNumber: row.sessionNumber,
    gameId: row.gameId,
    levelId: row.levelId,
    deviceTier: row.deviceTier,
    recordedAt: row.recordedAt,
    durationSec: row.durationSec,
    correct: row.correct,
    wrongTaps: row.wrongTaps,
    misses: row.misses,
    timeouts: row.timeouts,
    accuracy: row.accuracy,
    avgReactionSec: row.avgReactionSec,
    medianReactionSec: row.medianReactionSec,
    reactionMs: row.reactionMs,
    stimuliCount: row.stimuliCount,
    gameName: row.gameName,
    contrastPercent: row.contrastPercent,
    detail: row.detail ?? null,
  };
}

function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Date not recorded';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone });
}

function formatSpan(seconds: number): string {
  const whole = Math.round(seconds);
  if (whole < 90) return `${whole}s`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes < 60) return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minuteRest = minutes % 60;
  return minuteRest ? `${hours}h ${minuteRest}m` : `${hours}h`;
}

function durationText(summary: DurationSummary): string {
  if (summary.availability !== 'recorded' || summary.totalSec == null) return 'Recorded time not available';
  const average = summary.averageSec == null ? '' : ` · average ${formatSpan(summary.averageSec)}`;
  return `${formatSpan(summary.totalSec)}${average}`;
}

function performanceText(label: string | null, value: number | null): string {
  if (label == null || value == null) return 'Performance not available';
  return `${label} ${value}%`;
}

function reactionText(label: string | null, meanSec: number | null): string | null {
  if (label == null || meanSec == null) return null;
  return `${label} ${formatReportSeconds(meanSec)}`;
}

function periodLine(period: PracticePeriod, prefix: string): string {
  if (period.availability === 'none_saved') return `${prefix} ${period.key}: ${EMPTY_PERIOD_LABEL}`;
  const noun = period.sessionCount === 1 ? 'saved session' : 'saved sessions';
  return `${prefix} ${period.key}: ${period.sessionCount} ${noun}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={CARD}>
      <p className="text-[13px] text-gray-500">{label}</p>
      <p className="mt-[8px] break-words text-[21px] font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function LevelFacts({
  level,
  timeZone,
  onOpenLevel,
}: {
  level: PatientLevelView;
  timeZone: string;
  onOpenLevel?: (gameId: string, levelId: string) => void;
}) {
  const reaction = reactionText(level.reactionLabel, level.reactionMeanSec);
  return (
    <div className="rounded-[13px] border border-gray-200 px-[13px] py-[13px]">
      <p className="text-[13px] font-semibold text-gray-900">{level.levelName}</p>
      <p className="mt-[4px] text-[13px] text-gray-600">{performanceText(level.performanceLabel, level.performanceValue)}</p>
      {reaction ? <p className="mt-[4px] text-[13px] text-gray-600">{reaction}</p> : null}
      <p className="mt-[4px] text-[13px] text-gray-500">
        {level.sessionCount} saved · {formatWhen(level.firstRecordedAt, timeZone)} to {formatWhen(level.lastRecordedAt, timeZone)}
      </p>
      {level.levelId && onOpenLevel ? (
        <button
          type="button"
          onClick={() => onOpenLevel(level.gameId, level.levelId as string)}
          className="mt-[8px] text-[13px] font-semibold text-blue-600"
        >
          Progress
        </button>
      ) : null}
    </div>
  );
}

function PatientBody({
  view,
  onOpenLevel,
}: {
  view: PatientOverviewView;
  onOpenLevel?: (gameId: string, levelId: string) => void;
}) {
  const practice = view.practice;
  return (
    <div className="space-y-[21px]">
      <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-4">
        <Stat label="Saved sessions" value={String(practice.sessionCount)} />
        <Stat label="Saved sessions per week" value={practice.sessionsPerWeek == null ? '—' : String(practice.sessionsPerWeek)} />
        <Stat label="Active days" value={String(practice.activeDays)} />
        <Stat label="Recorded duration" value={durationText(practice.duration)} />
      </div>
      <p className="text-[13px] leading-[21px] text-gray-500">{view.durationNote}</p>
      {practice.duration.excludedSessions > 0 ? (
        <p className="text-[13px] leading-[21px] text-gray-500">
          {practice.duration.excludedSessions} saved sessions had no usable recorded time and were left out of this total.
        </p>
      ) : null}
      {practice.undatedCount + practice.outsideRangeCount > 0 ? (
        <p className="text-[13px] leading-[21px] text-gray-500">
          {practice.undatedCount + practice.outsideRangeCount} saved sessions were outside this date range or had no usable date, so they were not counted.
        </p>
      ) : null}
      {view.truncated ? <p className="text-[13px] leading-[21px] text-gray-900">{TRUNCATED_HISTORY_NOTE}</p> : null}
      <section className="space-y-[8px]">
        <h3 className="text-[13px] font-semibold text-gray-900">Weekly activity</h3>
        <ul className="space-y-[4px]">
          {practice.weeks.map((week) => (
            <li key={week.key} className="text-[13px] leading-[21px] text-gray-600">
              {periodLine(week, 'Week of')}
            </li>
          ))}
        </ul>
      </section>
      {view.games.map((game) => (
        <section key={game.gameId} className={`${CARD} space-y-[13px]`}>
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">{game.gameName}</h3>
            <p className="mt-[4px] text-[13px] text-gray-500">
              {game.sessionCount} saved · {game.durationLabel}: {durationText(game.duration)}
            </p>
          </div>
          <div className="space-y-[8px]">
            {game.levels.map((level) => (
              <LevelFacts key={level.levelId ?? 'unrecorded'} level={level} timeZone={view.timeZone} onOpenLevel={onOpenLevel} />
            ))}
          </div>
        </section>
      ))}
      <section className="space-y-[8px]">
        <h3 className="text-[13px] font-semibold text-gray-900">Recent saved sessions</h3>
        {view.recent.length === 0 ? <p className="text-[13px] text-gray-500">{EMPTY_PERIOD_LABEL}</p> : null}
        <ul className="space-y-[8px]">
          {view.recent.map((row) => {
            const summary = formatPatientSummary(formatSessionReport(row));
            return (
              <li key={row.id} className={CARD}>
                <p className="text-[13px] font-semibold text-gray-900">{summary.moduleName}</p>
                <p className="mt-[4px] text-[13px] text-gray-500">{summary.levelName}</p>
                <p className="mt-[4px] text-[13px] text-gray-500">{formatWhen(row.recordedAt, view.timeZone)}</p>
                <p className="mt-[4px] text-[13px] text-gray-600">{summary.scoreText ?? 'Performance not available'}</p>
                {summary.timeText ? <p className="mt-[4px] text-[13px] text-gray-600">{summary.timeText}</p> : null}
                {summary.durationText ? <p className="mt-[4px] text-[13px] text-gray-600">{summary.durationText}</p> : null}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-[13px] leading-[21px] text-gray-500">{view.gazeHoldNote}</p>
    </div>
  );
}

function DoctorLevel({ level, timeZone }: { level: OverviewLevel; timeZone: string }) {
  const reaction = reactionText(level.reactionLabel, level.reactionMeanSec);
  return (
    <div className="rounded-[13px] border border-gray-200 px-[13px] py-[13px] space-y-[4px]">
      <p className="text-[13px] font-semibold text-gray-900">{level.levelName}</p>
      <p className="text-[13px] text-gray-600">{performanceText(level.performanceLabel, level.performanceValue)}</p>
      {reaction ? <p className="text-[13px] text-gray-600">{reaction}</p> : null}
      <p className="text-[13px] text-gray-500">
        {level.sessionCount} saved · {formatWhen(level.firstRecordedAt, timeZone)} to {formatWhen(level.lastRecordedAt, timeZone)}
      </p>
      <p className="text-[13px] text-gray-500">
        Detail recorded: {level.detailRecorded}. Detail not available: {level.detailUnavailable}.
      </p>
      {level.contextMatches.map((match) => (
        <p key={match.measurement} className="text-[13px] leading-[21px] text-gray-500">
          {levelContextMatchText(match)}
        </p>
      ))}
    </div>
  );
}

function DoctorBody({ overview }: { overview: PatientOverview }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const practice = overview.practice;
  return (
    <div className="space-y-[21px]">
      <p className="text-[13px] text-gray-500">
        {overview.from} to {overview.to} · {overview.timeZone}
      </p>
      <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-4">
        <Stat label="Saved sessions" value={String(practice.sessionCount)} />
        <Stat label="Saved sessions per week" value={practice.sessionsPerWeek == null ? '—' : String(practice.sessionsPerWeek)} />
        <Stat label="Active days" value={String(practice.activeDays)} />
        <Stat label="Recorded duration" value={durationText(practice.duration)} />
      </div>
      <p className="text-[13px] leading-[21px] text-gray-500">
        Median time between saved sessions:{' '}
        {practice.medianIntervalSec == null ? 'Not enough saved sessions' : formatSpan(practice.medianIntervalSec)}. Latest gap:{' '}
        {practice.latestIntervalSec == null ? 'Not enough saved sessions' : formatSpan(practice.latestIntervalSec)}.
      </p>
      <p className="text-[13px] leading-[21px] text-gray-500">{overview.durationNote}</p>
      {practice.duration.excludedSessions > 0 ? (
        <p className="text-[13px] leading-[21px] text-gray-500">
          {practice.duration.excludedSessions} saved sessions had no usable recorded time and were left out of this total.
        </p>
      ) : null}
      {practice.undatedCount + practice.outsideRangeCount > 0 ? (
        <p className="text-[13px] leading-[21px] text-gray-500">
          {practice.undatedCount + practice.outsideRangeCount} saved sessions were outside this date range or had no usable date, so they were not counted.
        </p>
      ) : null}
      {overview.truncated ? <p className="text-[13px] leading-[21px] text-gray-900">{TRUNCATED_HISTORY_NOTE}</p> : null}
      <section className="space-y-[8px]">
        <h3 className="text-[13px] font-semibold text-gray-900">Weekly activity</h3>
        <ul className="space-y-[4px]">
          {practice.weeks.map((week) => (
            <li key={week.key} className="text-[13px] leading-[21px] text-gray-600">
              {periodLine(week, 'Week of')}
            </li>
          ))}
        </ul>
      </section>
      <section className="space-y-[8px]">
        <h3 className="text-[13px] font-semibold text-gray-900">Months</h3>
        <ul className="space-y-[4px]">
          {practice.months.map((month) => (
            <li key={month.key} className="text-[13px] leading-[21px] text-gray-600">
              {periodLine(month, 'Month')}
            </li>
          ))}
        </ul>
      </section>
      {overview.games.map((game) => (
        <section key={game.gameId} className={`${CARD} space-y-[13px]`}>
          <div>
            <h3 className="text-[13px] font-semibold text-gray-900">{game.gameName}</h3>
            <p className="mt-[4px] text-[13px] text-gray-500">
              {game.sessionCount} saved · {game.durationLabel}: {durationText(game.duration)}
            </p>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-gray-900">Recorded level sequence</p>
            <p className="mt-[4px] text-[13px] text-gray-500">Order recorded. This is the order levels first appeared in saved sessions.</p>
            <ol className="mt-[8px] space-y-[4px]">
              {game.sequence.map((stop, index) => (
                <li key={`${stop.levelId ?? 'unrecorded'}-${stop.firstRecordedAt}`} className="text-[13px] text-gray-600">
                  {index + 1}. {stop.levelName} · first {formatWhen(stop.firstRecordedAt, overview.timeZone)} · {stop.sessionCount} saved
                </li>
              ))}
            </ol>
          </div>
          <div className="space-y-[8px]">
            {game.levels.map((level) => (
              <DoctorLevel key={level.levelId ?? 'unrecorded'} level={level} timeZone={overview.timeZone} />
            ))}
          </div>
        </section>
      ))}
      <section className="space-y-[8px]">
        <h3 className="text-[13px] font-semibold text-gray-900">Recent saved sessions</h3>
        {overview.recent.length === 0 ? <p className="text-[13px] text-gray-500">{EMPTY_PERIOD_LABEL}</p> : null}
        <ul className="space-y-[8px]">
          {overview.recent.map((row) => {
            const report = formatSessionReport(row);
            const open = openId === row.id;
            const detailLines = formatDoctorDetail(row.detail);
            return (
              <li key={row.id} className={CARD}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : row.id)}
                  className="flex w-full items-start justify-between gap-[13px] text-left"
                >
                  <span>
                    <span className="block text-[13px] font-semibold text-gray-900">{report.moduleName}</span>
                    <span className="mt-[4px] block text-[13px] text-gray-500">{report.levelName}</span>
                    <span className="mt-[4px] block text-[13px] text-gray-500">{formatWhen(row.recordedAt, overview.timeZone)}</span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[13px] font-semibold text-gray-900">
                      {report.score.value == null ? 'Not stored' : `${report.score.value}%`}
                    </span>
                    <span className="mt-[4px] block text-[13px] text-gray-500">{report.score.label}</span>
                  </span>
                </button>
                {open ? (
                  <div className="mt-[13px] space-y-[8px] border-t border-gray-200 pt-[13px] text-[13px] leading-[21px] text-gray-600">
                    {report.counts.map((line) => (
                      <p key={line.label}>
                        {line.label}: {line.count}
                        {line.rate == null ? '' : ` (${line.rate}%)`}
                      </p>
                    ))}
                    <p>
                      {report.time.label}:{' '}
                      {report.time.meanSec == null ? 'Not stored' : formatReportSeconds(report.time.meanSec)}
                    </p>
                    {report.duration.seconds == null ? null : (
                      <p>
                        {report.duration.label}: {report.duration.seconds}s
                      </p>
                    )}
                    {detailLines.map((line, lineIndex) => (
                      <p key={`${line.label}-${lineIndex}`}>
                        {line.label}: {line.value}
                      </p>
                    ))}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
      <p className="text-[13px] leading-[21px] text-gray-500">{overview.gazeHoldNote}</p>
    </div>
  );
}

export function PracticeOverview({
  audience,
  patientId,
  onOpenLevel,
}: {
  audience: 'patient' | 'doctor';
  patientId?: string;
  onOpenLevel?: (gameId: string, levelId: string) => void;
}) {
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const [choice, setChoice] = useState<RangeChoice>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [overview, setOverview] = useState<PatientOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const range = useMemo(() => {
    if (choice === 'custom') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(customFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(customTo)) return null;
      return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
    }
    return insightPresetRange(choice, new Date().toISOString(), timeZone);
  }, [choice, customFrom, customTo, timeZone]);

  useEffect(() => {
    if (!range || (audience === 'doctor' && !patientId)) {
      setOverview(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    const query = analyticsQueryRange(range.from, range.to, timeZone);
    const request =
      audience === 'doctor' && patientId
        ? listPatientGameSessionOverview(patientId, query)
        : listMyGameSessionOverview(query);
    request
      .then((response) => {
        if (cancelled) return;
        setOverview(
          buildPatientOverview(response.sessions.map(toInsight), {
            timeZone,
            from: range.from,
            to: range.to,
            truncated: response.truncated,
            omitted: response.omitted,
            cap: response.cap,
          }),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setOverview(null);
        setError(err instanceof Error ? err.message : 'Could not load this practice record');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, patientId, range, timeZone]);

  return (
    <section className="space-y-[21px]">
      <div className="space-y-[8px]">
        <h2 className="text-[21px] font-semibold text-gray-900">Practice record</h2>
        <p className="text-[13px] leading-[21px] text-gray-500">
          Saved finished sessions in this date range. A blank week means no session was saved.
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
      {loading ? <p className="text-[13px] text-gray-500">Loading saved sessions…</p> : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {overview && audience === 'patient' ? (
        <PatientBody view={projectPatientOverview(overview)} onOpenLevel={onOpenLevel} />
      ) : null}
      {overview && audience === 'doctor' ? <DoctorBody overview={overview} /> : null}
    </section>
  );
}
