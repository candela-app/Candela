import { ALPHABETS } from './constants';
import type { RotatorySessionResultData, RotatoryTrialRecord } from './rotatory-logic';
import type {
  BeeSessionResultData,
  DirectionSenseSessionResultData,
  FamiliarFacesSessionResultData,
  GeoboardSessionResultData,
  GeoboardTrialMetric,
  LocationMemorySessionResultData,
  MobileTargetSessionResultData,
  NumberSearchSessionResultData,
  PatternMatchSessionResultData,
  PeripheralSessionResultData,
  PeripheralTrialRecord,
  PursuitSessionResultData,
  PursuitTrialMetric,
  RoundResultData,
} from './types';

/** Understood detail documents use this version. metrics_version stays separate. */
export const SESSION_DETAIL_VERSION = 1;
export const SESSION_DETAIL_MAX_BYTES = 16384;
export const SESSION_DETAIL_MAX_NOTICES = 8;
export const SESSION_DETAIL_NOTICE_MAX_CHARS = 160;
/** Integers outside this range are not kept as a submitted-version diagnostic. */
export const SESSION_DETAIL_VERSION_DIAGNOSTIC_MAX = 9999;

/**
 * Bubble Chase plays one set per pool item.
 * Letters are 26, numbers are at most 20, and the color palette is 8.
 */
export const BUBBLE_CHASE_SET_CAP = ALPHABETS.length;

export const DETAIL_ARRAY_CAPS = {
  rotatoryTrials: 40,
  beeRounds: 16,
  pursuitTrials: 24,
  geoboardTrials: 40,
  peripheralTrials: 80,
  bubbleChaseSets: BUBBLE_CHASE_SET_CAP,
} as const;

export type DetailUnit = 'ms' | 's' | 'percent' | 'px' | 'px/s' | 'count' | 'ratio' | 'proportion';
export type DetailSource = 'measured' | 'derived';

/** A stored number. Display labels live in the doctor formatter, not here. */
export interface DetailMeasure {
  value: number;
  unit: DetailUnit;
  source: DetailSource;
}

export type DetailDeviceTier = 'mobile' | 'tablet' | 'tv';

export interface DetailContext {
  deviceTier: DetailDeviceTier | null;
  levelId: string | null;
}

export interface RotatoryCompactTrial {
  outcome: 'correct' | 'wrong_then_correct' | 'invalid';
  reactionMs: number;
  wrongTaps: number;
  aimTaps: number;
  hemifield: 'left' | 'right' | 'midline';
  glyphClass: 'simple_stroke' | 'open_round' | 'closed_round' | 'dense_stroke' | 'symmetric' | 'diagonal' | 'hue';
  validForRt: boolean;
}

export interface RotatoryDetailBin {
  id: string;
  n: number;
  medianRtSec: DetailMeasure;
  sufficient: boolean;
}

export interface BeeCompactRound {
  pathType: string;
  accuracyPercent: DetailMeasure;
  completionTimeSec: DetailMeasure;
  deviationCount: DetailMeasure;
  avgRecoveryTimeSec: DetailMeasure;
  reactionTimeMs?: DetailMeasure;
  orientation?: 'landscape' | 'portrait';
}

export interface PursuitCompactTrial {
  trialIndex: number;
  outcome: 'correct' | 'incorrect' | 'timeout';
  reactionTimeMs: DetailMeasure;
  trackingErrorPx: DetailMeasure;
  anticipationRatio: DetailMeasure;
}

/** Plain copy of one finished Pursuit trial. Positions and live objects are left out. */
export interface PursuitCompletedTrial {
  trialIndex: number;
  outcome: 'correct' | 'incorrect' | 'timeout';
  reactionTimeMs: number;
  trackingErrorPx: number;
  anticipationRatio: number;
}

export interface GeoboardCompactTrial {
  patternId: string;
  correct: boolean;
  errorType: 'none' | 'wrong-dot' | 'wrong-shape' | 'incomplete';
  reactionTimeMs: DetailMeasure;
  firstDotLatencyMs: DetailMeasure;
  corrections: DetailMeasure;
  timedOut: boolean;
}

export interface PeripheralCompactTrial {
  outcome: 'correct' | 'wrong' | 'timeout' | 'miss';
  reactionMs: DetailMeasure | null;
}

export interface BubbleChaseCompactSet {
  setIndex: number;
  outcome: 'correct' | 'incorrect' | 'timeout';
  reactionTimeMs: DetailMeasure;
  wrongClicksCount: DetailMeasure;
}

interface OkBase {
  detailVersion: 1;
  status: 'ok';
  context: DetailContext;
  notices: string[];
}

export interface RotatoryDetail extends OkBase {
  gameId: 'rotatory';
  lateralityEligible: boolean;
  lateralitySuppressedReason: string;
  rotationDirection: 'cw' | 'ccw' | null;
  leftFieldMedianRtSec?: DetailMeasure;
  rightFieldMedianRtSec?: DetailMeasure;
  leftFieldAccuracy?: DetailMeasure;
  rightFieldAccuracy?: DetailMeasure;
  iqrReactionSec?: DetailMeasure;
  cleanTrialMedianRtSec?: DetailMeasure;
  cleanTapRate?: DetailMeasure;
  discriminationErrorRate?: DetailMeasure;
  motorMissRate?: DetailMeasure;
  fieldCrossingRate?: DetailMeasure;
  formClasses?: RotatoryDetailBin[];
  eccentricityBins?: RotatoryDetailBin[];
  trials?: RotatoryCompactTrial[];
}

export interface BeeDetail extends OkBase {
  gameId: 'bee_tracing';
  tracingMode: 'active' | 'guided' | null;
  toleranceBandPx?: DetailMeasure;
  horizontalAccuracyPercent?: DetailMeasure;
  verticalAccuracyPercent?: DetailMeasure;
  rounds?: BeeCompactRound[];
}

export interface PursuitDetail extends OkBase {
  gameId: 'pursuit';
  movementPattern: string | null;
  decoyCount?: DetailMeasure;
  speedPxPerSec?: DetailMeasure;
  avgTrackingErrorPx?: DetailMeasure;
  meanAnticipationRatio?: DetailMeasure;
  trials?: PursuitCompactTrial[];
}

export interface GeoboardDetail extends OkBase {
  gameId: 'geoboard';
  boardId: number | null;
  wrongDot?: DetailMeasure;
  wrongShape?: DetailMeasure;
  incomplete?: DetailMeasure;
  leftHalfAccuracy?: DetailMeasure;
  rightHalfAccuracy?: DetailMeasure;
  avgFirstDotLatencySec?: DetailMeasure;
  totalCorrections?: DetailMeasure;
  trials?: GeoboardCompactTrial[];
}

export interface PeripheralDetail extends OkBase {
  gameId: 'peripheral_view';
  peripheralField: 'left' | 'right' | 'both' | null;
  bubbleType: 'solid' | 'boundary' | null;
  targetTimeoutSec?: DetailMeasure;
  trials?: PeripheralCompactTrial[];
}

