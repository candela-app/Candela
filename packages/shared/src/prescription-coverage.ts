import { normalizeDirectionSenseLevelId } from './direction-sense-logic';
import { assertIanaTimeZone, calendarDayKey } from './game-session';
import { GAME_CATALOG, MODULE_LEVELS, isTherapyModuleId } from './game-registry';
import { buildLevelAnalytics, type LevelAnalyticsRow } from './level-analytics';

export const RECORDED_AT_FUTURE_SKEW_MS = 5 * 60 * 1000;

export const EMPTY_LEVELS_LABEL = 'Module assigned — no specific levels assigned';
export const RECORDED_NOT_ASSIGNED_LABEL = 'Recorded but not assigned';
export const PLAYABLE_EXCEPTION_NOTE = 'This level can be played without being in the assignment.';
export const BEFORE_HISTORY_LABEL = 'Saved before assignment history';
export const PREVIOUS_DOCTOR_LABEL = 'Previous prescribing doctor';
export const NO_SESSION_SAVED_LABEL = 'No session saved';
export const NO_ACTIVITIES_ASSIGNED_LABEL = 'No activities assigned';

/** Same bound as the practice-record overview. Kept local so the two calculations stay independent. */
export const PERIOD_SESSION_CAP = 2000;

const UTC_INSTANT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|([+-])(\d{2}):(\d{2}))$/;

export interface AssignmentSnapshot {
  moduleId: string;
  levels: string[];
}

export interface PrescriptionRevision {
  id: string;
  patientId: string;
  actorDoctorId: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  assignments: AssignmentSnapshot[];
}

export interface PrescriptionPracticeSession extends LevelAnalyticsRow {
  id: string;
  receivedAtMs: number;
  prescriptionRevisionId: string | null;
}

export type UnattributedReason =
  | 'timestamp_not_utc_instant'
  | 'timestamp_not_reliable'
  | 'before_history'
  | 'overlapping_assignments'
  | 'no_covering_assignment'
  | 'level_not_recorded'
  | 'direct_link_mismatch';

export type NotAssignedKind = 'game_not_assigned' | 'level_not_assigned' | 'playable_exception';

export type SessionClassification =
  | { status: 'linked'; revisionId: string; source: 'direct' | 'inferred' }
  | { status: 'unattributed'; reason: UnattributedReason }
  | { status: 'not_assigned'; revisionId: string; kind: NotAssignedKind };

export interface CoverageActivity {
  moduleId: string;
  moduleName: string;
  levelId: string;
  levelName: string;
  status: 'current' | 'no_longer_prescribed';
  sessionCount: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  availability: 'recorded' | 'none_saved';
  performanceLabel: string | null;
  performanceValue: number | null;
  reactionLabel: string | null;
  reactionMeanSec: number | null;
}

export interface ModuleWithoutLevels {
  moduleId: string;
  moduleName: string;
  label: typeof EMPTY_LEVELS_LABEL;
}

export interface DoctorRevisionView {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  actorDoctorId: string | null;
  actorLabel: string;
  assignments: AssignmentSnapshot[];
}

export interface DoctorSessionNote {
  id: string;
  gameId: string;
  levelId: string | null;
  levelName: string;
  recordedAt: string;
  label: string;
}

export interface DoctorUnattributedSession extends DoctorSessionNote {
  reason: UnattributedReason;
}

export interface DoctorNotAssignedSession extends DoctorSessionNote {
  kind: NotAssignedKind;
  note: string | null;
}

export interface DoctorPrescriptionAnalytics {
  modulesWithoutLevels: ModuleWithoutLevels[];
  activities: CoverageActivity[];
  revisions: DoctorRevisionView[];
  unattributed: DoctorUnattributedSession[];
  recordedButNotAssigned: DoctorNotAssignedSession[];
  invalidRevisionIds: string[];
}

export interface PatientPrescriptionPractice {
  modulesWithoutLevels: Array<{ moduleName: string; label: typeof EMPTY_LEVELS_LABEL }>;
  activities: Array<{
    moduleName: string;
    levelName: string;
    sessionCount: number;
    lastRecordedAt: string | null;
    availability: 'recorded' | 'none_saved';
  }>;
  emptyLabel: typeof NO_ACTIVITIES_ASSIGNED_LABEL | null;
}

