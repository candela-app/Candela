'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  EMPTY_PERIOD_LABEL,
  TRUNCATED_HISTORY_NOTE,
  analyticsQueryRange,
  buildPatientOverview,
  formatDoctorDetail,
  formatPatientSummary,
  formatReportSeconds,
  formatSessionReport,
  groupByGameFamily,
  insightPresetRange,
  levelContextMatchText,
  projectPatientOverview,
  resolvedTimeZone,
  type DurationSummary,
  type FamilyGroup,
  type OverviewGame,
  type OverviewLevel,
  type PatientLevelView,
  type PatientOverview,
  type PatientOverviewView,
  type PracticeInsightRow,
  type PracticePeriod,
  type TherapyFamilyId,
} from '@candela/shared';
import { ChevronDownIcon } from '@/components/icons/VectorIcons';
import { Skeleton } from '@/components/common/Skeleton';
import {
  listMyGameSessionOverview,
  listPatientGameSessionOverview,
  type StoredGameSessionRecord,
} from '@/lib/api';

const CARD = 'rounded-[13px] border border-gray-200 bg-white p-[21px] shadow-[0_12px_32px_-14px_rgba(15,23,42,0.35)]';
const CHEVRON =
  'mt-[8px] size-4 shrink-0 text-gray-500 transition-transform duration-300 ease-out motion-reduce:transition-none';

type FamilyFilter = 'all' | TherapyFamilyId | 'other';
type OverviewGameCard = OverviewGame | PatientOverviewView['games'][number];

function SkeletonBar({ className = '' }: { className?: string }) {
  return <Skeleton className={`rounded-[13px] ${className}`} />;
}

function PracticeOverviewSkeleton() {
  return (
    <div className="space-y-[21px]" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading practice record</span>
      <div className="grid grid-cols-2 gap-[13px] sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className={CARD}>
            <SkeletonBar className="h-[13px] w-[89px]" />
            <SkeletonBar className="mt-[8px] h-[21px] w-[55px]" />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-[8px]">
        <SkeletonBar className="h-[37px] w-[110px]" />
        <SkeletonBar className="h-[37px] w-[96px]" />
        <SkeletonBar className="h-[37px] w-[110px]" />
        <SkeletonBar className="h-[37px] w-[120px]" />
        <SkeletonBar className="h-[37px] w-[88px]" />
      </div>
      {[0, 1, 2, 3].map((index) => (
        <div key={index} className="overflow-hidden rounded-[13px] border border-gray-200">
          <div className="flex items-start gap-[13px] px-[13px] py-[13px]">
            <SkeletonBar className="mt-[6px] h-[34px] w-[5px] rounded-full" />
            <div className="min-w-0 flex-1 space-y-[8px]">
              <SkeletonBar className="h-[21px] w-[140px]" />
              <SkeletonBar className="h-[13px] w-[220px]" />
              <SkeletonBar className="h-[13px] w-[120px]" />
            </div>
            <SkeletonBar className="mt-[8px] size-4 rounded-full" />
          </div>
        </div>
      ))}
      <div className="space-y-[8px]">
        <SkeletonBar className="h-[13px] w-[160px]" />
        <SkeletonBar className="h-[89px] w-full" />
        <SkeletonBar className="h-[89px] w-full" />
      </div>
    </div>
  );
}

function familyKey(group: FamilyGroup<unknown>): string {
  return group.familyId ?? 'other';
}

function filterFamilyGroups<T>(groups: FamilyGroup<T>[], filter: FamilyFilter): FamilyGroup<T>[] {
  if (filter === 'all') return groups;
  if (filter === 'other') return groups.filter((group) => group.familyId == null);
  return groups.filter((group) => group.familyId === filter);
}