export interface DirectionDetail extends OkBase {
  gameId: 'direction_sense';
  transformMode: 'face' | 'flip' | 'mixed' | 'straighten' | null;
  choiceCount?: DetailMeasure;
  faceErrors?: DetailMeasure;
  flipErrors?: DetailMeasure;
}

export interface BubbleChaseDetail extends OkBase {
  gameId: 'mobile_target';
  gameMode: 'alphabets' | 'numbers' | 'colors' | null;
  speedPxPerSec?: DetailMeasure;
  sets?: BubbleChaseCompactSet[];
}

export interface NumberSearchDetail extends OkBase {
  gameId: 'number_search';
  timeLimitSec?: DetailMeasure;
}

export interface PatternMatchDetail extends OkBase {
  gameId: 'pattern_match';
  codeLength?: DetailMeasure;
  flashMs?: DetailMeasure;
  timeLimitSec?: DetailMeasure;
  roundsCompleted?: DetailMeasure;
  stimulusMode: 'digits' | 'compound' | null;
}

export interface LocationMemoryDetail extends OkBase {
  gameId: 'location_memory';
  playMode: 'recall' | 'pairs' | null;
  exploreSec?: DetailMeasure;
  recallSecPerTarget?: DetailMeasure;
  roundsCompleted?: DetailMeasure;
  activeCellsConfigured?: DetailMeasure;
}

export interface FamiliarFacesDetail extends OkBase {
  gameId: 'familiar_faces';
  flashMs?: DetailMeasure;
}

export interface RejectedSessionDetail {
  detailVersion: 1;
  gameId: string;
  status: 'rejected';
  notices: string[];
}

/** Not a version-1 document. submittedVersion is kept only when it is a bounded integer. */
export interface UnsupportedSessionDetail {
  status: 'unsupported_version';
  submittedVersion?: number;
  notices: string[];
}

export type SessionDetail =
  | RotatoryDetail
  | BeeDetail
  | PursuitDetail
  | GeoboardDetail
  | PeripheralDetail
  | DirectionDetail
  | BubbleChaseDetail
  | NumberSearchDetail
  | PatternMatchDetail
  | LocationMemoryDetail
  | FamiliarFacesDetail
  | RejectedSessionDetail
  | UnsupportedSessionDetail;

export type DetailMeasurementKey =
  | 'rotatory.hemifield'
  | 'rotatory.form'
  | 'bee.adherence'
  | 'bee.axis'
  | 'pursuit.tracking'
  | 'geoboard.halfField'
  | 'peripheral.outcome'
  | 'direction.errors'
  | 'mobile_target.set';

export interface DoctorDetailLine {
  label: string;
  value: string;
}

export interface DetailExtractContext {
  levelId?: string | null;
  deviceTier?: string | null;
}

const TIER1 = new Set(['rotatory', 'bee_tracing', 'pursuit', 'geoboard']);
const TIER2 = new Set([
  'peripheral_view',
  'direction_sense',
  'mobile_target',
  'number_search',
  'pattern_match',
  'location_memory',
  'familiar_faces',
]);

const BEE_PATHS = ['straight', 'curve', 'zigzag', 'wave', 'spiral', 'branching', 'dotted', 'random', 'procedural_random'] as const;
const PURSUIT_PATTERNS = ['linear_bounce', 'circular_orbit', 'figure_eight', 'random_walk', 'freeze_drift', 'stationary'] as const;

class NoticeList {
  readonly items: string[] = [];

  add(text: string): void {
    const clean = text.replace(/\s+/g, ' ').trim().slice(0, SESSION_DETAIL_NOTICE_MAX_CHARS);
    if (!clean || this.items.includes(clean) || this.items.length >= SESSION_DETAIL_MAX_NOTICES) return;
    this.items.push(clean);
  }

  keep(existing: unknown): void {
    if (!Array.isArray(existing)) return;
    for (const entry of existing) {
      if (typeof entry === 'string') this.add(entry);
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function utf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function boundedVersion(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < 1 || value > SESSION_DETAIL_VERSION_DIAGNOSTIC_MAX) return null;
  return value;
}

function clipId(value: unknown, max = 64): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  if (!clean || clean.length > max) return null;
  return clean;
}

function deviceTier(value: unknown, notices: NoticeList): DetailDeviceTier | null {
  if (value == null || value === '') return null;
  if (value === 'mobile' || value === 'tablet' || value === 'tv') return value;
  notices.add('Device tier was omitted because it was not mobile, tablet, or tv.');
  return null;
}

function contextFrom(raw: unknown, fallback: DetailExtractContext | undefined, notices: NoticeList): DetailContext {
  const source = isObject(raw) ? raw : {};
  const nested = isObject(source.context) ? source.context : {};
  const level = clipId(nested.levelId ?? source.levelId ?? fallback?.levelId ?? null);
  return {
    deviceTier: deviceTier(nested.deviceTier ?? source.deviceTier ?? fallback?.deviceTier ?? null, notices),
    levelId: level,
  };
}

function measure(
  value: unknown,
  unit: DetailUnit,
  source: DetailSource,
  field: string,
  notices: NoticeList,
): DetailMeasure | undefined {
  const numeric =
    isObject(value) && 'value' in value ? (value as { value?: unknown }).value : value;
  if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
    if (numeric != null) notices.add(`${field} was omitted because it was not a finite number.`);
    return undefined;
  }
  let next = numeric;
  if (unit === 'ms' || unit === 'px' || unit === 'count') next = Math.round(numeric);
  else if (unit === 'percent' || unit === 'px/s') next = Math.round(numeric * 10) / 10;
  else next = Math.round(numeric * 1000) / 1000;
  if (unit === 'percent' && (next < 0 || next > 100)) {
    notices.add(`${field} was omitted because a percent must be from 0 to 100.`);
    return undefined;
  }
  if (unit === 'proportion' && (next < 0 || next > 1)) {
    notices.add(`${field} was omitted because a proportion must be from 0 to 1.`);
    return undefined;
  }
  if (unit !== 'ratio' && next < 0) {
    notices.add(`${field} was omitted because it was negative.`);
    return undefined;
  }
  return { value: next, unit, source };
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], field: string, notices: NoticeList): T | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' && value.length <= 32 && (allowed as readonly string[]).includes(value)) return value as T;
  notices.add(`${field} was omitted because it was not a recognized value.`);
  return null;
}

function capList<T>(items: T[], cap: number, label: string, notices: NoticeList): T[] {
  if (items.length <= cap) return items;
  notices.add(`The ${label} list is incomplete. ${items.length - cap} entries were not stored.`);
  return items.slice(0, cap);
}