export interface PeriodDay {
  date: string;
  sessionCount: number;
  performance: number | null;
}

export interface PeriodActivity extends CoverageActivity {
  daily: PeriodDay[];
}

export interface PrescriptionPeriod {
  from: string;
  to: string;
  timeZone: string;
  truncated: boolean;
  omitted: 'older' | null;
  /** True when older sessions were left out, so counts and performance are incomplete. */
  incomplete: boolean;
  cap: number;
  activities: PeriodActivity[];
  modulesWithoutLevels: ModuleWithoutLevels[];
  unattributed: DoctorUnattributedSession[];
  recordedButNotAssigned: DoctorNotAssignedSession[];
}

export interface PatientPrescriptionPeriod {
  from: string;
  to: string;
  timeZone: string;
  truncated: boolean;
  omitted: 'older' | null;
  incomplete: boolean;
  cap: number;
  modulesWithoutLevels: Array<{ moduleName: string; label: typeof EMPTY_LEVELS_LABEL }>;
  activities: PatientPrescriptionPractice['activities'];
  emptyLabel: typeof NO_ACTIVITIES_ASSIGNED_LABEL | null;
}

interface OpenWindow {
  revision: PrescriptionRevision;
  from: number;
  to: number | null;
}

/** A UTC instant requires Z or a numeric offset. Date.parse is not used. */
export function utcInstantMs(value: string): number | null {
  if (typeof value !== 'string') return null;
  const match = UTC_INSTANT.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const fraction = (match[7] || '').padEnd(3, '0').slice(0, 3);
  const millis = fraction ? Number(fraction) : 0;
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  let offsetMinutes = 0;
  if (match[8] !== 'Z') {
    const sign = match[9] === '-' ? -1 : 1;
    const offHour = Number(match[10]);
    const offMinute = Number(match[11]);
    if (offHour > 14 || offMinute > 59) return null;
    offsetMinutes = sign * (offHour * 60 + offMinute);
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute, second, millis);
  const instant = wall - offsetMinutes * 60_000;
  const back = new Date(instant + offsetMinutes * 60_000);
  if (
    back.getUTCFullYear() !== year ||
    back.getUTCMonth() !== month - 1 ||
    back.getUTCDate() !== day ||
    back.getUTCHours() !== hour ||
    back.getUTCMinutes() !== minute ||
    back.getUTCSeconds() !== second ||
    back.getUTCMilliseconds() !== millis
  ) {
    return null;
  }
  return instant;
}

export function actorLabel(
  actorDoctorId: string | null,
  names: Readonly<Record<string, string | null | undefined>>,
): string {
  if (!actorDoctorId) return PREVIOUS_DOCTOR_LABEL;
  const name = names[actorDoctorId];
  if (typeof name !== 'string' || name.trim() === '') return PREVIOUS_DOCTOR_LABEL;
  return name.trim();
}

function copyAssignments(assignments: readonly AssignmentSnapshot[]): AssignmentSnapshot[] {
  return assignments.map((assignment) => ({
    moduleId: assignment.moduleId,
    levels: assignment.levels.slice(),
  }));
}

function assignmentError(assignments: readonly AssignmentSnapshot[]): string | null {
  const seen = new Set<string>();
  for (const assignment of assignments) {
    if (!assignment.moduleId || seen.has(assignment.moduleId)) return 'duplicate_module';
    seen.add(assignment.moduleId);
    if (!Array.isArray(assignment.levels) || assignment.levels.some((level) => typeof level !== 'string')) {
      return 'invalid_levels';
    }
  }
  return null;
}

export function revisionWindow(revision: PrescriptionRevision): OpenWindow | null {
  const from = utcInstantMs(revision.effectiveFrom);
  if (from == null) return null;
  if (revision.effectiveTo == null) return { revision, from, to: null };
  const to = utcInstantMs(revision.effectiveTo);
  if (to == null || to <= from) return null;
  return { revision, from, to };
}

