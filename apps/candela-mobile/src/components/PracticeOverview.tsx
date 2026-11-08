import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
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
  type PatientOverview,
  type PatientOverviewView,
  type PracticeInsightRow,
  type PracticePeriod,
} from '@candela/shared/rn';
import {
  listMyGameSessionOverview,
  listPatientGameSessionOverview,
  type StoredGameSessionRecord,
} from '../lib/api';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

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

export function PracticeOverview({
  audience,
  patientId,
  onOpenLevel,
}: {
  audience: 'patient' | 'doctor';
  patientId?: string;
  onOpenLevel?: (gameId: string, levelId: string) => void;
}) {
  const { s, fs } = useLayout();
  const timeZone = useMemo(() => resolvedTimeZone(), []);
  const [choice, setChoice] = useState<RangeChoice>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [overview, setOverview] = useState<PatientOverview | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
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

  const card = {
    backgroundColor: colors.white,
    borderRadius: s(13),
    borderWidth: 1,
    borderColor: colors.border,
    padding: s(13),
  };

  const view: PatientOverviewView | null = overview && audience === 'patient' ? projectPatientOverview(overview) : null;
  const practice = (view ?? overview)?.practice;

  return (
    <View style={{ gap: s(16), marginBottom: s(21) }}>
      <View style={{ gap: s(8) }}>
        <Text style={{ fontSize: fs(21), fontWeight: '700', color: colors.text }}>Practice record</Text>
        <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
          Saved finished sessions in this date range. A blank week means no session was saved.
        </Text>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
        {(
          [
            ['7d', '7 days'],
            ['30d', '30 days'],
            ['90d', '90 days'],
            ['custom', 'Custom'],
          ] as const
        ).map(([id, label]) => {
          const selected = choice === id;
          return (
            <Pressable
              key={id}
              onPress={() => setChoice(id)}
              style={{
                borderRadius: s(13),
                borderWidth: 1,
                borderColor: selected ? colors.blue : colors.border,
                backgroundColor: selected ? colors.blue : colors.white,
                paddingHorizontal: s(13),
                paddingVertical: s(8),
              }}
            >
              <Text style={{ color: selected ? colors.white : colors.text, fontWeight: '700', fontSize: fs(13) }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {choice === 'custom' ? (
        <View style={{ flexDirection: 'row', gap: s(13) }}>
          <TextInput
            value={customFrom}
            onChangeText={setCustomFrom}
            placeholder="From YYYY-MM-DD"
            accessibilityLabel="From date"
            autoCapitalize="none"
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(8), color: colors.text }}
          />
          <TextInput
            value={customTo}
            onChangeText={setCustomTo}
            placeholder="To YYYY-MM-DD"
            accessibilityLabel="To date"
            autoCapitalize="none"
            style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(8), color: colors.text }}
          />
        </View>
      ) : null}
      {loading ? <Text style={{ color: colors.muted, fontSize: fs(13) }}>Loading saved sessions…</Text> : null}
      {error ? <Text style={{ color: colors.red, fontSize: fs(13) }}>{error}</Text> : null}
      {practice && (view || overview) ? (
        <View style={{ gap: s(13) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
            {[
              ['Saved sessions', String(practice.sessionCount)],
              ['Per week', practice.sessionsPerWeek == null ? '—' : String(practice.sessionsPerWeek)],
              ['Active days', String(practice.activeDays)],
              ['Recorded duration', durationText(practice.duration)],
            ].map(([label, value]) => (
              <View key={label} style={{ ...card, minWidth: '46%', flexGrow: 1 }}>
                <Text style={{ fontSize: fs(13), color: colors.muted }}>{label}</Text>
                <Text style={{ marginTop: s(8), fontSize: fs(18), fontWeight: '700', color: colors.text }}>{value}</Text>
              </View>
            ))}
          </View>
          {audience === 'doctor' && overview ? (
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
              {overview.from} to {overview.to}. Median gap{' '}
              {practice.medianIntervalSec == null ? 'not available' : formatSpan(practice.medianIntervalSec)}. Latest gap{' '}
              {practice.latestIntervalSec == null ? 'not available' : formatSpan(practice.latestIntervalSec)}.
            </Text>
          ) : null}
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{(view ?? overview)!.durationNote}</Text>
          {practice.duration.excludedSessions > 0 ? (
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
              {practice.duration.excludedSessions} saved sessions had no usable recorded time and were left out of this total.
            </Text>
          ) : null}
          {practice.undatedCount + practice.outsideRangeCount > 0 ? (
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
              {practice.undatedCount + practice.outsideRangeCount} saved sessions were outside this date range or had no usable date, so they were not counted.
            </Text>
          ) : null}
          {overview?.truncated ? (
            <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.text }}>{TRUNCATED_HISTORY_NOTE}</Text>
          ) : null}
          <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>Weekly activity</Text>
          {practice.weeks.map((week) => (
            <Text key={week.key} style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
              {periodLine(week, 'Week of')}
            </Text>
          ))}
          {audience === 'doctor' && overview ? <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>Months</Text> : null}
          {audience === 'doctor' && overview
            ? overview.practice.months.map((month) => (
                <Text key={month.key} style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
                  {periodLine(month, 'Month')}
                </Text>
              ))
            : null}
          {(view ? view.games : overview!.games).map((game) => (
            <View key={game.gameId} style={{ ...card, gap: s(8) }}>
              <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>{game.gameName}</Text>
              <Text style={{ fontSize: fs(13), color: colors.muted }}>
                {game.sessionCount} saved · {game.durationLabel}: {durationText(game.duration)}
              </Text>
              {audience === 'doctor' && 'sequence' in game ? (
                <View style={{ gap: s(4) }}>
                  <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>Recorded level sequence</Text>
                  <Text style={{ fontSize: fs(13), color: colors.muted }}>Order recorded.</Text>
                  {game.sequence.map((stop, index) => (
                    <Text key={`${stop.levelId ?? 'unrecorded'}-${stop.firstRecordedAt}`} style={{ fontSize: fs(13), color: colors.muted }}>
                      {index + 1}. {stop.levelName} · first {formatWhen(stop.firstRecordedAt, timeZone)} · {stop.sessionCount} saved
                    </Text>
                  ))}
                </View>
              ) : null}
              {game.levels.map((level) => {
                const reaction = reactionText(level.reactionLabel, level.reactionMeanSec);
                const doctorLevel = level as OverviewLevel;
                return (
                  <View key={level.levelId ?? 'unrecorded'} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: s(13), padding: s(8), gap: s(4) }}>
                    <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>{level.levelName}</Text>
                    <Text style={{ fontSize: fs(13), color: colors.text }}>{performanceText(level.performanceLabel, level.performanceValue)}</Text>
                    {reaction ? <Text style={{ fontSize: fs(13), color: colors.text }}>{reaction}</Text> : null}
                    <Text style={{ fontSize: fs(13), color: colors.muted }}>
                      {level.sessionCount} saved · {formatWhen(level.firstRecordedAt, timeZone)} to {formatWhen(level.lastRecordedAt, timeZone)}
                    </Text>
                    {audience === 'doctor' && 'detailRecorded' in doctorLevel ? (
                      <Text style={{ fontSize: fs(13), color: colors.muted }}>
                        Detail recorded: {doctorLevel.detailRecorded}. Detail not available: {doctorLevel.detailUnavailable}.
                      </Text>
                    ) : null}
                    {audience === 'doctor' && 'contextMatches' in doctorLevel
                      ? doctorLevel.contextMatches.map((match) => (
                          <Text key={match.measurement} style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>
                            {levelContextMatchText(match)}
                          </Text>
                        ))
                      : null}
                    {audience === 'patient' && level.levelId && onOpenLevel ? (
                      <Pressable onPress={() => onOpenLevel(level.gameId, level.levelId as string)}>
                        <Text style={{ color: colors.blue, fontWeight: '700', fontSize: fs(13) }}>Progress</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ))}
          <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>Recent saved sessions</Text>
          {(view ? view.recent : overview!.recent).length === 0 ? (
            <Text style={{ fontSize: fs(13), color: colors.muted }}>{EMPTY_PERIOD_LABEL}</Text>
          ) : null}
          {(view ? view.recent : overview!.recent).map((row) => {
            if (audience === 'patient') {
              const summary = formatPatientSummary(formatSessionReport(row));
              return (
                <View key={row.id} style={card}>
                  <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>{summary.moduleName}</Text>
                  <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.muted }}>{summary.levelName}</Text>
                  <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.muted }}>{formatWhen(row.recordedAt, timeZone)}</Text>
                  <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.text }}>{summary.scoreText ?? 'Performance not available'}</Text>
                  {summary.timeText ? <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.text }}>{summary.timeText}</Text> : null}
                  {summary.durationText ? <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.text }}>{summary.durationText}</Text> : null}
                </View>
              );
            }
            const report = formatSessionReport(row);
            const open = openId === row.id;
            const detailLines = formatDoctorDetail((row as PracticeInsightRow).detail);
            return (
              <View key={row.id} style={card}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpenId(open ? null : row.id)}>
                  <Text style={{ fontSize: fs(13), fontWeight: '700', color: colors.text }}>{report.moduleName}</Text>
                  <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.muted }}>{report.levelName}</Text>
                  <Text style={{ marginTop: s(4), fontSize: fs(13), color: colors.muted }}>{formatWhen(row.recordedAt, timeZone)}</Text>
                  <Text style={{ marginTop: s(4), fontSize: fs(13), fontWeight: '700', color: colors.text }}>
                    {report.score.value == null ? 'Not stored' : `${report.score.value}%`}
                  </Text>
                </Pressable>
                {open ? (
                  <View style={{ marginTop: s(8), gap: s(4) }}>
                    {report.counts.map((line) => (
                      <Text key={line.label} style={{ fontSize: fs(13), color: colors.muted }}>
                        {line.label}: {line.count}
                        {line.rate == null ? '' : ` (${line.rate}%)`}
                      </Text>
                    ))}
                    <Text style={{ fontSize: fs(13), color: colors.muted }}>
                      {report.time.label}: {report.time.meanSec == null ? 'Not stored' : formatReportSeconds(report.time.meanSec)}
                    </Text>
                    {report.duration.seconds == null ? null : (
                      <Text style={{ fontSize: fs(13), color: colors.muted }}>
                        {report.duration.label}: {report.duration.seconds}s
                      </Text>
                    )}
                    {detailLines.map((line, lineIndex) => (
                      <Text key={`${line.label}-${lineIndex}`} style={{ fontSize: fs(13), color: colors.muted }}>
                        {line.label}: {line.value}
                      </Text>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
          <Text style={{ fontSize: fs(13), lineHeight: fs(21), color: colors.muted }}>{(view ?? overview)!.gazeHoldNote}</Text>
        </View>
      ) : null}
    </View>
  );
}