function meanOf(values: number[]): number | null {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rejected(gameId: string, notice: string): RejectedSessionDetail {
  const notices = new NoticeList();
  notices.add(notice);
  return {
    detailVersion: 1,
    gameId: clipId(gameId) || 'unknown',
    status: 'rejected',
    notices: notices.items,
  };
}

function unsupported(version: unknown, prior?: unknown): UnsupportedSessionDetail {
  const notices = new NoticeList();
  notices.keep(prior);
  const submitted = boundedVersion(version);
  if (submitted != null && submitted !== SESSION_DETAIL_VERSION) {
    notices.add(`Detail version ${submitted} is not supported. Its measurements were not stored.`);
    return { status: 'unsupported_version', submittedVersion: submitted, notices: notices.items };
  }
  notices.add('Detail version is not supported. Its measurements were not stored.');
  return { status: 'unsupported_version', notices: notices.items };
}

function fit(detail: SessionDetail, notices: NoticeList): SessionDetail {
  const withNotices = { ...detail, notices: notices.items.slice(0, SESSION_DETAIL_MAX_NOTICES) };
  if (utf8Bytes(withNotices) <= SESSION_DETAIL_MAX_BYTES) return withNotices as SessionDetail;
  if (withNotices.status !== 'ok') {
    const gameId = 'gameId' in withNotices ? withNotices.gameId : 'unknown';
    return rejected(gameId, 'Detail was not stored because it exceeded the size limit.');
  }
  const stripped: SessionDetail = { ...withNotices };
  if ('trials' in stripped) delete stripped.trials;
  if ('rounds' in stripped) delete stripped.rounds;
  if ('sets' in stripped) delete stripped.sets;
  notices.add('The trial list was removed because the detail document exceeded the size limit.');
  const withoutLists = { ...stripped, notices: notices.items.slice(0, SESSION_DETAIL_MAX_NOTICES) };
  if (utf8Bytes(withoutLists) <= SESSION_DETAIL_MAX_BYTES) return withoutLists as SessionDetail;
  if ('formClasses' in withoutLists) delete withoutLists.formClasses;
  if ('eccentricityBins' in withoutLists) delete withoutLists.eccentricityBins;
  notices.add('Form and eccentricity bins were removed because the detail document exceeded the size limit.');
  const withoutBins = { ...withoutLists, notices: notices.items.slice(0, SESSION_DETAIL_MAX_NOTICES) };
  if (utf8Bytes(withoutBins) <= SESSION_DETAIL_MAX_BYTES) return withoutBins as SessionDetail;
  return rejected(
    'gameId' in withNotices ? withNotices.gameId : 'unknown',
    'Detail was not stored because it exceeded the size limit.',
  );
}

/** Copy finished Pursuit trials into plain values. Call this before the trial ref is cleared. */
export function copyCompletedPursuitTrials(
  trials: readonly Pick<PursuitTrialMetric, 'trialIndex' | 'outcome' | 'reactionTimeMs' | 'trackingErrorPx' | 'anticipationRatio'>[],
): PursuitCompletedTrial[] {
  return trials.map((trial) => ({
    trialIndex: trial.trialIndex,
    outcome: trial.outcome,
    reactionTimeMs: trial.reactionTimeMs,
    trackingErrorPx: trial.trackingErrorPx,
    anticipationRatio: trial.anticipationRatio,
  }));
}

function pursuitTrialsFrom(raw: unknown, notices: NoticeList): PursuitCompactTrial[] {
  if (!Array.isArray(raw)) return [];
  const rows: PursuitCompactTrial[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) continue;
    const outcome = enumValue(entry.outcome, ['correct', 'incorrect', 'timeout'] as const, 'Pursuit outcome', notices);
    const reactionTimeMs = measure(entry.reactionTimeMs, 'ms', 'measured', 'Pursuit reaction', notices);
    const trackingErrorPx = measure(entry.trackingErrorPx, 'px', 'measured', 'Pursuit tracking error', notices);
    const anticipationRatio = measure(entry.anticipationRatio, 'ratio', 'measured', 'Pursuit anticipation', notices);
    const trialIndex = measure(entry.trialIndex, 'count', 'measured', 'Pursuit trial index', notices);
    if (!outcome || !reactionTimeMs || !trackingErrorPx || !anticipationRatio || !trialIndex) continue;
    rows.push({
      trialIndex: trialIndex.value,
      outcome,
      reactionTimeMs,
      trackingErrorPx,
      anticipationRatio,
    });
  }
  return capList(rows, DETAIL_ARRAY_CAPS.pursuitTrials, 'Pursuit trial', notices);
}

function fullMean(raw: unknown, pick: (entry: Record<string, unknown>) => unknown): number | null {
  if (!Array.isArray(raw)) return null;
  const values: number[] = [];
  for (const entry of raw) {
    if (!isObject(entry)) return null;
    const numeric = isObject(pick(entry)) ? (pick(entry) as { value?: unknown }).value : pick(entry);
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) return null;
    values.push(numeric);
  }
  return meanOf(values);
}

export function sanitizeSessionDetail(sessionGameId: string, raw: unknown, fallback?: DetailExtractContext): SessionDetail | null {
  if (raw == null) return null;
  if (!isObject(raw)) return rejected(sessionGameId, 'Detail was not stored because it was not an object.');
  if (raw.status === 'unsupported_version') {
    return unsupported(raw.submittedVersion ?? raw.detailVersion, raw.notices);
  }
  const version = boundedVersion(raw.detailVersion);
  if (raw.detailVersion != null && version !== SESSION_DETAIL_VERSION) return unsupported(raw.detailVersion, raw.notices);
  if (version !== SESSION_DETAIL_VERSION) {
    return rejected(sessionGameId, 'Detail was not stored because its version was missing.');
  }
  if (raw.status === 'rejected') {
    const notices = new NoticeList();
    notices.keep(raw.notices);
    if (notices.items.length === 0) notices.add('Detail was not stored.');
    return {
      detailVersion: 1,
      gameId: clipId(raw.gameId) || clipId(sessionGameId) || 'unknown',
      status: 'rejected',
      notices: notices.items,
    };
  }
  const statedGame = clipId(raw.gameId);
  if (!statedGame || statedGame !== sessionGameId) {
    return rejected(sessionGameId, 'Detail was not stored because its game did not match this session.');
  }
  if (!TIER1.has(statedGame) && !TIER2.has(statedGame)) {
    return rejected(sessionGameId, 'Detail was not stored because this module has no detail document.');
  }
  const notices = new NoticeList();
  notices.keep(raw.notices);
  const context = contextFrom(raw, fallback, notices);
  const built = buildKnownDetail(statedGame, raw, context, notices);
  return fit(built, notices);
}