export function migrationSnapshot(input: {
  id: string;
  patientId: string;
  actorDoctorId: string | null;
  at: string;
  live: readonly AssignmentSnapshot[];
}): PrescriptionRevision | null {
  if (input.live.length === 0) return null;
  if (utcInstantMs(input.at) == null) return null;
  if (assignmentError(input.live)) return null;
  return {
    id: input.id,
    patientId: input.patientId,
    actorDoctorId: input.actorDoctorId,
    effectiveFrom: input.at,
    effectiveTo: null,
    assignments: copyAssignments(input.live),
  };
}

export function applyRevisionChange(
  state: { revisions: readonly PrescriptionRevision[]; live: readonly AssignmentSnapshot[] },
  change: { at: string; actorDoctorId: string | null; newRevisionId: string; patientId: string; nextLive: readonly AssignmentSnapshot[] },
):
  | { ok: true; revisions: PrescriptionRevision[]; live: AssignmentSnapshot[]; closedId: string | null; opened: PrescriptionRevision }
  | { ok: false; reason: string } {
  if (utcInstantMs(change.at) == null) return { ok: false, reason: 'invalid_period' };
  const assignmentProblem = assignmentError(change.nextLive);
  if (assignmentProblem) return { ok: false, reason: assignmentProblem };
  const open = state.revisions.filter((revision) => revision.effectiveTo == null);
  if (open.length > 1) return { ok: false, reason: 'overlapping_open_revisions' };
  const revisions = state.revisions.map((revision) => ({
    ...revision,
    assignments: copyAssignments(revision.assignments),
  }));
  let closedId: string | null = null;
  if (open.length === 1) {
    const current = revisions.find((revision) => revision.id === open[0].id);
    const from = current ? utcInstantMs(current.effectiveFrom) : null;
    const at = utcInstantMs(change.at);
    if (!current || from == null || at == null || at <= from) return { ok: false, reason: 'invalid_period' };
    current.effectiveTo = change.at;
    closedId = current.id;
  }
  const opened: PrescriptionRevision = {
    id: change.newRevisionId,
    patientId: change.patientId,
    actorDoctorId: change.actorDoctorId,
    effectiveFrom: change.at,
    effectiveTo: null,
    assignments: copyAssignments(change.nextLive),
  };
  revisions.push(opened);
  return { ok: true, revisions, live: copyAssignments(change.nextLive), closedId, opened };
}

/** A transfer does not move sessions or rewrite assignment history. */
export function prescriptionStateAfterTransfer<T>(state: T): T {
  return state;
}

function covers(window: OpenWindow, instant: number): boolean {
  return instant >= window.from && (window.to == null || instant < window.to);
}

function usableInstant(recordedAt: string, receivedAtMs: number): { ok: true; ms: number } | { ok: false; reason: 'timestamp_not_utc_instant' | 'timestamp_not_reliable' } {
  const ms = utcInstantMs(recordedAt);
  if (ms == null) return { ok: false, reason: 'timestamp_not_utc_instant' };
  if (!Number.isFinite(receivedAtMs) || ms > receivedAtMs + RECORDED_AT_FUTURE_SKEW_MS) {
    return { ok: false, reason: 'timestamp_not_reliable' };
  }
  return { ok: true, ms };
}

function assignedLevelId(moduleId: string, levelId: string, levels: readonly string[]): string | null {
  if (levels.includes(levelId)) return levelId;
  if (moduleId !== 'direction_sense') return null;
  const normalized = normalizeDirectionSenseLevelId(levelId);
  if (levels.includes(normalized)) return normalized;
  if (normalized === 'straighten' && levels.includes('mixed')) return 'mixed';
  return null;
}

function explicitlyAssigned(revision: PrescriptionRevision, gameId: string, levelId: string): boolean {
  const assignment = revision.assignments.find((item) => item.moduleId === gameId);
  if (!assignment) return false;
  return assignedLevelId(gameId, levelId, assignment.levels) != null;
}

