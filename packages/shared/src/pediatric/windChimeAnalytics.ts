import { CadenceWindow, ChimeSessionAnalytics, ChimeStrikeEvent } from './windChimeTypes';

export function computeChimeSessionAnalytics(
  events: ChimeStrikeEvent[],
  sessionDurationSec: number
): ChimeSessionAnalytics {
  const total = events.length;

  if (total === 0) {
    return {
      totalStrikes: 0,
      directStrikes: 0,
      clapperStrikes: 0,
      ambientStrikes: 0,
      leftStrikes: 0,
      centerStrikes: 0,
      rightStrikes: 0,
      lateralSymmetryPercent: 50,
      gentleCount: 0,
      moderateCount: 0,
      heavyCount: 0,
      forceModulationGrade: 'well_graded',
      averageListeningDwellSec: 0,
      longestListeningPauseSec: 0,
      sensoryCalmingIndex: 50,
      cadenceTimeline: [],
      badge: {
        title: 'Gentle Observer',
        description: 'Explored the wind chime with mindful listening.',
        emoji: '🌿',
      },
    };
  }

  let directCount = 0;
  let clapperCount = 0;
  let ambientCount = 0;

  let leftCount = 0;
  let centerCount = 0;
  let rightCount = 0;

  let gentleCount = 0;
  let moderateCount = 0;
  let heavyCount = 0;

  const dwellTimesSec: number[] = [];
  let longestPauseSec = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];

    if (ev.source === 'direct_touch') directCount++;
    else if (ev.source === 'clapper_strike') clapperCount++;
    else ambientCount++;

    if (ev.lateralPosition === 'left') leftCount++;
    else if (ev.lateralPosition === 'center') centerCount++;
    else rightCount++;

    if (ev.forceCategory === 'gentle') gentleCount++;
    else if (ev.forceCategory === 'moderate') moderateCount++;
    else heavyCount++;

    if (i > 0) {
      const deltaSec = (ev.timestampMs - events[i - 1].timestampMs) / 1000;
      dwellTimesSec.push(deltaSec);
      if (deltaSec > longestPauseSec) {
        longestPauseSec = deltaSec;
      }
    }
  }

  const averageListeningDwellSec =
    dwellTimesSec.length > 0
      ? Number((dwellTimesSec.reduce((a, b) => a + b, 0) / dwellTimesSec.length).toFixed(1))
      : 0;

  // Lateral Symmetry: ratio between Left and Right touches
  const sideTotal = leftCount + rightCount;
  let lateralSymmetryPercent = 50;
  if (sideTotal > 0) {
    const leftRatio = leftCount / sideTotal;
    const rightRatio = rightCount / sideTotal;
    lateralSymmetryPercent = Math.round(100 - Math.abs(leftRatio - rightRatio) * 100);
  }

  // Force modulation
  let forceModulationGrade: 'well_graded' | 'predominantly_gentle' | 'predominantly_heavy' = 'well_graded';
  if (heavyCount / total > 0.55) {
    forceModulationGrade = 'predominantly_heavy';
  } else if (gentleCount / total > 0.65) {
    forceModulationGrade = 'predominantly_gentle';
  }

  // Cadence Windows (10-second buckets)
  const windowSizeSec = 10;
  const effectiveDuration = Math.max(sessionDurationSec, events[events.length - 1].timestampMs / 1000);
  const numWindows = Math.max(1, Math.ceil(effectiveDuration / windowSizeSec));
  const cadenceTimeline: CadenceWindow[] = [];

  const firstEventMs = events[0].timestampMs;

  for (let w = 0; w < numWindows; w++) {
    const wStartSec = w * windowSizeSec;
    const wEndSec = (w + 1) * windowSizeSec;

    const strikesInWindow = events.filter((ev) => {
      const evSec = (ev.timestampMs - firstEventMs) / 1000;
      return evSec >= wStartSec && evSec < wEndSec;
    }).length;

    // Pace in strikes per minute (BPM)
    const paceBpm = Math.round((strikesInWindow / windowSizeSec) * 60);

    cadenceTimeline.push({
      windowStartSec: wStartSec,
      windowEndSec: wEndSec,
      strikeCount: strikesInWindow,
      paceBpm,
    });
  }

  // Sensory Calming Index (Down-regulation indicator)
  // Compares early pace vs late pace
  let sensoryCalmingIndex = 75;
  if (cadenceTimeline.length >= 3) {
    const firstPace = cadenceTimeline[0].paceBpm;
    const lastPace = cadenceTimeline[cadenceTimeline.length - 1].paceBpm;
    if (firstPace > 0 && lastPace <= firstPace) {
      // Pace lowered or stabilized!
      const dropRatio = (firstPace - lastPace) / firstPace;
      sensoryCalmingIndex = Math.min(98, Math.max(65, Math.round(75 + dropRatio * 20)));
    } else if (lastPace > firstPace * 1.5) {
      // Escalated tapping
      sensoryCalmingIndex = Math.max(35, Math.round(70 - ((lastPace - firstPace) / lastPace) * 25));
    }
  }

  // Pediatric achievement badge determination
  let badge = {
    title: 'Peaceful Harmonizer',
    description: 'Created soothing melodies and displayed gentle listening.',
    emoji: '🎶',
  };

  if (averageListeningDwellSec >= 2.5) {
    badge = {
      title: 'Mindful Listener',
      description: 'Waited patiently for sound reverberations before striking.',
      emoji: '🧘',
    };
  } else if (lateralSymmetryPercent >= 85 && sideTotal >= 6) {
    badge = {
      title: 'Bilateral Balance Master',
      description: 'Explored both left and right chimes with great motor symmetry.',
      emoji: '⚖️',
    };
  } else if (clapperCount > directCount && clapperCount >= 5) {
    badge = {
      title: 'Wind Harnesser',
      description: 'Discovered pendulum mechanics by swaying the sail and striker.',
      emoji: '🎐',
    };
  } else if (forceModulationGrade === 'well_graded') {
    badge = {
      title: 'Gentle Touch Maestro',
      description: 'Showed wonderful control between soft and expressive strikes.',
      emoji: '🪶',
    };
  }

  return {
    totalStrikes: total,
    directStrikes: directCount,
    clapperStrikes: clapperCount,
    ambientStrikes: ambientCount,
    leftStrikes: leftCount,
    centerStrikes: centerCount,
    rightStrikes: rightCount,
    lateralSymmetryPercent,
    gentleCount,
    moderateCount,
    heavyCount,
    forceModulationGrade,
    averageListeningDwellSec,
    longestListeningPauseSec: Number(longestPauseSec.toFixed(1)),
    sensoryCalmingIndex,
    cadenceTimeline,
    badge,
  };
}