function buildKnownDetail(gameId: string, raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): SessionDetail {
  switch (gameId) {
    case 'rotatory':
      return buildRotatory(raw, context, notices);
    case 'bee_tracing':
      return buildBee(raw, context, notices);
    case 'pursuit':
      return buildPursuit(raw, context, notices);
    case 'geoboard':
      return buildGeoboard(raw, context, notices);
    case 'peripheral_view':
      return buildPeripheral(raw, context, notices);
    case 'direction_sense':
      return buildDirection(raw, context, notices);
    case 'mobile_target':
      return buildBubbleChase(raw, context, notices);
    case 'number_search':
      return { detailVersion: 1, status: 'ok', gameId, context, notices: [], timeLimitSec: measure(raw.timeLimitSec, 's', 'measured', 'Time limit', notices) };
    case 'pattern_match':
      return {
        detailVersion: 1,
        status: 'ok',
        gameId,
        context,
        notices: [],
        codeLength: measure(raw.codeLength, 'count', 'measured', 'Code length', notices),
        flashMs: measure(raw.flashMs, 'ms', 'measured', 'Flash time', notices),
        timeLimitSec: measure(raw.timeLimitSec, 's', 'measured', 'Time limit', notices),
        roundsCompleted: measure(raw.roundsCompleted, 'count', 'measured', 'Rounds completed', notices),
        stimulusMode: enumValue(raw.stimulusMode, ['digits', 'compound'] as const, 'Stimulus mode', notices),
      };
    case 'location_memory':
      return {
        detailVersion: 1,
        status: 'ok',
        gameId,
        context,
        notices: [],
        playMode: enumValue(raw.playMode, ['recall', 'pairs'] as const, 'Play mode', notices),
        exploreSec: measure(raw.exploreSec, 's', 'measured', 'Explore time', notices),
        recallSecPerTarget: measure(raw.recallSecPerTarget, 's', 'measured', 'Recall time', notices),
        roundsCompleted: measure(raw.roundsCompleted, 'count', 'measured', 'Rounds completed', notices),
        activeCellsConfigured: measure(raw.activeCellsConfigured, 'count', 'measured', 'Active cells', notices),
      };
    case 'familiar_faces':
      return {
        detailVersion: 1,
        status: 'ok',
        gameId,
        context,
        notices: [],
        flashMs: measure(raw.flashMs, 'ms', 'measured', 'Flash time', notices),
      };
    default:
      return rejected(gameId, 'Detail was not stored because this module has no detail document.');
  }
}

function buildRotatory(raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): RotatoryDetail {
  const trials = Array.isArray(raw.trials)
    ? capList(
        raw.trials.flatMap((entry) => {
          if (!isObject(entry)) return [];
          const outcome = enumValue(entry.outcome, ['correct', 'wrong_then_correct', 'invalid'] as const, 'Rotatory outcome', notices);
          const reactionMs = measure(entry.reactionMs, 'ms', 'measured', 'Rotatory reaction', notices);
          const wrongTaps = measure(entry.wrongTaps, 'count', 'measured', 'Rotatory wrong taps', notices);
          const aimTaps = measure(entry.aimTaps, 'count', 'measured', 'Rotatory aim taps', notices);
          const hemifield = enumValue(entry.hemifield, ['left', 'right', 'midline'] as const, 'Hemifield', notices);
          const glyphClass = enumValue(
            entry.glyphClass,
            ['simple_stroke', 'open_round', 'closed_round', 'dense_stroke', 'symmetric', 'diagonal', 'hue'] as const,
            'Glyph class',
            notices,
          );
          if (!outcome || !reactionMs || !wrongTaps || !aimTaps || !hemifield || !glyphClass || typeof entry.validForRt !== 'boolean') return [];
          return [{ outcome, reactionMs: reactionMs.value, wrongTaps: wrongTaps.value, aimTaps: aimTaps.value, hemifield, glyphClass, validForRt: entry.validForRt }];
        }),
        DETAIL_ARRAY_CAPS.rotatoryTrials,
        'Rotatory trial',
        notices,
      )
    : undefined;
  const bins = (key: 'formClasses' | 'eccentricityBins'): RotatoryDetailBin[] | undefined => {
    if (!Array.isArray(raw[key])) return undefined;
    return raw[key].flatMap((entry) => {
      if (!isObject(entry)) return [];
      const id = clipId(entry.id, 32);
      const n = measure(entry.n, 'count', 'derived', 'Bin count', notices);
      const median = measure(entry.medianRtSec, 's', 'derived', 'Bin median', notices);
      if (!id || !n || !median || typeof entry.sufficient !== 'boolean') return [];
      return [{ id, n: n.value, medianRtSec: median, sufficient: entry.sufficient }];
    });
  };
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'rotatory',
    context,
    notices: [],
    lateralityEligible: raw.lateralityEligible === true,
    lateralitySuppressedReason: clipId(raw.lateralitySuppressedReason, 64) || '',
    rotationDirection: enumValue(raw.rotationDirection, ['cw', 'ccw'] as const, 'Rotation direction', notices),
    leftFieldMedianRtSec: measure(raw.leftFieldMedianRtSec, 's', 'derived', 'Left field median', notices),
    rightFieldMedianRtSec: measure(raw.rightFieldMedianRtSec, 's', 'derived', 'Right field median', notices),
    leftFieldAccuracy: measure(raw.leftFieldAccuracy, 'percent', 'derived', 'Left field accuracy', notices),
    rightFieldAccuracy: measure(raw.rightFieldAccuracy, 'percent', 'derived', 'Right field accuracy', notices),
    iqrReactionSec: measure(raw.iqrReactionSec, 's', 'derived', 'Reaction spread', notices),
    cleanTrialMedianRtSec: measure(raw.cleanTrialMedianRtSec, 's', 'derived', 'Clean median', notices),
    cleanTapRate: measure(raw.cleanTapRate, 'proportion', 'derived', 'Clean tap rate', notices),
    discriminationErrorRate: measure(raw.discriminationErrorRate, 'proportion', 'derived', 'Discrimination rate', notices),
    motorMissRate: measure(raw.motorMissRate, 'proportion', 'derived', 'Motor miss rate', notices),
    fieldCrossingRate: measure(raw.fieldCrossingRate, 'proportion', 'derived', 'Field crossing rate', notices),
    formClasses: bins('formClasses'),
    eccentricityBins: bins('eccentricityBins'),
    trials,
  };
}