function playableByException(moduleId: string, levelId: string, levels: readonly string[]): boolean {
  if (assignedLevelId(moduleId, levelId, levels)) return false;
  if (moduleId === 'geoboard' && levelId === '6') return true;
  if (moduleId === 'computer_vision' && levelId === 'stationary') return true;
  if (moduleId !== 'bee_tracing' && moduleId !== 'pursuit' && moduleId !== 'computer_vision') return false;
  if (!isTherapyModuleId(moduleId)) return false;
  const known = MODULE_LEVELS[moduleId].map((level) => level.id);
  const hasKnownAssignment = levels.some((level) => known.includes(level));
  return !hasKnownAssignment && known.includes(levelId);
}

function notAssignedKind(revision: PrescriptionRevision, gameId: string, levelId: string): NotAssignedKind {
  const assignment = revision.assignments.find((item) => item.moduleId === gameId);
  if (!assignment) return 'game_not_assigned';
  if (playableByException(gameId, levelId, assignment.levels)) return 'playable_exception';
  return 'level_not_assigned';
}

export function classifyRecordedSession(input: {
  recordedAt: string;
  gameId: string;
  levelId: string | null;
  receivedAtMs: number;
  prescriptionRevisionId: string | null;
  revisions: readonly PrescriptionRevision[];
}): SessionClassification {
  if (input.prescriptionRevisionId) {
    const linked = input.revisions.find((revision) => revision.id === input.prescriptionRevisionId);
    const window = linked ? revisionWindow(linked) : null;
    const recordedMs = utcInstantMs(input.recordedAt);
    if (
      !linked ||
      !window ||
      recordedMs == null ||
      !covers(window, recordedMs) ||
      !input.levelId ||
      !explicitlyAssigned(linked, input.gameId, input.levelId)
    ) {
      return { status: 'unattributed', reason: 'direct_link_mismatch' };
    }
    return { status: 'linked', revisionId: linked.id, source: 'direct' };
  }
  const instant = usableInstant(input.recordedAt, input.receivedAtMs);
  if (!instant.ok) return { status: 'unattributed', reason: instant.reason };
  const windows = input.revisions
    .map((revision) => revisionWindow(revision))
    .filter((window): window is OpenWindow => window != null);
  if (windows.length === 0) return { status: 'unattributed', reason: 'before_history' };
  const covering = windows.filter((window) => covers(window, instant.ms));
  if (covering.length > 1) return { status: 'unattributed', reason: 'overlapping_assignments' };
  if (covering.length === 0) {
    const earliest = windows.reduce((min, window) => Math.min(min, window.from), Number.POSITIVE_INFINITY);
    return { status: 'unattributed', reason: instant.ms < earliest ? 'before_history' : 'no_covering_assignment' };
  }
  const revision = covering[0].revision;
  if (!input.levelId) return { status: 'unattributed', reason: 'level_not_recorded' };
  if (!explicitlyAssigned(revision, input.gameId, input.levelId)) {
    return { status: 'not_assigned', revisionId: revision.id, kind: notAssignedKind(revision, input.gameId, input.levelId) };
  }
  return { status: 'linked', revisionId: revision.id, source: 'inferred' };
}

export function planNewSessionRevision(input: {
  existing: boolean;
  existingRevisionId: string | null;
  recordedAt: string;
  gameId: string;
  levelId: string | null;
  serverNowMs: number;
  revisions: readonly PrescriptionRevision[];
}): { prescriptionRevisionId: string | null } {
  if (input.existing) return { prescriptionRevisionId: input.existingRevisionId };
  const classified = classifyRecordedSession({
    recordedAt: input.recordedAt,
    gameId: input.gameId,
    levelId: input.levelId,
    receivedAtMs: input.serverNowMs,
    prescriptionRevisionId: null,
    revisions: input.revisions,
  });
  return { prescriptionRevisionId: classified.status === 'linked' ? classified.revisionId : null };
}

function moduleName(moduleId: string): string {
  return isTherapyModuleId(moduleId) ? GAME_CATALOG[moduleId].name : moduleId;
}

