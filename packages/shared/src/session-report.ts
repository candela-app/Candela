import { reactionStatsFromMs } from './game-logic';
import { GAME_CATALOG, MODULE_LEVELS, isTherapyModuleId } from './game-registry';
import { efficiencyIndex, round1, sessionAccuracy, sessionErrorRate } from './session-metrics';
import type { TherapyModuleId } from './types';

/** One stored session. A report never combines rows into a score. */
export interface SessionReportSource {
  id: string;
  sessionNumber: number;
  gameId: string;
  levelId: string | null;
  deviceTier: string | null;
  recordedAt: string;
  durationSec: number;
  correct: number;
  wrongTaps: number;
  misses: number;
  timeouts: number;
  accuracy: number;
  avgReactionSec: number;
  medianReactionSec: number;
  reactionMs: number[] | null;
  stimuliCount: number;
  gameName: string;
  contrastPercent?: number | null;
}

export type SessionTimeSource = 'samples' | 'stored_average' | 'unavailable';
export type SessionScoreKind = 'count_accuracy' | 'path_adherence';
export type SessionDurationMeaning = 'wall_clock' | 'sum_of_trial_times';
export type ComputerVisionIdentity = 'gaze_hold' | 'look_pursuit' | 'unverified';

export interface SessionCountLine {
  label: string;
  count: number;
  /** Share of this game's attempts. Null when this game has no attempt rate. */
  rate: number | null;
}

export interface SessionReport {
  id: string;
  sessionNumber: number;
  moduleName: string;
  levelName: string;
  recordedAt: string;
  score: { label: string; value: number | null; kind: SessionScoreKind };
  counts: SessionCountLine[];
  time: {
    source: SessionTimeSource;
    label: string;
    meanSec: number | null;
    medianSec: number | null;
    sampleCount: number;
  };
  duration: { label: string; seconds: number | null; meaning: SessionDurationMeaning };
  efficiency: number | null;
  deviceTier: string | null;
  contrastPercent: number | null;
  notices: string[];
}

export const GAZE_HOLD_UNSUPPORTED_MESSAGE =
  'Gaze Hold sessions are not saved, so there is no history to show.';

const MIXED_LEVEL_NOTE =
  'These sessions are from different levels. Different levels are not the same difficulty, and this list is not a combined score.';

export type SessionAttemptKey = 'correct' | 'wrongTaps' | 'misses' | 'timeouts';

type CountKey = SessionAttemptKey;

/** Outcomes that belong in this game's attempt total. Bubble Chase timeouts are never included. */
function attemptKeys(gameId: string): CountKey[] {
  switch (gameId) {
    case 'bee_tracing':
      return [];
    case 'rotatory':
    case 'sorting':
    case 'mobile_target':
      return ['correct', 'wrongTaps', 'misses'];
    case 'location_memory':
    case 'direction_sense':
    case 'familiar_faces':
      return ['correct', 'wrongTaps'];
    default:
      return ['correct', 'wrongTaps', 'misses', 'timeouts'];
  }
}