function buildBee(raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): BeeDetail {
  const rounds = Array.isArray(raw.rounds)
    ? capList(
        raw.rounds.flatMap((entry) => {
          if (!isObject(entry)) return [];
          const pathType = enumValue(entry.pathType, BEE_PATHS, 'Path type', notices);
          const accuracyPercent = measure(entry.accuracyPercent, 'percent', 'derived', 'Round adherence', notices);
          const completionTimeSec = measure(entry.completionTimeSec, 's', 'measured', 'Round time', notices);
          const deviationCount = measure(entry.deviationCount, 'count', 'measured', 'Round deviations', notices);
          const avgRecoveryTimeSec = measure(entry.avgRecoveryTimeSec, 's', 'derived', 'Round recovery', notices);
          if (!pathType || !accuracyPercent || !completionTimeSec || !deviationCount || !avgRecoveryTimeSec) return [];
          const round: BeeCompactRound = { pathType, accuracyPercent, completionTimeSec, deviationCount, avgRecoveryTimeSec };
          const reaction = measure(entry.reactionTimeMs, 'ms', 'measured', 'Grab time', notices);
          const orientation = enumValue(entry.orientation, ['landscape', 'portrait'] as const, 'Round orientation', notices);
          if (reaction) round.reactionTimeMs = reaction;
          if (orientation) round.orientation = orientation;
          return [round];
        }),
        DETAIL_ARRAY_CAPS.beeRounds,
        'Bee round',
        notices,
      )
    : undefined;
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'bee_tracing',
    context,
    notices: [],
    tracingMode: enumValue(raw.tracingMode, ['active', 'guided'] as const, 'Tracing mode', notices),
    toleranceBandPx: measure(raw.toleranceBandPx, 'px', 'measured', 'Tolerance band', notices),
    horizontalAccuracyPercent: measure(raw.horizontalAccuracyPercent, 'percent', 'derived', 'Horizontal adherence', notices),
    verticalAccuracyPercent: measure(raw.verticalAccuracyPercent, 'percent', 'derived', 'Vertical adherence', notices),
    rounds,
  };
}

function buildPursuit(raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): PursuitDetail {
  const fullError = fullMean(raw.trials, (entry) => entry.trackingErrorPx);
  const fullRatio = fullMean(raw.trials, (entry) => entry.anticipationRatio);
  const trials = pursuitTrialsFrom(raw.trials, notices);
  const statedError = measure(raw.avgTrackingErrorPx, 'px', 'derived', 'Tracking error', notices);
  const statedRatio = measure(raw.meanAnticipationRatio, 'ratio', 'derived', 'Anticipation', notices);
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'pursuit',
    context,
    notices: [],
    movementPattern: enumValue(raw.movementPattern, PURSUIT_PATTERNS, 'Movement pattern', notices),
    decoyCount: measure(raw.decoyCount, 'count', 'measured', 'Decoy count', notices),
    speedPxPerSec: measure(raw.speedPxPerSec, 'px/s', 'measured', 'Pursuit speed', notices),
    avgTrackingErrorPx: statedError || (fullError == null ? undefined : measure(fullError, 'px', 'derived', 'Tracking error', notices)),
    meanAnticipationRatio: statedRatio || (fullRatio == null ? undefined : measure(fullRatio, 'ratio', 'derived', 'Anticipation', notices)),
    trials: trials.length ? trials : undefined,
  };
}

function buildGeoboard(raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): GeoboardDetail {
  const trials = Array.isArray(raw.trials)
    ? capList(
        raw.trials.flatMap((entry) => {
          if (!isObject(entry)) return [];
          const patternId = clipId(entry.patternId);
          const errorType = enumValue(entry.errorType, ['none', 'wrong-dot', 'wrong-shape', 'incomplete'] as const, 'Pattern error', notices);
          const reactionTimeMs = measure(entry.reactionTimeMs, 'ms', 'measured', 'Pattern time', notices);
          const firstDotLatencyMs = measure(entry.firstDotLatencyMs, 'ms', 'measured', 'Planning time', notices);
          const corrections = measure(entry.corrections, 'count', 'measured', 'Corrections', notices);
          if (!patternId || !errorType || !reactionTimeMs || !firstDotLatencyMs || !corrections || typeof entry.correct !== 'boolean' || typeof entry.timedOut !== 'boolean') {
            return [];
          }
          return [{ patternId, correct: entry.correct, errorType, reactionTimeMs, firstDotLatencyMs, corrections, timedOut: entry.timedOut }];
        }),
        DETAIL_ARRAY_CAPS.geoboardTrials,
        'Pattern trial',
        notices,
      )
    : undefined;
  const breakdown = isObject(raw.errorBreakdown) ? raw.errorBreakdown : raw;
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'geoboard',
    context,
    notices: [],
    boardId: measure(raw.boardId, 'count', 'measured', 'Board', notices)?.value ?? null,
    wrongDot: measure(breakdown.wrongDot, 'count', 'derived', 'Missed dot', notices),
    wrongShape: measure(breakdown.wrongShape, 'count', 'derived', 'Missed shape', notices),
    incomplete: measure(breakdown.incomplete, 'count', 'derived', 'Incomplete pattern', notices),
    leftHalfAccuracy: measure(raw.leftHalfAccuracy, 'percent', 'derived', 'Left field', notices),
    rightHalfAccuracy: measure(raw.rightHalfAccuracy, 'percent', 'derived', 'Right field', notices),
    avgFirstDotLatencySec: measure(raw.avgFirstDotLatencySec, 's', 'derived', 'Planning time', notices),
    totalCorrections: measure(raw.totalCorrections, 'count', 'derived', 'Corrections', notices),
    trials,
  };
}

function buildPeripheral(raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): PeripheralDetail {
  const parsed: PeripheralCompactTrial[] = [];
  if (Array.isArray(raw.trials)) {
    for (const entry of raw.trials) {
      if (!isObject(entry)) continue;
      const outcome = enumValue(entry.outcome, ['correct', 'wrong', 'timeout', 'miss'] as const, 'Peripheral outcome', notices);
      if (!outcome) continue;
      if (entry.reactionMs == null) {
        parsed.push({ outcome, reactionMs: null });
        continue;
      }
      const reactionMs = measure(entry.reactionMs, 'ms', 'measured', 'Peripheral reaction', notices);
      if (reactionMs) parsed.push({ outcome, reactionMs });
    }
  }
  const trials = Array.isArray(raw.trials) ? capList(parsed, DETAIL_ARRAY_CAPS.peripheralTrials, 'Peripheral trial', notices) : undefined;
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'peripheral_view',
    context,
    notices: [],
    peripheralField: enumValue(raw.peripheralField, ['left', 'right', 'both'] as const, 'Peripheral field', notices),
    bubbleType: enumValue(raw.bubbleType, ['solid', 'boundary'] as const, 'Bubble type', notices),
    targetTimeoutSec: measure(raw.targetTimeoutSec, 's', 'measured', 'Target timeout', notices),
    trials,
  };
}

function buildDirection(raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): DirectionDetail {
  const transformMode = enumValue(raw.transformMode, ['face', 'flip', 'mixed', 'straighten'] as const, 'Transform', notices);
  const faceAllowed = transformMode === 'face' || transformMode === 'mixed';
  const flipAllowed = transformMode === 'flip' || transformMode === 'mixed';
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'direction_sense',
    context,
    notices: [],
    transformMode,
    choiceCount: measure(raw.choiceCount, 'count', 'measured', 'Choice count', notices),
    faceErrors: faceAllowed ? measure(raw.faceErrors, 'count', 'measured', 'Face errors', notices) : undefined,
    flipErrors: flipAllowed ? measure(raw.flipErrors, 'count', 'measured', 'Flip errors', notices) : undefined,
  };
}