/** Catalog name for an assigned level. An unknown or retired id stays visible as stored. */
export function assignmentLevelName(moduleId: string, levelId: string): string {
  if (moduleId === 'direction_sense' && levelId === 'mixed') return 'Straighten';
  if (!isTherapyModuleId(moduleId)) return levelId;
  return MODULE_LEVELS[moduleId].find((level) => level.id === levelId)?.name ?? levelId;
}

function unattributedLabel(reason: UnattributedReason): string {
  if (reason === 'before_history') return BEFORE_HISTORY_LABEL;
  if (reason === 'timestamp_not_utc_instant') return 'The recorded time is not a UTC instant.';
  if (reason === 'timestamp_not_reliable') return 'The recorded time is too far after the session was received.';
  if (reason === 'overlapping_assignments') return 'More than one assignment covers this time.';
  if (reason === 'no_covering_assignment') return 'No assignment covers this time.';
  if (reason === 'level_not_recorded') return 'Level not recorded';
  return 'The stored assignment link does not match this session.';
}

function activityPairs(revision: PrescriptionRevision): Array<{ moduleId: string; levelId: string }> {
  const pairs: Array<{ moduleId: string; levelId: string }> = [];
  for (const assignment of revision.assignments) {
    const seen = new Set<string>();
    for (const levelId of assignment.levels) {
      if (!levelId || seen.has(levelId)) continue;
      seen.add(levelId);
      pairs.push({ moduleId: assignment.moduleId, levelId });
    }
  }
  return pairs;
}

export function buildDoctorPrescriptionAnalytics(input: {
  revisions: readonly PrescriptionRevision[];
  sessions: readonly PrescriptionPracticeSession[];
  actorNames?: Readonly<Record<string, string | null | undefined>>;
}): DoctorPrescriptionAnalytics {
  const names = input.actorNames ?? {};
  const invalidRevisionIds = input.revisions.filter((revision) => revisionWindow(revision) == null).map((revision) => revision.id);
  const open = input.revisions.filter((revision) => revision.effectiveTo == null && revisionWindow(revision));
  const current = open.length === 1 ? open[0] : null;
  const currentPairs = current ? activityPairs(current) : [];
  const currentKeys = new Set(currentPairs.map((pair) => `${pair.moduleId}\u0000${pair.levelId}`));
  const historical = new Map<string, { moduleId: string; levelId: string }>();
  for (const revision of input.revisions) {
    if (revisionWindow(revision) == null || revision.id === current?.id) continue;
    for (const pair of activityPairs(revision)) {
      const key = `${pair.moduleId}\u0000${pair.levelId}`;
      if (!currentKeys.has(key)) historical.set(key, pair);
    }
  }
  const linked = new Map<string, PrescriptionPracticeSession[]>();
  const unattributed: DoctorUnattributedSession[] = [];
  const recordedButNotAssigned: DoctorNotAssignedSession[] = [];
  for (const session of input.sessions) {
    const classified = classifyRecordedSession({
      recordedAt: session.recordedAt,
      gameId: session.gameId,
      levelId: session.levelId,
      receivedAtMs: session.receivedAtMs,
      prescriptionRevisionId: session.prescriptionRevisionId,
      revisions: input.revisions,
    });
    const base = {
      id: session.id,
      gameId: session.gameId,
      levelId: session.levelId,
      levelName: session.levelId ? assignmentLevelName(session.gameId, session.levelId) : 'Level not recorded',
      recordedAt: session.recordedAt,
    };
    if (classified.status === 'unattributed') {
      unattributed.push({ ...base, reason: classified.reason, label: unattributedLabel(classified.reason) });
      continue;
    }
    if (classified.status === 'not_assigned') {
      recordedButNotAssigned.push({
        ...base,
        kind: classified.kind,
        label: RECORDED_NOT_ASSIGNED_LABEL,
        note: classified.kind === 'playable_exception' ? PLAYABLE_EXCEPTION_NOTE : null,
      });
      continue;
    }
    const revision = input.revisions.find((item) => item.id === classified.revisionId);
    if (!revision || !session.levelId) continue;
    const assignment = revision.assignments.find((item) => item.moduleId === session.gameId);
    const levelId = assignment ? assignedLevelId(session.gameId, session.levelId, assignment.levels) : null;
    if (!levelId) continue;
    const key = `${session.gameId}\u0000${levelId}`;
    const list = linked.get(key) ?? [];
    list.push(session);
    linked.set(key, list);
  }
  const pairs = [
    ...currentPairs.map((pair) => ({ ...pair, status: 'current' as const })),
    ...Array.from(historical.values()).map((pair) => ({ ...pair, status: 'no_longer_prescribed' as const })),
  ];
  const activities = pairs.map((pair) => {
    const rows = linked.get(`${pair.moduleId}\u0000${pair.levelId}`) ?? [];
    const ordered = rows.slice().sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    const analytics = buildLevelAnalytics({
      gameId: pair.moduleId,
      levelId: pair.levelId,
      timeZone: 'UTC',
      rows: ordered.map((row) => ({ ...row, gameId: pair.moduleId, levelId: pair.levelId })),
    });
    const performance = analytics.status === 'ok' ? analytics : null;
    return {
      moduleId: pair.moduleId,
      moduleName: moduleName(pair.moduleId),
      levelId: pair.levelId,
      levelName: assignmentLevelName(pair.moduleId, pair.levelId),
      status: pair.status,
      sessionCount: ordered.length,
      firstRecordedAt: ordered[0]?.recordedAt ?? null,
      lastRecordedAt: ordered[ordered.length - 1]?.recordedAt ?? null,
      availability: ordered.length > 0 ? 'recorded' as const : 'none_saved' as const,
      performanceLabel: performance?.performanceLabel ?? null,
      performanceValue: performance?.performanceValue ?? null,
      reactionLabel: performance?.reactionLabel ?? null,
      reactionMeanSec: performance?.reactionMeanSec ?? null,
    };
  });
  return {
    modulesWithoutLevels: (current?.assignments ?? [])
      .filter((assignment) => assignment.levels.length === 0)
      .map((assignment) => ({
        moduleId: assignment.moduleId,
        moduleName: moduleName(assignment.moduleId),
        label: EMPTY_LEVELS_LABEL,
      })),
    activities,
    revisions: input.revisions.map((revision) => ({
      id: revision.id,
      effectiveFrom: revision.effectiveFrom,
      effectiveTo: revision.effectiveTo,
      actorDoctorId: revision.actorDoctorId,
      actorLabel: actorLabel(revision.actorDoctorId, names),
      assignments: copyAssignments(revision.assignments),
    })),
    unattributed,
    recordedButNotAssigned,
    invalidRevisionIds,
  };
}

