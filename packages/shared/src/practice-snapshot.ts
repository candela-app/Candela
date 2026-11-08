import { GAME_CATALOG, isTherapyModuleId } from './game-registry';
import { OVERVIEW_SESSION_CAP } from './practice-insights';
import { assignmentLevelName } from './prescription-coverage';

export interface PracticeSnapshotSession {
  recordedAt: string;
  gameId: string;
  gameName?: string | null;
  levelId: string | null;
}

export interface SavedPracticeSummary {
  sessionCount: number;
  availability: 'recorded' | 'none_saved';
  last: {
    recordedAt: string;
    gameId: string;
    gameName: string;
    levelId: string | null;
    levelName: string;
  } | null;
}

export interface PracticeSnapshot {
  sessionCount: number;
  lastRecordedAt: string | null;
  lastGameId: string | null;
  lastGameName: string | null;
  lastLevelId: string | null;
  lastLevelName: string | null;
  availability: 'recorded' | 'none_saved';
}

const EMPTY_SNAPSHOT: PracticeSnapshot = {
  sessionCount: 0,
  lastRecordedAt: null,
  lastGameId: null,
  lastGameName: null,
  lastLevelId: null,
  lastLevelName: null,
  availability: 'none_saved',
};

function gameLabel(gameId: string, storedName?: string | null): string {
  if (isTherapyModuleId(gameId)) return GAME_CATALOG[gameId].name;
  const stored = storedName?.trim();
  return stored || gameId;
}

/** Saved-session count and the newest saved session. This snapshot has no score. */
export function buildPracticeSnapshot(input: {
  sessionCount: number;
  latest: PracticeSnapshotSession | null;
}): PracticeSnapshot {
  const count = Number.isFinite(input.sessionCount) ? Math.max(0, Math.floor(input.sessionCount)) : 0;
  if (count === 0 || !input.latest) return { ...EMPTY_SNAPSHOT };
  const levelId = input.latest.levelId || null;
  return {
    sessionCount: count,
    lastRecordedAt: input.latest.recordedAt,
    lastGameId: input.latest.gameId,
    lastGameName: gameLabel(input.latest.gameId, input.latest.gameName),
    lastLevelId: levelId,
    lastLevelName: levelId ? assignmentLevelName(input.latest.gameId, levelId) : null,
    availability: 'recorded',
  };
}

/**
 * Streak still uses the sessions already loaded for history.
 * That list is the newest 2,000 rows, so a larger saved-session count means this is not a lifetime streak.
 */
export function streakCoverageNote(input: { sessionCount: number; loadedCount: number; streak: number }): string {
  if (input.sessionCount <= 0) return 'No session saved';
  const capped = input.loadedCount < input.sessionCount;
  const limited = `the newest ${OVERVIEW_SESSION_CAP.toLocaleString('en-US')} loaded sessions`;
  if (input.streak > 0) {
    return capped
      ? `Consecutive days in ${limited}. This is not every saved session.`
      : 'Consecutive days with a saved session';
  }
  return capped
    ? `No current streak in ${limited}. This is not every saved session.`
    : 'No current streak';
}