function buildBubbleChase(raw: Record<string, unknown>, context: DetailContext, notices: NoticeList): BubbleChaseDetail {
  const sets = Array.isArray(raw.sets)
    ? capList(
        raw.sets.flatMap((entry) => {
          if (!isObject(entry)) return [];
          const outcome = enumValue(entry.outcome, ['correct', 'incorrect', 'timeout'] as const, 'Set outcome', notices);
          const reactionTimeMs = measure(entry.reactionTimeMs, 'ms', 'measured', 'Set reaction', notices);
          const wrongClicksCount = measure(entry.wrongClicksCount, 'count', 'measured', 'Wrong clicks', notices);
          const setIndex = measure(entry.setIndex, 'count', 'measured', 'Set index', notices);
          if (!outcome || !reactionTimeMs || !wrongClicksCount || !setIndex) return [];
          return [{ setIndex: setIndex.value, outcome, reactionTimeMs, wrongClicksCount }];
        }),
        DETAIL_ARRAY_CAPS.bubbleChaseSets,
        'Bubble Chase set',
        notices,
      )
    : undefined;
  return {
    detailVersion: 1,
    status: 'ok',
    gameId: 'mobile_target',
    context,
    notices: [],
    gameMode: enumValue(raw.gameMode, ['alphabets', 'numbers', 'colors'] as const, 'Game mode', notices),
    speedPxPerSec: measure(raw.speedPxPerSec, 'px/s', 'measured', 'Bubble Chase speed', notices),
    sets,
  };
}

function omitEmpty<T extends SessionDetail>(detail: T): T {
  const copy = { ...detail } as Record<string, unknown>;
  for (const [key, value] of Object.entries(copy)) {
    if (value === undefined) delete copy[key];
  }
  return copy as T;
}

function rotatoryDraft(data: RotatorySessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  const scored = (data.trials || []).filter((trial) => trial.phase === 'scored');
  return {
    detailVersion: 1,
    gameId: 'rotatory',
    context: { deviceTier: ctx.deviceTier ?? data.deviceTier ?? null, levelId: ctx.levelId ?? null },
    lateralityEligible: data.lateralityEligible,
    lateralitySuppressedReason: data.lateralitySuppressedReason,
    rotationDirection: data.rotationDirection,
    leftFieldMedianRtSec: data.leftFieldMedianRtSec > 0 ? data.leftFieldMedianRtSec : undefined,
    rightFieldMedianRtSec: data.rightFieldMedianRtSec > 0 ? data.rightFieldMedianRtSec : undefined,
    leftFieldAccuracy: data.leftFieldAccuracy,
    rightFieldAccuracy: data.rightFieldAccuracy,
    iqrReactionSec: data.iqrReactionSec,
    cleanTrialMedianRtSec: data.cleanTrialMedianRtSec,
    cleanTapRate: data.cleanTapRate,
    discriminationErrorRate: data.discriminationErrorRate,
    motorMissRate: data.motorMissRate,
    fieldCrossingRate: data.fieldCrossingRate,
    formClasses: Object.entries(data.formClasses || {}).map(([id, row]) => ({
      id,
      n: row.n,
      medianRtSec: row.medianRtSec,
      sufficient: row.sufficient,
    })),
    eccentricityBins: (data.eccentricityBins || []).map((row) => ({
      id: row.bin,
      n: row.n,
      medianRtSec: row.medianRtSec,
      sufficient: row.sufficient,
    })),
    trials: scored.map((trial: RotatoryTrialRecord) => ({
      outcome: trial.outcome,
      reactionMs: trial.reactionMs,
      wrongTaps: trial.wrongTaps,
      aimTaps: trial.aimTaps,
      hemifield: trial.onsetHemifield,
      glyphClass: trial.glyphClass,
      validForRt: trial.validForRt,
    })),
  };
}

function beeDraft(data: BeeSessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  return {
    detailVersion: 1,
    gameId: 'bee_tracing',
    context: { deviceTier: ctx.deviceTier ?? null, levelId: ctx.levelId ?? null },
    tracingMode: data.tracingMode,
    toleranceBandPx: data.toleranceBandPx,
    horizontalAccuracyPercent: data.horizontalAccuracyPercent,
    verticalAccuracyPercent: data.verticalAccuracyPercent,
    rounds: (data.roundResults || []).map((round: RoundResultData) => ({
      pathType: round.pathType,
      accuracyPercent: round.accuracyPercent,
      completionTimeSec: round.completionTimeSec,
      deviationCount: round.deviationCount,
      avgRecoveryTimeSec: round.avgRecoveryTimeSec,
      reactionTimeMs: round.reactionTimeMs,
      orientation: round.orientation,
    })),
  };
}

function pursuitDraft(data: PursuitSessionResultData & { completedTrials?: readonly PursuitCompletedTrial[]; meanAnticipationRatio?: number }, ctx: DetailExtractContext): Record<string, unknown> {
  const trials = data.completedTrials ? copyCompletedPursuitTrials(data.completedTrials) : [];
  const ratio = data.meanAnticipationRatio ?? meanOf(trials.map((trial) => trial.anticipationRatio));
  return {
    detailVersion: 1,
    gameId: 'pursuit',
    context: { deviceTier: ctx.deviceTier ?? null, levelId: ctx.levelId ?? null },
    movementPattern: data.movementPattern,
    decoyCount: data.decoyCount,
    speedPxPerSec: data.speedPxPerSec,
    avgTrackingErrorPx: data.avgTrackingErrorPx,
    meanAnticipationRatio: ratio,
    trials,
  };
}

/** Tier 1 alone, or Tier 1 and Tier 2. Sorting and Gaze Hold stay out. */
export function detailGamesForPayload(includeTier2: boolean): Set<string> {
  if (!includeTier2) return TIER1;
  const both = new Set<string>();
  TIER1.forEach((id) => both.add(id));
  TIER2.forEach((id) => both.add(id));
  return both;
}

export function extractSessionDetail(
  gameId: string,
  data: object,
  ctx: DetailExtractContext = {},
  includeTier2 = false,
): SessionDetail | null {
  const allowed = detailGamesForPayload(includeTier2);
  if (!allowed.has(gameId)) return null;
  const draft = draftFor(gameId, data, ctx);
  if (!draft) return null;
  return sanitizeSessionDetail(gameId, draft, ctx);
}