const LOCAL_DAY = /^\d{4}-\d{2}-\d{2}$/;

function assertLocalDay(value: string): string {
  if (!LOCAL_DAY.test(value)) throw new Error('Invalid prescription period');
  const [year, month, day] = value.split('-').map(Number);
  const utc = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    throw new Error('Invalid prescription period');
  }
  return value;
}

function revisionOverlapsRange(revision: PrescriptionRevision, start: number, end: number): boolean {
  const window = revisionWindow(revision);
  if (!window) return false;
  const to = window.to ?? Number.POSITIVE_INFINITY;
  return window.from < end && to > start;
}

function keptPeriodSessions(sessions: readonly PrescriptionPracticeSession[]): {
  rows: PrescriptionPracticeSession[];
  truncated: boolean;
} {
  const newestFirst = sessions.slice().sort((a, b) => {
    const byTime = b.recordedAt.localeCompare(a.recordedAt);
    return byTime === 0 ? b.id.localeCompare(a.id) : byTime;
  });
  const truncated = newestFirst.length > PERIOD_SESSION_CAP;
  return { rows: newestFirst.slice(0, PERIOD_SESSION_CAP).reverse(), truncated };
}

export function buildPrescriptionPeriod(input: {
  revisions: readonly PrescriptionRevision[];
  sessions: readonly PrescriptionPracticeSession[];
  from: string;
  to: string;
  timeZone: string;
  localFrom: string;
  localTo: string;
}): PrescriptionPeriod {
  const timeZone = assertIanaTimeZone(input.timeZone);
  const start = utcInstantMs(input.from);
  const end = utcInstantMs(input.to);
  const localFrom = assertLocalDay(input.localFrom);
  const localTo = assertLocalDay(input.localTo);
  if (start == null || end == null || end <= start || localFrom > localTo) {
    throw new Error('Invalid prescription period');
  }
  const inRange = input.sessions.filter((session) => {
    const ms = utcInstantMs(session.recordedAt);
    if (ms == null || ms < start || ms >= end) return false;
    const day = calendarDayKey(session.recordedAt, timeZone);
    return day !== 'unknown' && day >= localFrom && day <= localTo;
  });
  const selected = keptPeriodSessions(inRange);
  const open = input.revisions.filter((revision) => revision.effectiveTo == null && revisionWindow(revision));
  const current = open.length === 1 ? open[0] : null;
  const currentPairs = current ? activityPairs(current) : [];
  const currentKeys = new Set(currentPairs.map((pair) => `${pair.moduleId}\u0000${pair.levelId}`));
  const historical = new Map<string, { moduleId: string; levelId: string }>();
  for (const revision of input.revisions) {
    if (!revisionOverlapsRange(revision, start, end) || revision.id === current?.id) continue;
    for (const pair of activityPairs(revision)) {
      const key = `${pair.moduleId}\u0000${pair.levelId}`;
      if (!currentKeys.has(key)) historical.set(key, pair);
    }
  }
  const linked = new Map<string, PrescriptionPracticeSession[]>();
  const unattributed: DoctorUnattributedSession[] = [];
  const recordedButNotAssigned: DoctorNotAssignedSession[] = [];
  for (const session of selected.rows) {
    const classified = classifyRecordedSession({
      recordedAt: session.recordedAt,
      gameId: session.gameId,
      levelId: session.levelId,
      receivedAtMs: session.receivedAtMs,
      prescriptionRevisionId: session.prescriptionRevisionId,
      revisions: input.revisions,
    });
    const base = {
      id: session.id,
      gameId: session.gameId,
      levelId: session.levelId,
      levelName: session.levelId ? assignmentLevelName(session.gameId, session.levelId) : 'Level not recorded',
      recordedAt: session.recordedAt,
    };
    if (classified.status === 'unattributed') {
      unattributed.push({ ...base, reason: classified.reason, label: unattributedLabel(classified.reason) });
      continue;
    }
    if (classified.status === 'not_assigned') {
      recordedButNotAssigned.push({
        ...base,
        kind: classified.kind,
        label: RECORDED_NOT_ASSIGNED_LABEL,
        note: classified.kind === 'playable_exception' ? PLAYABLE_EXCEPTION_NOTE : null,
      });
      continue;
    }
    const revision = input.revisions.find((item) => item.id === classified.revisionId);
    if (!revision || !session.levelId) continue;
    const assignment = revision.assignments.find((item) => item.moduleId === session.gameId);
    const levelId = assignment ? assignedLevelId(session.gameId, session.levelId, assignment.levels) : null;
    if (!levelId) continue;
    const key = `${session.gameId}\u0000${levelId}`;
    const list = linked.get(key) ?? [];
    list.push(session);
    linked.set(key, list);
  }
  const pairs = [
    ...currentPairs.map((pair) => ({ ...pair, status: 'current' as const })),
    ...Array.from(historical.values()).map((pair) => ({ ...pair, status: 'no_longer_prescribed' as const })),
  ];
  const activities = pairs.map((pair) => {
    const ordered = (linked.get(`${pair.moduleId}\u0000${pair.levelId}`) ?? [])
      .slice()
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt) || a.id.localeCompare(b.id));
    const mapped = ordered.map((row) => ({ ...row, gameId: pair.moduleId, levelId: pair.levelId }));
    const analytics =
      mapped.length > 0
        ? buildLevelAnalytics({ gameId: pair.moduleId, levelId: pair.levelId, timeZone, rows: mapped })
        : null;
    const performance = analytics && analytics.status === 'ok' ? analytics : null;
    const byDay = new Map<string, typeof mapped>();
    for (const row of mapped) {
      const date = calendarDayKey(row.recordedAt, timeZone);
      const dayRows = byDay.get(date) ?? [];
      dayRows.push(row);
      byDay.set(date, dayRows);
    }
    const daily = Array.from(byDay.keys())
      .sort()
      .map((date) => {
        const dayRows = byDay.get(date) ?? [];
        const dayAnalytics = buildLevelAnalytics({
          gameId: pair.moduleId,
          levelId: pair.levelId,
          timeZone,
          rows: dayRows,
        });
        return {
          date,
          sessionCount: dayRows.length,
          performance: dayAnalytics.status === 'ok' ? dayAnalytics.performanceValue : null,
        };
      });
    return {
      moduleId: pair.moduleId,
      moduleName: moduleName(pair.moduleId),
      levelId: pair.levelId,
      levelName: assignmentLevelName(pair.moduleId, pair.levelId),
      status: pair.status,
      sessionCount: ordered.length,
      firstRecordedAt: ordered[0]?.recordedAt ?? null,
      lastRecordedAt: ordered[ordered.length - 1]?.recordedAt ?? null,
      availability: ordered.length > 0 ? ('recorded' as const) : ('none_saved' as const),
      performanceLabel: performance?.performanceLabel ?? null,
      performanceValue: performance?.performanceValue ?? null,
      reactionLabel: performance?.reactionLabel ?? null,
      reactionMeanSec: performance?.reactionMeanSec ?? null,
      daily,
    };
  });
  return {
    from: localFrom,
    to: localTo,
    timeZone,
    truncated: selected.truncated,
    omitted: selected.truncated ? 'older' : null,
    incomplete: selected.truncated,
    cap: PERIOD_SESSION_CAP,
    activities,
    modulesWithoutLevels: (current?.assignments ?? [])
      .filter((assignment) => assignment.levels.length === 0)
      .map((assignment) => ({
        moduleId: assignment.moduleId,
        moduleName: moduleName(assignment.moduleId),
        label: EMPTY_LEVELS_LABEL,
      })),
    unattributed,
    recordedButNotAssigned,
  };
}