function countValue(row: Pick<SessionReportSource, CountKey>, key: CountKey): number {
  const value = row[key];
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/** Existing attempt membership for one game. Bee has none. */
export function sessionAttemptKeys(gameId: string): readonly SessionAttemptKey[] {
  return attemptKeys(gameId);
}

export function sessionTimeLabel(gameId: string): string {
  return timeLabel(gameId);
}

/**
 * Pooled count accuracy for one game.
 * Returns null when the game has no attempt rate or the attempt total is 0.
 * Does not average session percentages.
 */
export function pooledValidAttemptAccuracy(
  gameId: string,
  rows: ReadonlyArray<Pick<SessionReportSource, SessionAttemptKey>>,
): number | null {
  if (gameId === 'bee_tracing' || gameId === 'computer_vision') return null;
  const keys = attemptKeys(gameId);
  let correct = 0;
  let attempts = 0;
  for (const row of rows) {
    for (const key of keys) {
      const value = countValue(row, key);
      attempts += value;
      if (key === 'correct') correct += value;
    }
  }
  if (attempts <= 0) return null;
  return sessionAccuracy(correct, attempts - correct);
}

/**
 * Identity read from the stored level or name.
 * The catalog title "Gaze Hold" is not applied unless one of those fields says so.
 */
export function computerVisionIdentity(row: {
  gameId: string;
  levelId?: string | null;
  gameName?: string | null;
}): ComputerVisionIdentity | null {
  if (row.gameId !== 'computer_vision') return null;
  const name = (row.gameName || '').toLowerCase();
  if (name.includes('look pursuit')) return 'look_pursuit';
  if (row.levelId === 'stationary' || name.includes('gaze hold')) return 'gaze_hold';
  return 'unverified';
}

export function gazeHoldHistoryExists(
  rows: Array<{ gameId: string; levelId?: string | null; gameName?: string | null }>,
): boolean {
  return rows.some((row) => computerVisionIdentity(row) === 'gaze_hold');
}

/** Charts stay off unless every computer-vision row is a verified Gaze Hold session. */
export function sessionChartsAllowed(
  gameId: string,
  rows: Array<{ gameId: string; levelId?: string | null; gameName?: string | null }>,
): boolean {
  if (gameId !== 'computer_vision') return true;
  return rows.length > 0 && rows.every((row) => computerVisionIdentity(row) === 'gaze_hold');
}

export function showGazeHoldUnsupported(
  gameId: string,
  rows: Array<{ gameId: string; levelId?: string | null; gameName?: string | null }>,
): boolean {
  return gameId === 'computer_vision' && !gazeHoldHistoryExists(rows);
}

function levelNameFor(gameId: string, levelId: string | null): string {
  if (!levelId) return 'Level not recorded';
  if (!isTherapyModuleId(gameId)) return levelId;
  const known = MODULE_LEVELS[gameId]?.find((level) => level.id === levelId);
  return known ? known.name : levelId;
}

function moduleNameFor(row: SessionReportSource): string {
  const identity = computerVisionIdentity(row);
  if (identity === 'gaze_hold') return 'Gaze Hold';
  if (identity === 'look_pursuit') return 'Look Pursuit';
  if (identity === 'unverified') return row.gameName.trim() || 'Computer vision session';
  if (isTherapyModuleId(row.gameId)) return GAME_CATALOG[row.gameId as TherapyModuleId].name;
  return row.gameName.trim() || 'Session';
}

function timeLabel(gameId: string): string {
  if (gameId === 'bee_tracing') return 'Time to first grab';
  if (gameId === 'geoboard') return 'Time to finish a correct pattern';
  if (gameId === 'rotatory' || gameId === 'sorting' || gameId === 'pursuit' || gameId === 'mobile_target') {
    return 'Time to the correct hit';
  }
  return 'Time to the correct response';
}

function countLabel(gameId: string, key: CountKey): string {
  if (key === 'correct') {
    if (gameId === 'geoboard') return 'Correct patterns';
    if (gameId === 'mobile_target') return 'Completed sets';
    return 'Correct';
  }
  if (key === 'wrongTaps') {
    if (gameId === 'geoboard') return 'Wrong pattern';
    if (gameId === 'sorting') return 'Wrong item';
    if (gameId === 'mobile_target') return 'Wrong click';
    return 'Wrong tap';
  }
  if (key === 'misses') {
    if (gameId === 'geoboard') return 'Incomplete pattern';
    if (gameId === 'rotatory') return 'Wheel tap';
    return 'Empty tap';
  }
  return 'Timeout';
}

function reportTime(row: SessionReportSource, label: string): SessionReport['time'] & { notice: string | null } {
  const samples = row.reactionMs;
  if (Array.isArray(samples) && samples.length > 0) {
    const stats = reactionStatsFromMs(samples);
    if (stats.count > 0) {
      return {
        source: 'samples',
        label,
        meanSec: stats.avgSec,
        medianSec: stats.medianSec,
        sampleCount: stats.count,
        notice: 'Mean and median were reconstructed from the stored time samples.',
      };
    }
    return { source: 'unavailable', label, meanSec: null, medianSec: null, sampleCount: 0, notice: null };
  }
  if (Number.isFinite(row.avgReactionSec) && row.avgReactionSec > 0) {
    const median = Number.isFinite(row.medianReactionSec) && row.medianReactionSec > 0 ? row.medianReactionSec : null;
    return {
      source: 'stored_average',
      label,
      meanSec: row.avgReactionSec,
      medianSec: median,
      sampleCount: 0,
      notice: 'Stored average time. Individual times were not saved.',
    };
  }
  return { source: 'unavailable', label, meanSec: null, medianSec: null, sampleCount: 0, notice: null };
}

function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`;
}

export function formatSessionReport(row: SessionReportSource): SessionReport {
  const keys = attemptKeys(row.gameId);
  const attempts = keys.reduce((sum, key) => sum + countValue(row, key), 0);
  const errors = keys.filter((key) => key !== 'correct').reduce((sum, key) => sum + countValue(row, key), 0);
  const bee = row.gameId === 'bee_tracing';
  const adherence = Number.isFinite(row.accuracy) && row.accuracy >= 0 && row.accuracy <= 100 ? round1(row.accuracy) : null;
  const score = bee
    ? { label: 'Path adherence', value: adherence, kind: 'path_adherence' as const }
    : {
        label: row.gameId === 'geoboard' ? 'Pattern accuracy' : 'Accuracy',
        value: attempts > 0 ? sessionAccuracy(countValue(row, 'correct'), errors) : null,
        kind: 'count_accuracy' as const,
      };
  const counts: SessionCountLine[] = bee
    ? [
        { label: 'Rounds', count: countValue(row, 'correct'), rate: null },
        { label: 'Off-path deviations', count: countValue(row, 'misses'), rate: null },
      ]
    : keys.map((key) => ({
        label: countLabel(row.gameId, key),
        count: countValue(row, key),
        rate: key === 'correct' || attempts <= 0 ? null : sessionErrorRate(countValue(row, key), attempts),
      }));
  const timed = reportTime(row, timeLabel(row.gameId));
  const sumOfTrials = row.gameId === 'pursuit' || row.gameId === 'mobile_target';
  const durationSeconds = Number.isFinite(row.durationSec) && row.durationSec > 0 ? row.durationSec : null;
  const efficiency =
    score.value != null && timed.meanSec != null && timed.meanSec > 0 ? efficiencyIndex(score.value, timed.meanSec) : null;
  const notices: string[] = [];
  if (timed.notice) notices.push(timed.notice);
  const identity = computerVisionIdentity(row);
  if (identity === 'look_pursuit') notices.push('This row is not a Gaze Hold measurement.');
  if (identity === 'unverified') notices.push('The activity type could not be verified from this session.');
  if (bee && score.value == null) notices.push('Path adherence was not stored.');

  return {
    id: row.id,
    sessionNumber: row.sessionNumber,
    moduleName: moduleNameFor(row),
    levelName: levelNameFor(row.gameId, row.levelId),
    recordedAt: row.recordedAt,
    score,
    counts,
    time: {
      source: timed.source,
      label: timed.label,
      meanSec: timed.meanSec,
      medianSec: timed.medianSec,
      sampleCount: timed.sampleCount,
    },
    duration: {
      label: sumOfTrials ? 'Sum of trial times' : 'Time to finish',
      seconds: durationSeconds,
      meaning: sumOfTrials ? 'sum_of_trial_times' : 'wall_clock',
    },
    efficiency,
    deviceTier: row.deviceTier,
    contrastPercent: row.contrastPercent ?? null,
    notices,
  };
}

export interface PatientSessionSummary {
  moduleName: string;
  levelName: string;
  scoreText: string | null;
  timeText: string | null;
  durationText: string | null;
}

export function formatPatientSummary(report: SessionReport): PatientSessionSummary {
  return {
    moduleName: report.moduleName,
    levelName: report.levelName,
    scoreText: report.score.value == null ? null : `${report.score.label} ${round1(report.score.value)}%`,
    timeText:
      report.time.source === 'unavailable' || report.time.meanSec == null
        ? null
        : `${report.time.label} ${formatSeconds(report.time.meanSec)}`,
    durationText: report.duration.seconds == null ? null : `${report.duration.label} ${report.duration.seconds}s`,
  };
}

/** Names every distinct level. Returns null when the list is empty or a single level. */
export function mixedLevelNotice(levelNames: string[]): string | null {
  const unique = Array.from(new Set(levelNames.filter((name) => name)));
  if (unique.length <= 1) return null;
  return `${MIXED_LEVEL_NOTE} Levels shown: ${unique.join(', ')}.`;
}

export function formatReportSeconds(seconds: number): string {
  return formatSeconds(seconds);
}