function draftFor(gameId: string, data: object, ctx: DetailExtractContext): Record<string, unknown> | null {
  switch (gameId) {
    case 'rotatory':
      return 'trials' in data && 'leftFieldAccuracy' in data ? rotatoryDraft(data as RotatorySessionResultData, ctx) : null;
    case 'bee_tracing':
      return 'roundResults' in data ? beeDraft(data as BeeSessionResultData, ctx) : null;
    case 'pursuit':
      return 'avgTrackingErrorPx' in data ? pursuitDraft(data as PursuitSessionResultData, ctx) : null;
    case 'geoboard':
      return 'boardId' in data && 'trials' in data ? geoboardDraft(data as GeoboardSessionResultData, ctx) : null;
    case 'peripheral_view':
      return 'peripheralField' in data ? peripheralDraft(data as PeripheralSessionResultData, ctx) : null;
    case 'direction_sense':
      return 'transformMode' in data ? directionDraft(data as DirectionSenseSessionResultData, ctx) : null;
    case 'mobile_target':
      return 'setMetrics' in data ? bubbleDraft(data as MobileTargetSessionResultData, ctx) : null;
    case 'number_search':
      return 'timeLimitSec' in data ? { detailVersion: 1, gameId, timeLimitSec: (data as NumberSearchSessionResultData).timeLimitSec, context: ctx } : null;
    case 'pattern_match':
      return 'stimulusMode' in data ? patternDraft(data as PatternMatchSessionResultData, ctx) : null;
    case 'location_memory':
      return 'playMode' in data ? locationDraft(data as LocationMemorySessionResultData, ctx) : null;
    case 'familiar_faces':
      return 'flashMs' in data ? { detailVersion: 1, gameId, flashMs: (data as FamiliarFacesSessionResultData).flashMs, context: ctx } : null;
    default:
      return null;
  }
}

function geoboardDraft(data: GeoboardSessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  return {
    detailVersion: 1,
    gameId: 'geoboard',
    context: { deviceTier: ctx.deviceTier ?? null, levelId: ctx.levelId ?? null },
    boardId: data.boardId,
    errorBreakdown: data.errorBreakdown,
    leftHalfAccuracy: data.leftHalfAccuracy,
    rightHalfAccuracy: data.rightHalfAccuracy,
    avgFirstDotLatencySec: data.avgFirstDotLatencySec,
    totalCorrections: data.totalCorrections,
    trials: (data.trials || []).map((trial: GeoboardTrialMetric) => ({
      patternId: trial.patternId,
      correct: trial.correct,
      errorType: trial.errorType,
      reactionTimeMs: trial.reactionTimeMs,
      firstDotLatencyMs: trial.firstDotLatencyMs,
      corrections: trial.corrections,
      timedOut: trial.timedOut,
    })),
  };
}

function peripheralDraft(data: PeripheralSessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  return {
    detailVersion: 1,
    gameId: 'peripheral_view',
    context: { deviceTier: ctx.deviceTier ?? data.deviceTier ?? null, levelId: ctx.levelId ?? null },
    peripheralField: data.peripheralField,
    bubbleType: data.bubbleType,
    targetTimeoutSec: data.targetTimeoutSec,
    trials: (data.trials || []).map((trial: PeripheralTrialRecord) => ({
      outcome: trial.outcome,
      reactionMs: trial.reactionMs,
    })),
  };
}

function directionDraft(data: DirectionSenseSessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  return {
    detailVersion: 1,
    gameId: 'direction_sense',
    context: { deviceTier: ctx.deviceTier ?? data.deviceTier ?? null, levelId: ctx.levelId ?? null },
    transformMode: data.transformMode,
    choiceCount: data.choiceCount,
    faceErrors: data.faceErrors,
    flipErrors: data.flipErrors,
  };
}

function bubbleDraft(data: MobileTargetSessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  return {
    detailVersion: 1,
    gameId: 'mobile_target',
    context: { deviceTier: ctx.deviceTier ?? null, levelId: ctx.levelId ?? null },
    gameMode: data.gameMode,
    speedPxPerSec: data.speedPxPerSec,
    sets: (data.setMetrics || []).map((set) => ({
      setIndex: set.setIndex,
      outcome: set.outcome,
      reactionTimeMs: set.reactionTimeMs,
      wrongClicksCount: set.wrongClicksCount,
    })),
  };
}

function patternDraft(data: PatternMatchSessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  return {
    detailVersion: 1,
    gameId: 'pattern_match',
    context: { deviceTier: ctx.deviceTier ?? data.deviceTier ?? null, levelId: ctx.levelId ?? null },
    codeLength: data.codeLength,
    flashMs: data.flashMs,
    timeLimitSec: data.timeLimitSec,
    roundsCompleted: data.roundsCompleted,
    stimulusMode: data.stimulusMode,
  };
}

function locationDraft(data: LocationMemorySessionResultData, ctx: DetailExtractContext): Record<string, unknown> {
  return {
    detailVersion: 1,
    gameId: 'location_memory',
    context: { deviceTier: ctx.deviceTier ?? data.deviceTier ?? null, levelId: ctx.levelId ?? null },
    playMode: data.playMode,
    exploreSec: data.exploreSec,
    recallSecPerTarget: data.recallSecPerTarget,
    roundsCompleted: data.roundsCompleted,
    activeCellsConfigured: data.activeCellsConfigured,
  };
}

/** Column value for a sanitized document. Unsupported versions do not claim version 1. */
export function persistedDetailVersion(detail: SessionDetail | null | undefined): number | null {
  if (!detail) return null;
  if (detail.status === 'unsupported_version') return null;
  return detail.detailVersion;
}

function sameMeasure(left: DetailMeasure | undefined, right: DetailMeasure | undefined): boolean {
  if (!left || !right) return false;
  return left.value === right.value && left.unit === right.unit;
}

/**
 * Technical check that both documents recorded the context this measurement needs.
 * A match is not a clinical comparison and does not combine sessions.
 */
export function recordedContextMatches(
  left: SessionDetail | null | undefined,
  right: SessionDetail | null | undefined,
  measurement: DetailMeasurementKey,
): boolean {
  if (!left || !right || left.status !== 'ok' || right.status !== 'ok') return false;
  if (left.gameId !== right.gameId) return false;
  if (!left.context.deviceTier || left.context.deviceTier !== right.context.deviceTier) return false;
  if (!left.context.levelId || left.context.levelId !== right.context.levelId) return false;
  switch (measurement) {
    case 'rotatory.hemifield':
      return (
        left.gameId === 'rotatory' &&
        right.gameId === 'rotatory' &&
        left.lateralityEligible === true &&
        right.lateralityEligible === true &&
        left.rotationDirection != null &&
        left.rotationDirection === right.rotationDirection
      );
    case 'rotatory.form':
      return left.gameId === 'rotatory' && right.gameId === 'rotatory';
    case 'bee.adherence':
    case 'bee.axis':
      return (
        left.gameId === 'bee_tracing' &&
        right.gameId === 'bee_tracing' &&
        left.tracingMode != null &&
        left.tracingMode === right.tracingMode &&
        sameMeasure(left.toleranceBandPx, right.toleranceBandPx)
      );
    case 'pursuit.tracking':
      return (
        left.gameId === 'pursuit' &&
        right.gameId === 'pursuit' &&
        left.movementPattern != null &&
        left.movementPattern === right.movementPattern &&
        sameMeasure(left.speedPxPerSec, right.speedPxPerSec) &&
        sameMeasure(left.decoyCount, right.decoyCount)
      );
    case 'geoboard.halfField':
      return left.gameId === 'geoboard' && right.gameId === 'geoboard' && left.boardId != null && left.boardId === right.boardId;
    case 'peripheral.outcome':
      return (
        left.gameId === 'peripheral_view' &&
        right.gameId === 'peripheral_view' &&
        left.peripheralField != null &&
        left.peripheralField === right.peripheralField &&
        left.bubbleType != null &&
        left.bubbleType === right.bubbleType &&
        sameMeasure(left.targetTimeoutSec, right.targetTimeoutSec)
      );
    case 'direction.errors':
      return (
        left.gameId === 'direction_sense' &&
        right.gameId === 'direction_sense' &&
        left.transformMode != null &&
        left.transformMode === right.transformMode &&
        sameMeasure(left.choiceCount, right.choiceCount)
      );
    case 'mobile_target.set':
      return (
        left.gameId === 'mobile_target' &&
        right.gameId === 'mobile_target' &&
        left.gameMode != null &&
        left.gameMode === right.gameMode &&
        sameMeasure(left.speedPxPerSec, right.speedPxPerSec)
      );
    default:
      return false;
  }
}