export function projectPatientPrescriptionPeriod(period: PrescriptionPeriod): PatientPrescriptionPeriod {
  const projected = projectPatientPrescriptionPractice({
    modulesWithoutLevels: period.modulesWithoutLevels,
    activities: period.activities,
    revisions: [],
    unattributed: [],
    recordedButNotAssigned: [],
    invalidRevisionIds: [],
  });
  return {
    from: period.from,
    to: period.to,
    timeZone: period.timeZone,
    truncated: period.truncated,
    omitted: period.omitted,
    incomplete: period.incomplete,
    cap: period.cap,
    modulesWithoutLevels: projected.modulesWithoutLevels,
    activities: projected.activities,
    emptyLabel: projected.emptyLabel,
  };
}

export function projectPatientPrescriptionPractice(analytics: DoctorPrescriptionAnalytics): PatientPrescriptionPractice {
  const activities = analytics.activities
    .filter((activity) => activity.status === 'current')
    .map((activity) => ({
      moduleName: activity.moduleName,
      levelName: activity.levelName,
      sessionCount: activity.sessionCount,
      lastRecordedAt: activity.lastRecordedAt,
      availability: activity.availability,
    }));
  const modulesWithoutLevels = analytics.modulesWithoutLevels.map((module) => ({
    moduleName: module.moduleName,
    label: module.label,
  }));
  return {
    modulesWithoutLevels,
    activities,
    emptyLabel: activities.length === 0 && modulesWithoutLevels.length === 0 ? NO_ACTIVITIES_ASSIGNED_LABEL : null,
  };
}

/** Clock collision guard for revision boundaries. This does not rewrite a session time. */
export function revisionInstantAfter(previousFrom: string, at: string): string | null {
  const from = utcInstantMs(previousFrom);
  const next = utcInstantMs(at);
  if (from == null || next == null) return null;
  if (next > from) return at;
  return new Date(from + 1).toISOString();
}
