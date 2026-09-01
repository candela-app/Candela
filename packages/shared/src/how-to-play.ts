import { GAME_CATALOG } from './game-registry';
import type { TherapyModuleId } from './types';

export interface HowToPlayStep {
  title: string;
  body: string;
}

export interface HowToPlayGuide {
  moduleId: TherapyModuleId;
  title: string;
  subtitle: string;
  steps: HowToPlayStep[];
}

export const HOW_TO_PLAY: Record<TherapyModuleId, HowToPlayGuide> = {
  rotatory: {
    moduleId: 'rotatory',
    title: GAME_CATALOG.rotatory.name,
    subtitle: 'Pop the matching bubble on the spinning wheel',
    steps: [
      { title: 'Watch the wheel', body: 'Bubbles ride around the spinning wheel. Keep your eyes on them as they turn.' },
      { title: 'Find the target', body: 'A letter, number, or color is called. That is the one to pop.' },
      { title: 'Tap the match', body: 'Tap only the matching bubble. Wrong taps count as misses.' },
    ],
  },
  sorting: {
    moduleId: 'sorting',
    title: GAME_CATALOG.sorting.name,
    subtitle: 'Tap the next item in order',
    steps: [
      { title: 'See the set', body: 'Letters or numbers sit on the field. You will sort them in sequence.' },
      { title: 'Go in order', body: 'A then B then C, or 1 then 2 then 3 — always the next one.' },
      { title: 'Tap the next', body: 'Tap only the next item. Skip-ahead or wrong taps are misses.' },
    ],
  },
  bee_tracing: {
    moduleId: 'bee_tracing',
    title: GAME_CATALOG.bee_tracing.name,
    subtitle: 'Follow the bee along the path',
    steps: [
      { title: 'Find the path', body: 'A bee flies along a line. That line is the route to follow.' },
      { title: 'Stay on the line', body: 'Trace with your finger. Stay on the path — drifting off is a miss.' },
      { title: 'Finish the route', body: 'Reach the end of the path to complete the round.' },
    ],
  },
  pursuit: {
    moduleId: 'pursuit',
    title: GAME_CATALOG.pursuit.name,
    subtitle: 'Track the glowing target and tap it',
    steps: [
      { title: 'Watch the target', body: 'One bubble is the target. It keeps moving across the screen.' },
      { title: 'Ignore decoys', body: 'Other bubbles try to distract you. Do not tap those.' },
      { title: 'Tap when you can', body: 'Keep tracking, then tap the target. Several short trials make one session.' },
    ],
  },
  mobile_target: {
    moduleId: 'mobile_target',
    title: GAME_CATALOG.mobile_target.name,
    subtitle: 'Tap the bouncing target, not the decoy',
    steps: [
      { title: 'Two bubbles bounce', body: 'Targets bounce around the dark field. One is the match.' },
      { title: 'Tap the match', body: 'Tap the called letter, number, or color. Leave the decoy alone.' },
      { title: 'Finish the set', body: 'Each set is timed. Keep going until the set ends.' },
    ],
  },
  geoboard: {
    moduleId: 'geoboard',
    title: GAME_CATALOG.geoboard.name,
    subtitle: 'Look, remember, then draw the same pattern',
    steps: [
      { title: 'Study the figure', body: 'A pattern is shown on the board. Look at the lines carefully.' },
      { title: 'Draw it back', body: 'Connect the dots to rebuild the same figure on your board.' },
      { title: 'Match the shape', body: 'Match the model as closely as you can before time is up.' },
    ],
  },
  peripheral_view: {
    moduleId: 'peripheral_view',
    title: GAME_CATALOG.peripheral_view.name,
    subtitle: 'Keep eyes on center. Tap letters to the side',
    steps: [
      { title: 'Hold the center', body: 'Keep looking at the center mark. Do not turn to look at the sides.' },
      { title: 'Letters appear out wide', body: 'Letters pop on the left, right, or both fields around you.' },
      { title: 'Tap what you notice', body: 'Tap the letter you see or hear — while your eyes stay in the middle.' },
    ],
  },
  number_search: {
    moduleId: 'number_search',
    title: GAME_CATALOG.number_search.name,
    subtitle: 'Find digits hidden in a crowd of letters',
    steps: [
      { title: 'Scan the crowd', body: 'Digits hide among mixed letters. Look carefully across the field.' },
      { title: 'Find the next number', body: 'Search in order — the next digit you need is the one to tap.' },
      { title: 'Tap each find', body: 'Tap every digit as you find it until the search is done.' },
    ],
  },
  pattern_match: {
    moduleId: 'pattern_match',
    title: GAME_CATALOG.pattern_match.name,
    subtitle: 'Hold the flashed code, then tap every exact match',
    steps: [
      { title: 'See the code', body: 'A code flashes briefly. Hold it in your mind.' },
      { title: 'Scan the field', body: 'Many similar codes appear. Most are near-misses, not exact.' },
      { title: 'Tap exact matches', body: 'Tap every code that matches exactly. Skip the look-alikes.' },
    ],
  },
  location_memory: {
    moduleId: 'location_memory',
    title: GAME_CATALOG.location_memory.name,
    subtitle: 'Remember where each number sat, then tap them back',
    steps: [
      { title: 'Peek the grid', body: 'Numbers hide in cells. Open one cell at a time and remember where it was.' },
      { title: 'Hold the map', body: 'When the grid hides again, keep a picture of each number’s place.' },
      { title: 'Tap them back', body: 'Tap the cells in the right order to show where each number was.' },
    ],
  },
  direction_sense: {
    moduleId: 'direction_sense',
    title: GAME_CATALOG.direction_sense.name,
    subtitle: 'See the turn, then pick the matching letter',
    steps: [
      { title: 'See the letter and arrow', body: 'A letter is shown with a rotate arrow — that is the turn to imagine.' },
      { title: 'Turn it in your head', body: 'Imagine the letter rotating 90° the way the arrow points.' },
      { title: 'Pick the match', body: 'Tap the option that matches the turned letter.' },
    ],
  },
  computer_vision: {
    moduleId: 'computer_vision',
    title: GAME_CATALOG.computer_vision.name,
    subtitle: 'Track the bright target and pop it by looking',
    steps: [
      { title: 'Face the camera', body: 'Keep your face in view. The session pauses if the camera loses you.' },
      { title: 'Watch the bright bubble', body: 'One bubble is bright. Dim bubbles are decoys — ignore those.' },
      { title: 'Look to pop', body: 'Hold your look on the bright target until it pops. Several short trials make one session.' },
    ],
  },
};

export const HOW_TO_PLAY_CLAP_STEP: HowToPlayStep = {
  title: 'Clap along at the end',
  body: 'When the results card opens, clap along to celebrate finishing the session.',
};

export function getHowToPlay(moduleId: TherapyModuleId): HowToPlayGuide {
  const guide = HOW_TO_PLAY[moduleId];
  return { ...guide, steps: [...guide.steps, HOW_TO_PLAY_CLAP_STEP] };
}