function GameFamilyBoard({
  games,
  renderGame,
}: {
  games: OverviewGameCard[];
  renderGame: (game: OverviewGameCard) => ReactNode;
}) {
  const groups = useMemo(
    () =>
      groupByGameFamily(
        games.map((game) => ({
          ...game,
          moduleId: game.gameId,
          moduleName: game.gameName,
        })),
      ),
    [games],
  );
  const [filter, setFilter] = useState<FamilyFilter>('all');
  const visible = filterFamilyGroups(groups, filter);
  const visibleKey = visible.map(familyKey).join('|');
  const [openKeys, setOpenKeys] = useState<string[]>([]);

  useEffect(() => {
    setOpenKeys([]);
  }, [visibleKey, filter]);

  if (groups.length === 0) return null;

  return (
    <div className="space-y-[21px]">
      <div className="flex flex-wrap gap-[8px]">
        <button
          type="button"
          onClick={() => setFilter('all')}
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
              onClick={() => setFilter(id)}
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
        const accent = group.bar ?? group.accent ?? '#9CA3AF';
        const panelId = `practice-family-${key}`;
        const sessionTotal = group.items.reduce((sum, game) => sum + game.sessionCount, 0);
        return (
          <section key={key} className="overflow-hidden rounded-[13px] border border-gray-200 bg-white">
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() =>
                  setOpenKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
                }
                className="flex w-full cursor-pointer items-start gap-[13px] px-[13px] py-[13px] text-left hover:bg-gray-50"
              >
                <span className="mt-[6px] h-[34px] w-[5px] shrink-0 rounded-full" style={{ backgroundColor: accent }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-semibold text-gray-900">{group.title}</span>
                  {group.body ? (
                    <span className="mt-[4px] block text-[13px] leading-[21px] font-normal text-gray-500">{group.body}</span>
                  ) : null}
                  <span className="mt-[4px] block text-[13px] font-semibold tabular-nums text-gray-500">
                    {group.items.length} {group.items.length === 1 ? 'module' : 'modules'} · {sessionTotal} saved
                  </span>
                </span>
                <ChevronDownIcon className={`${CHEVRON} ${open ? 'rotate-180' : 'rotate-0'}`} />
              </button>
            </h3>
            {open ? (
              <div id={panelId} className="space-y-[13px] border-t border-gray-100 p-[13px]">
                {group.items.map((game) => renderGame(game))}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

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
      <GameFamilyBoard
        games={view.games}
        renderGame={(game) => (
          <div key={game.gameId} className="space-y-[8px] rounded-[13px] border border-gray-200 p-[13px]">
            <div>
              <h4 className="text-[13px] font-semibold text-gray-900">{game.gameName}</h4>
              <p className="mt-[4px] text-[13px] text-gray-500">
                {game.sessionCount} saved · {game.durationLabel}: {durationText(game.duration)}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
              {game.levels.map((level) => (
                <LevelFacts
                  key={level.levelId ?? 'unrecorded'}
                  level={level as PatientLevelView}
                  timeZone={view.timeZone}
                  onOpenLevel={onOpenLevel}
                />
              ))}
            </div>
          </div>
        )}
      />
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
      <GameFamilyBoard
        games={overview.games}
        renderGame={(game) => {
          const doctorGame = game as OverviewGame;
          return (
            <div key={doctorGame.gameId} className="space-y-[13px] rounded-[13px] border border-gray-200 p-[13px]">
              <div>
                <h4 className="text-[13px] font-semibold text-gray-900">{doctorGame.gameName}</h4>
                <p className="mt-[4px] text-[13px] text-gray-500">
                  {doctorGame.sessionCount} saved · {doctorGame.durationLabel}: {durationText(doctorGame.duration)}
                </p>
              </div>
              <div>
                <p className="text-[13px] font-semibold text-gray-900">Recorded level sequence</p>
                <p className="mt-[4px] text-[13px] text-gray-500">
                  Order recorded. This is the order levels first appeared in saved sessions.
                </p>
                <ol className="mt-[8px] space-y-[4px]">
                  {doctorGame.sequence.map((stop, index) => (
                    <li
                      key={`${stop.levelId ?? 'unrecorded'}-${stop.firstRecordedAt}`}
                      className="text-[13px] text-gray-600"
                    >
                      {index + 1}. {stop.levelName} · first {formatWhen(stop.firstRecordedAt, overview.timeZone)} ·{' '}
                      {stop.sessionCount} saved
                    </li>
                  ))}
                </ol>
              </div>
              <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2">
                {doctorGame.levels.map((level) => (
                  <DoctorLevel key={level.levelId ?? 'unrecorded'} level={level} timeZone={overview.timeZone} />
                ))}
              </div>
            </div>
          );
        }}
      />
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
  const [overview, setOverview] = useState<PatientOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const range = useMemo(
    () => insightPresetRange('30d', new Date().toISOString(), timeZone),
    [timeZone],
  );

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
        <p className="text-[13px] leading-[21px] text-gray-500">Saved finished sessions from the last 30 days.</p>
      </div>
      {loading ? <PracticeOverviewSkeleton /> : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {overview && audience === 'patient' ? (
        <PatientBody view={projectPatientOverview(overview)} onOpenLevel={onOpenLevel} />
      ) : null}
      {overview && audience === 'doctor' ? <DoctorBody overview={overview} /> : null}
    </section>
  );
}