function formatMeasure(measure: DetailMeasure): string {
  if (measure.unit === 'percent') return `${measure.value}%`;
  if (measure.unit === 'px/s') return `${measure.value} px/s`;
  if (measure.unit === 'px') return `${measure.value} px`;
  if (measure.unit === 'ms') return `${measure.value} ms`;
  if (measure.unit === 's') return `${measure.value} s`;
  return String(measure.value);
}

function pushMeasure(lines: DoctorDetailLine[], label: string, value: DetailMeasure | null | undefined): void {
  if (!value) return;
  lines.push({ label, value: formatMeasure(value) });
}

/** Doctor-facing lines. Patient summaries do not use this function. */
export function formatDoctorDetail(detail: SessionDetail | null | undefined): DoctorDetailLine[] {
  if (!detail) return [];
  if (detail.status === 'unsupported_version') {
    const lines = detail.notices.map((notice) => ({ label: 'Detail', value: notice }));
    if (detail.submittedVersion != null) lines.unshift({ label: 'Submitted version', value: String(detail.submittedVersion) });
    return lines;
  }
  if (detail.status === 'rejected') return detail.notices.map((notice) => ({ label: 'Detail', value: notice }));
  const lines: DoctorDetailLine[] = [];
  if (detail.context.deviceTier) lines.push({ label: 'Device', value: detail.context.deviceTier });
  if (detail.context.levelId) lines.push({ label: 'Level id', value: detail.context.levelId });
  switch (detail.gameId) {
    case 'rotatory':
      pushMeasure(lines, 'Left field median', detail.leftFieldMedianRtSec);
      pushMeasure(lines, 'Right field median', detail.rightFieldMedianRtSec);
      pushMeasure(lines, 'Left field accuracy', detail.leftFieldAccuracy);
      pushMeasure(lines, 'Right field accuracy', detail.rightFieldAccuracy);
      pushMeasure(lines, 'Clean median', detail.cleanTrialMedianRtSec);
      pushMeasure(lines, 'Reaction spread', detail.iqrReactionSec);
      lines.push({ label: 'Laterality recorded', value: detail.lateralityEligible ? 'Yes' : 'No' });
      if (detail.trials) lines.push({ label: 'Trials stored', value: String(detail.trials.length) });
      break;
    case 'bee_tracing':
      pushMeasure(lines, 'Horizontal adherence', detail.horizontalAccuracyPercent);
      pushMeasure(lines, 'Vertical adherence', detail.verticalAccuracyPercent);
      pushMeasure(lines, 'Tolerance', detail.toleranceBandPx);
      if (detail.tracingMode) lines.push({ label: 'Tracing mode', value: detail.tracingMode });
      if (detail.rounds) lines.push({ label: 'Rounds stored', value: String(detail.rounds.length) });
      break;
    case 'pursuit':
      pushMeasure(lines, 'Tracking error', detail.avgTrackingErrorPx);
      pushMeasure(lines, 'Anticipation ratio', detail.meanAnticipationRatio);
      pushMeasure(lines, 'Speed', detail.speedPxPerSec);
      if (detail.movementPattern) lines.push({ label: 'Pattern', value: detail.movementPattern });
      if (detail.trials) lines.push({ label: 'Trials stored', value: String(detail.trials.length) });
      break;
    case 'geoboard':
      pushMeasure(lines, 'Left field', detail.leftHalfAccuracy);
      pushMeasure(lines, 'Right field', detail.rightHalfAccuracy);
      pushMeasure(lines, 'Missed dot', detail.wrongDot);
      pushMeasure(lines, 'Missed shape', detail.wrongShape);
      pushMeasure(lines, 'Incomplete', detail.incomplete);
      pushMeasure(lines, 'Planning time', detail.avgFirstDotLatencySec);
      pushMeasure(lines, 'Corrections', detail.totalCorrections);
      if (detail.trials) lines.push({ label: 'Trials stored', value: String(detail.trials.length) });
      break;
    case 'peripheral_view':
      if (detail.peripheralField) lines.push({ label: 'Field', value: detail.peripheralField });
      pushMeasure(lines, 'Target timeout', detail.targetTimeoutSec);
      if (detail.trials) lines.push({ label: 'Trials stored', value: String(detail.trials.length) });
      break;
    case 'direction_sense':
      if (detail.transformMode) lines.push({ label: 'Transform', value: detail.transformMode });
      pushMeasure(lines, 'Face errors', detail.faceErrors);
      pushMeasure(lines, 'Flip errors', detail.flipErrors);
      break;
    case 'mobile_target':
      pushMeasure(lines, 'Speed', detail.speedPxPerSec);
      if (detail.gameMode) lines.push({ label: 'Mode', value: detail.gameMode });
      if (detail.sets) lines.push({ label: 'Sets stored', value: String(detail.sets.length) });
      break;
    case 'number_search':
      pushMeasure(lines, 'Time limit', detail.timeLimitSec);
      break;
    case 'pattern_match':
      pushMeasure(lines, 'Code length', detail.codeLength);
      pushMeasure(lines, 'Flash time', detail.flashMs);
      pushMeasure(lines, 'Time limit', detail.timeLimitSec);
      pushMeasure(lines, 'Rounds completed', detail.roundsCompleted);
      break;
    case 'location_memory':
      if (detail.playMode) lines.push({ label: 'Play mode', value: detail.playMode });
      pushMeasure(lines, 'Explore time', detail.exploreSec);
      pushMeasure(lines, 'Recall time', detail.recallSecPerTarget);
      break;
    case 'familiar_faces':
      pushMeasure(lines, 'Flash time', detail.flashMs);
      break;
    default:
      break;
  }
  for (const notice of detail.notices) lines.push({ label: 'Note', value: notice });
  return lines;
}

export function stripUndefinedDetail<T extends SessionDetail>(detail: T): T {
  return omitEmpty(detail);
}
