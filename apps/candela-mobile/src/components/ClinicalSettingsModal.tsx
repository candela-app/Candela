import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FloatingLabelInput } from './FloatingLabelInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  SPEED_PRESETS,
  THERAPY_COLOR_ITEMS,
  DEFAULT_SORTING_NUMBER_FROM,
  DEFAULT_SORTING_NUMBER_TO,
  MAX_SORTING_NUMBER_COUNT,
  WHEEL_COLOR_PRESETS,
  wheelColorLabel,
  clampSortingNumberRange,
  clampBatchesPerSession,
  clampHexSizePx,
  clampPeripheralLetterSize,
  clampPeripheralTargetTimeoutSec,
  clampStimuliCount,
  clampNumberSearchFieldCount,
  clampNumberSearchLayoutMode,
  clampNumberSearchLetterSize,
  clampNumberSearchTargetDigits,
  clampNumberSearchTimeLimitSec,
  clampPatternMatchCellCount,
  clampPatternMatchCodeLength,
  clampPatternMatchFlashMs,
  clampPatternMatchHardness,
  clampPatternMatchLetterSize,
  clampPatternMatchRounds,
  clampPatternMatchStimulusMode,
  clampPatternMatchTimeLimitSec,
  DEFAULT_BUBBLE_APPEARANCE,
  DEFAULT_NUMBER_SEARCH_BG,
  DEFAULT_NUMBER_SEARCH_CHAR_COLOR,
  DEFAULT_NUMBER_SEARCH_FIELD_COUNT,
  DEFAULT_NUMBER_SEARCH_LAYOUT,
  DEFAULT_NUMBER_SEARCH_TARGET_DIGITS,
  DEFAULT_NUMBER_SEARCH_TIME_LIMIT_SEC,
  DEFAULT_PATTERN_MATCH_BG,
  DEFAULT_PATTERN_MATCH_CELL_COUNT,
  DEFAULT_PATTERN_MATCH_CHAR_COLOR,
  DEFAULT_PATTERN_MATCH_CODE_LENGTH,
  DEFAULT_PATTERN_MATCH_FLASH_MS,
  DEFAULT_PATTERN_MATCH_HARDNESS,
  DEFAULT_PATTERN_MATCH_ROUNDS,
  DEFAULT_PATTERN_MATCH_STIMULUS,
  DEFAULT_PERIPHERAL_BG_COLOR,
  DEFAULT_PERIPHERAL_BUBBLE_TYPE,
  DEFAULT_PERIPHERAL_FIXATION_COLOR,
  DEFAULT_PERIPHERAL_STIMULUS_COLOR,
  DEFAULT_STIMULI_BUBBLE_COLOR,
  getDeviceTier,
  hexVertices,
  NUMBER_SEARCH_BG_COLORS,
  NUMBER_SEARCH_CHAR_COLORS,
  NUMBER_SEARCH_FIELD_COUNT_PRESETS,
  NUMBER_SEARCH_LETTER_SIZE_PRESETS,
  NUMBER_SEARCH_TARGET_DIGIT_PRESETS,
  NUMBER_SEARCH_TIME_LIMIT_PRESETS,
  PATTERN_MATCH_BG_COLORS,
  PATTERN_MATCH_CELL_COUNT_PRESETS,
  PATTERN_MATCH_CHAR_COLORS,
  PATTERN_MATCH_CODE_LENGTH_PRESETS,
  PATTERN_MATCH_FLASH_MS_PRESETS,
  PATTERN_MATCH_LETTER_SIZE_PRESETS,
  PATTERN_MATCH_ROUNDS_PRESETS,
  PATTERN_MATCH_TIME_LIMIT_PRESETS,
  patternMatchFlashLabel,
  patternMatchHardnessLabel,
  patternMatchPreviewCodes,
  clampLocationMemoryActiveCells,
  clampLocationMemoryExploreSec,
  clampLocationMemoryGridSize,
  clampLocationMemoryLetterSize,
  clampLocationMemoryRecallSec,
  clampLocationMemoryRounds,
  DEFAULT_LOCATION_MEMORY_ACTIVE_CELLS,
  DEFAULT_LOCATION_MEMORY_BG,
  DEFAULT_LOCATION_MEMORY_CHAR_COLOR,
  DEFAULT_LOCATION_MEMORY_EXPLORE_SEC,
  DEFAULT_LOCATION_MEMORY_GRID_SIZE,
  DEFAULT_LOCATION_MEMORY_RECALL_SEC,
  DEFAULT_LOCATION_MEMORY_ROUNDS,
  LOCATION_MEMORY_BG_COLORS,
  LOCATION_MEMORY_CHAR_COLORS,
  LOCATION_MEMORY_EXPLORE_SEC_PRESETS,
  LOCATION_MEMORY_GRID_SIZE_PRESETS,
  LOCATION_MEMORY_LETTER_SIZE_PRESETS,
  LOCATION_MEMORY_RECALL_SEC_PRESETS,
  LOCATION_MEMORY_ROUNDS_PRESETS,
  locationMemoryActiveCellOptions,
  locationMemoryExploreLabel,
  locationMemoryGridLabel,
  locationMemoryRecallLabel,
  clampDirectionSenseChoiceCount,
  clampDirectionSenseShapeSize,
  clampDirectionSenseTimeLimitSec,
  clampDirectionSenseTrials,
  clampDirectionSenseTurnDirection,
  DEFAULT_DIRECTION_SENSE_ARROW_COLOR,
  DEFAULT_DIRECTION_SENSE_BG,
  DEFAULT_DIRECTION_SENSE_CHOICE_COUNT,
  DEFAULT_DIRECTION_SENSE_SHAPE_COLOR,
  DEFAULT_DIRECTION_SENSE_SHAPE_SIZE,
  DEFAULT_DIRECTION_SENSE_TRIALS,
  DEFAULT_DIRECTION_SENSE_TURN_DIRECTION,
  DIRECTION_SENSE_ARROW_STROKE_WIDTH,
  DIRECTION_SENSE_BG_COLORS,
  DIRECTION_SENSE_CHOICE_COUNT_PRESETS,
  DIRECTION_SENSE_SHAPE_COLORS,
  DIRECTION_SENSE_SHAPE_PATHS,
  DIRECTION_SENSE_SHAPE_SIZE_PRESETS,
  DIRECTION_SENSE_SHAPE_STROKE_WIDTH,
  DIRECTION_SENSE_TIME_LIMIT_PRESETS,
  DIRECTION_SENSE_TRIALS_PRESETS,
  directionSenseArrowTransform,
  directionSenseCurvedArrowPath,
  directionSensePoseTransform,
  directionSenseTurnDirectionLabel,
  type DirectionSenseTurnDirection,
  peripheralHexPaint,
  peripheralLetterColor,
  peripheralLetterFontPx,
  peripheralMaxStimuliCount,
  peripheralStimuliPresets,
  PERIPHERAL_BATCH_PRESETS,
  PERIPHERAL_BG_COLORS,
  PERIPHERAL_DEFAULT_BATCHES,
  PERIPHERAL_HEX_SIZE_PRESETS,
  PERIPHERAL_LETTER_SIZE_PRESETS,
  PERIPHERAL_STIMULUS_COLORS,
  PERIPHERAL_TARGET_TIMEOUT_PRESETS,
  resolveBubblePaint,
  resolveStimuliBubbleColor,
  STIMULI_BUBBLE_COLOR_OPTIONS,
  STIMULI_COLOR_MIXED,
  type BubbleAppearance,
  type NumberSearchLayoutMode,
  type PatternMatchHardness,
  type PatternMatchStimulusMode,
  type PeripheralBubbleType,
} from '@candela/shared/rn';
import type { DeviceOrientation, PursuitMovementPattern, PursuitTargetColor } from '@candela/shared/rn';
import Svg, { Circle, Path, Polygon, Text as SvgText } from 'react-native-svg';
import { useLayout } from '../lib/layout';

export interface AppliedClinicalSettings {
  patientName: string;
  letterSize: number;
  bubbleSize: number;
  speed?: number;
  wheelColor?: string;
  tracingMode?: 'active' | 'guided';
  pathType?: string;
  toleranceBandPx?: number;
  colorTheme?: 'standard' | 'high_contrast' | 'dark';
  audioEnabled?: boolean;
  roundsPerSet?: number;
  pathComplexity?: 'short' | 'medium' | 'long';
  beeSpeedSec?: number;
  orientation?: DeviceOrientation;
  pursuitMovementPattern?: PursuitMovementPattern;
  pursuitTargetColor?: PursuitTargetColor;
  pursuitDecoyCount?: number;
  pursuitSpeedPxPerSec?: number;
  pursuitTrialTimeoutSec?: number;
  therapyColors?: string[];
  numberRangeFrom?: number;
  numberRangeTo?: number;
  hexSizePx?: number;
  stimuliCount?: number;
  batchesPerSession?: number;
  stimulusColor?: string;
  /** Letter/number bubble fill (hex or `mixed`). Not used for color-discrimination. */
  stimuliColor?: string;
  bubbleAppearance?: BubbleAppearance;
  fixationDotColor?: string;
  bgColor?: string;
  /** Crowded Search glyph / character color */
  shapeColor?: string;
  peripheralTargetTimeoutSec?: number;
  peripheralBubbleType?: PeripheralBubbleType;
  targetDigitCount?: number;
  timeLimitSec?: number;
  numberSearchLayout?: NumberSearchLayoutMode;
  numberSearchFieldCount?: number;
  /** Hold the Code */
  patternMatchCodeLength?: number;
  patternMatchFlashMs?: number;
  patternMatchCellCount?: number;
  patternMatchHardness?: PatternMatchHardness;
  patternMatchRounds?: number;
  locationMemoryActiveCells?: number;
  locationMemoryRounds?: number;
  locationMemoryExploreSec?: number;
  locationMemoryRecallSec?: number;
  locationMemoryGridSize?: number;
  /** Direction Sense: response options per trial (3–4). */
  directionSenseChoiceCount?: number;
  /** Direction Sense: trials per session. */
  directionSenseTrials?: number;
  /** Direction Sense: probe/option shape diameter px. */
  directionSenseShapeSizePx?: number;
  /** Direction Sense: clockwise vs anticlockwise turns. */
  directionSenseTurnDirection?: DirectionSenseTurnDirection;
}

const LETTER_SIZES = [1, 1.5, 2, 2.5, 3];
const BUBBLE_SIZES = [60, 80, 100, 120];
const WHEEL_COLORS = WHEEL_COLOR_PRESETS;
const PATH_TYPES = ['auto', 'straight', 'curve', 'zigzag', 'wave', 'spiral', 'branching', 'dotted', 'random'];
const PURSUIT_PATTERN_OPTIONS: { val: PursuitMovementPattern; label: string }[] = [
  { val: 'linear_bounce', label: '1. Linear Bounce (Straight Wall Bounces)' },
  { val: 'circular_orbit', label: '2. Circular / Elliptical Orbit' },
  { val: 'figure_eight', label: '3. Figure-8 Wave' },
  { val: 'random_walk', label: '4. Random Walk with Momentum' },
  { val: 'freeze_drift', label: '5. Freeze & Drift' },
];
const PURSUIT_COLOR_OPTIONS: { label: string; val: PursuitTargetColor; text: string }[] = [
  { label: 'Cyan', val: '#00E5FF', text: '#000000' },
  { label: 'Yellow', val: '#FFD600', text: '#000000' },
  { label: 'White', val: '#FFFFFF', text: '#000000' },
];
const PURSUIT_BUBBLE_SIZES = [50, 60, 70, 80, 90, 100, 110, 120, 130];
const PURSUIT_SPEEDS = [
  { label: 'Slow (110 px/s)', val: 110 },
  { label: 'Normal (180 px/s)', val: 180 },
  { label: 'Fast (260 px/s)', val: 260 },
];
const DEFAULT_THERAPY_COLORS = THERAPY_COLOR_ITEMS.map((item) => item.code);
const PURSUIT_TIMEOUTS = [
  { label: 'Off', val: 0 },
  { label: '4s', val: 4 },
  { label: '5s', val: 5 },
  { label: '6s', val: 6 },
];
const HEX_SIZE_STEPS = [...PERIPHERAL_HEX_SIZE_PRESETS];
const BATCHES_STEPS = [...PERIPHERAL_BATCH_PRESETS];

function nearestStep(values: number[], n: number) {
  return values.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), values[0]);
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { fs, s } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: s(10),
        paddingVertical: s(8),
        borderRadius: s(10),
        marginRight: s(8),
        marginBottom: s(8),
        backgroundColor: active ? '#2563EB' : '#1F2937',
        borderWidth: 1,
        borderColor: active ? '#60A5FA' : '#374151',
      }}
    >
      <Text style={{ color: '#fff', fontSize: fs(12), fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function StepSlider({
  values,
  value,
  onChange,
  format = String,
}: {
  values: number[];
  value: number;
  onChange: (n: number) => void;
  format?: (n: number) => string;
}) {
  const { fs, s } = useLayout();
  const snapped = nearestStep(values, value);
  const idx = Math.max(0, values.indexOf(snapped));
  const pct = values.length > 1 ? idx / (values.length - 1) : 0;
  return (
    <View>
      <View style={{ height: s(10), backgroundColor: '#141414', borderRadius: s(6), overflow: 'hidden', marginVertical: s(8) }}>
        <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: '#3B82F6' }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {values.map((n) => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
            <Text style={{ color: n === snapped ? '#60A5FA' : '#9CA3AF', fontSize: fs(11), fontWeight: '700' }}>
              {format(n)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function Card({ children }: { children: ReactNode }) {
  const { s } = useLayout();
  return (
    <View
      style={{
        backgroundColor: '#242424',
        borderRadius: s(16),
        borderWidth: 1,
        borderColor: '#1F2937',
        padding: s(16),
        marginBottom: s(12),
      }}
    >
      {children}
    </View>
  );
}

export function ClinicalSettingsModal({
  isOpen,
  onClose,
  onApply,
  patientName,
  letterSize,
  bubbleSize,
  speed = 1,
  wheelColor = '#000000',
  showSpeedControl = false,
  showWheelColorControl = false,
  wheelColorTitle = 'Wheel Color',
  wheelColorHint = 'Background color of the spinning wheel.',
  sampleSymbol = 'A',
  showBeeTracingControls = false,
  tracingMode = 'active',
  pathType = 'auto',
  toleranceBandPx = 40,
  colorTheme = 'dark',
  audioEnabled = true,
  roundsPerSet = 10,
  pathComplexity = 'medium',
  beeSpeedSec = 5,
  orientation = 'auto',
  showPursuitControls = false,
  pursuitMovementPattern = 'linear_bounce',
  pursuitTargetColor = '#00E5FF',
  pursuitDecoyCount = 2,
  pursuitSpeedPxPerSec = 110,
  pursuitTrialTimeoutSec = 0,
  showTherapyColorPicker = false,
  therapyColors = DEFAULT_THERAPY_COLORS,
  showStimuliColorPicker = false,
  stimuliColor = DEFAULT_STIMULI_BUBBLE_COLOR,
  showBubbleAppearancePicker = false,
  bubbleAppearance = DEFAULT_BUBBLE_APPEARANCE,
  showLetterSizeControl = true,
  showNumberRangeControl = false,
  numberRangeFrom = DEFAULT_SORTING_NUMBER_FROM,
  numberRangeTo = DEFAULT_SORTING_NUMBER_TO,
  showPeripheralViewControls = false,
  showNumberSearchControls = false,
  showPatternMatchControls = false,
  showLocationMemoryControls = false,
  showDirectionSenseControls = false,
  directionSenseStraightenMode = false,
  sessionLocked = false,
  hexSizePx = 64,
  stimuliCount = 16,
  batchesPerSession = PERIPHERAL_DEFAULT_BATCHES,
  stimulusColor = DEFAULT_PERIPHERAL_STIMULUS_COLOR,
  fixationDotColor = DEFAULT_PERIPHERAL_FIXATION_COLOR,
  bgColor = DEFAULT_PERIPHERAL_BG_COLOR,
  shapeColor = DEFAULT_NUMBER_SEARCH_CHAR_COLOR,
  peripheralTargetTimeoutSec = 0,
  peripheralBubbleType = DEFAULT_PERIPHERAL_BUBBLE_TYPE,
  targetDigitCount = DEFAULT_NUMBER_SEARCH_TARGET_DIGITS,
  timeLimitSec = DEFAULT_NUMBER_SEARCH_TIME_LIMIT_SEC,
  numberSearchLayout = DEFAULT_NUMBER_SEARCH_LAYOUT,
  numberSearchFieldCount = DEFAULT_NUMBER_SEARCH_FIELD_COUNT,
  patternMatchCodeLength = DEFAULT_PATTERN_MATCH_CODE_LENGTH,
  patternMatchFlashMs = DEFAULT_PATTERN_MATCH_FLASH_MS,
  patternMatchCellCount = DEFAULT_PATTERN_MATCH_CELL_COUNT,
  patternMatchHardness = DEFAULT_PATTERN_MATCH_HARDNESS,
  patternMatchRounds = DEFAULT_PATTERN_MATCH_ROUNDS,
  patternMatchStimulusMode = DEFAULT_PATTERN_MATCH_STIMULUS,
  locationMemoryActiveCells = DEFAULT_LOCATION_MEMORY_ACTIVE_CELLS,
  locationMemoryRounds = DEFAULT_LOCATION_MEMORY_ROUNDS,
  locationMemoryExploreSec = DEFAULT_LOCATION_MEMORY_EXPLORE_SEC,
  locationMemoryRecallSec = DEFAULT_LOCATION_MEMORY_RECALL_SEC,
  locationMemoryGridSize = DEFAULT_LOCATION_MEMORY_GRID_SIZE,
  directionSenseChoiceCount = DEFAULT_DIRECTION_SENSE_CHOICE_COUNT,
  directionSenseTrials = DEFAULT_DIRECTION_SENSE_TRIALS,
  directionSenseShapeSizePx = DEFAULT_DIRECTION_SENSE_SHAPE_SIZE,
  directionSenseTurnDirection = DEFAULT_DIRECTION_SENSE_TURN_DIRECTION,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (settings: AppliedClinicalSettings) => void;
  patientName: string;
  letterSize: number;
  bubbleSize: number;
  speed?: number;
  wheelColor?: string;
  showSpeedControl?: boolean;
  showWheelColorControl?: boolean;
  wheelColorTitle?: string;
  wheelColorHint?: string;
  sampleSymbol?: string;
  showBeeTracingControls?: boolean;
  tracingMode?: 'active' | 'guided';
  pathType?: string;
  toleranceBandPx?: number;
  colorTheme?: 'standard' | 'high_contrast' | 'dark';
  audioEnabled?: boolean;
  roundsPerSet?: number;
  pathComplexity?: 'short' | 'medium' | 'long';
  beeSpeedSec?: number;
  orientation?: DeviceOrientation;
  showPursuitControls?: boolean;
  pursuitMovementPattern?: PursuitMovementPattern;
  pursuitTargetColor?: PursuitTargetColor;
  pursuitDecoyCount?: number;
  pursuitSpeedPxPerSec?: number;
  pursuitTrialTimeoutSec?: number;
  showTherapyColorPicker?: boolean;
  therapyColors?: string[];
  /** Letter/number bubble fill picker (White default + therapy colors + Mixed). Hide for color-discrimination modes. */
  showStimuliColorPicker?: boolean;
  stimuliColor?: string;
  showBubbleAppearancePicker?: boolean;
  bubbleAppearance?: BubbleAppearance;
  showLetterSizeControl?: boolean;
  showNumberRangeControl?: boolean;
  numberRangeFrom?: number;
  numberRangeTo?: number;
  showPeripheralViewControls?: boolean;
  showNumberSearchControls?: boolean;
  showPatternMatchControls?: boolean;
  showLocationMemoryControls?: boolean;
  showDirectionSenseControls?: boolean;
  directionSenseStraightenMode?: boolean;
  sessionLocked?: boolean;
  hexSizePx?: number;
  stimuliCount?: number;
  batchesPerSession?: number;
  stimulusColor?: string;
  fixationDotColor?: string;
  bgColor?: string;
  shapeColor?: string;
  peripheralTargetTimeoutSec?: number;
  peripheralBubbleType?: PeripheralBubbleType;
  targetDigitCount?: number;
  timeLimitSec?: number;
  numberSearchLayout?: NumberSearchLayoutMode;
  numberSearchFieldCount?: number;
  patternMatchCodeLength?: number;
  patternMatchFlashMs?: number;
  patternMatchCellCount?: number;
  patternMatchHardness?: PatternMatchHardness;
  patternMatchRounds?: number;
  patternMatchStimulusMode?: PatternMatchStimulusMode;
  locationMemoryActiveCells?: number;
  locationMemoryRounds?: number;
  locationMemoryExploreSec?: number;
  locationMemoryRecallSec?: number;
  locationMemoryGridSize?: number;
  directionSenseChoiceCount?: number;
  directionSenseTrials?: number;
  directionSenseShapeSizePx?: number;
  directionSenseTurnDirection?: DirectionSenseTurnDirection;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s, width, height } = useLayout();
  const deviceTier = getDeviceTier(width, height);
  const stimuliSteps = useMemo(() => [...peripheralStimuliPresets(deviceTier)], [deviceTier]);
  const stimuliMax = peripheralMaxStimuliCount(deviceTier);
  const [tempPatientName, setTempPatientName] = useState(patientName);
  const [tempLetterSize, setTempLetterSize] = useState(letterSize);
  const [tempBubbleSize, setTempBubbleSize] = useState(bubbleSize);
  const [tempSpeed, setTempSpeed] = useState(speed);
  const [tempWheelColor, setTempWheelColor] = useState(wheelColor);
  const [tempTracingMode, setTempTracingMode] = useState(tracingMode);
  const [tempPathType, setTempPathType] = useState(pathType);
  const [tempTolerance, setTempTolerance] = useState(toleranceBandPx);
  const [tempTheme, setTempTheme] = useState(colorTheme);
  const [tempAudio, setTempAudio] = useState(audioEnabled);
  const [tempRounds, setTempRounds] = useState(roundsPerSet);
  const [tempComplexity, setTempComplexity] = useState(pathComplexity);
  const [tempBeeSpeed, setTempBeeSpeed] = useState(beeSpeedSec);
  const [tempOrientation, setTempOrientation] = useState(orientation);
  const [tempPattern, setTempPattern] = useState(pursuitMovementPattern);
  const [tempTargetColor, setTempTargetColor] = useState(pursuitTargetColor);
  const [tempDecoys, setTempDecoys] = useState(pursuitDecoyCount);
  const [tempPursuitSpeed, setTempPursuitSpeed] = useState(pursuitSpeedPxPerSec);
  const [tempTimeout, setTempTimeout] = useState(pursuitTrialTimeoutSec);
  const [tempTherapyColors, setTempTherapyColors] = useState<string[]>(therapyColors);
  const [tempStimuliColor, setTempStimuliColor] = useState(stimuliColor);
  const [tempBubbleAppearance, setTempBubbleAppearance] = useState<BubbleAppearance>(bubbleAppearance);
  const [tempNumberRangeFrom, setTempNumberRangeFrom] = useState(numberRangeFrom);
  const [tempNumberRangeTo, setTempNumberRangeTo] = useState(numberRangeTo);
  const [tempHexSizePx, setTempHexSizePx] = useState(hexSizePx);
  const [tempStimuliCount, setTempStimuliCount] = useState(stimuliCount);
  const [tempBatchesPerSession, setTempBatchesPerSession] = useState(batchesPerSession);
  const [tempStimulusColor, setTempStimulusColor] = useState(stimulusColor);
  const [tempFixationDotColor, setTempFixationDotColor] = useState(fixationDotColor);
  const [tempBgColor, setTempBgColor] = useState(bgColor);
  const [tempPeripheralTargetTimeoutSec, setTempPeripheralTargetTimeoutSec] = useState(peripheralTargetTimeoutSec);
  const [tempPeripheralBubbleType, setTempPeripheralBubbleType] = useState<PeripheralBubbleType>(peripheralBubbleType);
  const [tempShapeColor, setTempShapeColor] = useState(shapeColor);
  const [tempTargetDigitCount, setTempTargetDigitCount] = useState(targetDigitCount);
  const [tempTimeLimitSec, setTempTimeLimitSec] = useState(timeLimitSec);
  const [tempNumberSearchLayout, setTempNumberSearchLayout] = useState<NumberSearchLayoutMode>(numberSearchLayout);
  const [tempNumberSearchFieldCount, setTempNumberSearchFieldCount] = useState(numberSearchFieldCount);
  const [tempPatternMatchCodeLength, setTempPatternMatchCodeLength] = useState(
    clampPatternMatchCodeLength(patternMatchCodeLength),
  );
  const [tempPatternMatchFlashMs, setTempPatternMatchFlashMs] = useState(
    clampPatternMatchFlashMs(patternMatchFlashMs),
  );
  const [tempPatternMatchCellCount, setTempPatternMatchCellCount] = useState(
    clampPatternMatchCellCount(patternMatchCellCount),
  );
  const [tempPatternMatchHardness, setTempPatternMatchHardness] = useState<PatternMatchHardness>(
    clampPatternMatchHardness(patternMatchHardness),
  );
  const [tempPatternMatchRounds, setTempPatternMatchRounds] = useState(
    clampPatternMatchRounds(patternMatchRounds),
  );
  const [tempLocationMemoryActiveCells, setTempLocationMemoryActiveCells] = useState(
    clampLocationMemoryActiveCells(locationMemoryActiveCells, locationMemoryGridSize),
  );
  const [tempLocationMemoryRounds, setTempLocationMemoryRounds] = useState(
    clampLocationMemoryRounds(locationMemoryRounds),
  );
  const [tempLocationMemoryExploreSec, setTempLocationMemoryExploreSec] = useState(
    clampLocationMemoryExploreSec(locationMemoryExploreSec),
  );
  const [tempLocationMemoryRecallSec, setTempLocationMemoryRecallSec] = useState(
    clampLocationMemoryRecallSec(locationMemoryRecallSec),
  );
  const [tempLocationMemoryGridSize, setTempLocationMemoryGridSize] = useState(
    clampLocationMemoryGridSize(locationMemoryGridSize),
  );
  const [tempDirectionSenseChoiceCount, setTempDirectionSenseChoiceCount] = useState(
    clampDirectionSenseChoiceCount(directionSenseChoiceCount),
  );
  const [tempDirectionSenseTrials, setTempDirectionSenseTrials] = useState(
    clampDirectionSenseTrials(directionSenseTrials),
  );
  const [tempDirectionSenseShapeSizePx, setTempDirectionSenseShapeSizePx] = useState(
    clampDirectionSenseShapeSize(directionSenseShapeSizePx),
  );
  const [tempDirectionSenseTurnDirection, setTempDirectionSenseTurnDirection] = useState(
    clampDirectionSenseTurnDirection(directionSenseTurnDirection),
  );
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTempPatientName(patientName);
    setTempLetterSize(nearestStep(LETTER_SIZES, letterSize));
    setTempBubbleSize(
      nearestStep(showPursuitControls ? PURSUIT_BUBBLE_SIZES : BUBBLE_SIZES, bubbleSize),
    );
    setTempSpeed(nearestStep(SPEED_PRESETS, speed));
    setTempWheelColor(wheelColor);
    setTempTracingMode(tracingMode);
    setTempPathType(pathType);
    setTempTolerance(toleranceBandPx);
    setTempTheme(colorTheme);
    setTempAudio(audioEnabled);
    setTempRounds(roundsPerSet);
    setTempComplexity(pathComplexity);
    setTempBeeSpeed(beeSpeedSec);
    setTempOrientation(orientation);
    setTempPattern(pursuitMovementPattern);
    setTempTargetColor(pursuitTargetColor);
    setTempDecoys(pursuitDecoyCount);
    setTempPursuitSpeed(pursuitSpeedPxPerSec);
    setTempTimeout(pursuitTrialTimeoutSec);
    setTempNumberRangeFrom(numberRangeFrom);
    setTempNumberRangeTo(numberRangeTo);
    setTempHexSizePx(hexSizePx);
    setTempStimuliCount(clampStimuliCount(stimuliCount, deviceTier));
    setTempBatchesPerSession(batchesPerSession);
    setTempStimulusColor(stimulusColor);
    setTempFixationDotColor(fixationDotColor);
    setTempBgColor(bgColor);
    setTempPeripheralTargetTimeoutSec(clampPeripheralTargetTimeoutSec(peripheralTargetTimeoutSec));
    setTempPeripheralBubbleType(peripheralBubbleType);
    setTempStimuliColor(stimuliColor);
    setTempBubbleAppearance(bubbleAppearance);
    setTempShapeColor(shapeColor);
    setTempTargetDigitCount(clampNumberSearchTargetDigits(targetDigitCount));
    setTempTimeLimitSec(
      showDirectionSenseControls
        ? clampDirectionSenseTimeLimitSec(timeLimitSec)
        : showPatternMatchControls
          ? clampPatternMatchTimeLimitSec(timeLimitSec)
          : clampNumberSearchTimeLimitSec(timeLimitSec),
    );
    setTempNumberSearchLayout(clampNumberSearchLayoutMode(numberSearchLayout));
    setTempNumberSearchFieldCount(clampNumberSearchFieldCount(numberSearchFieldCount));
    setTempPatternMatchCodeLength(clampPatternMatchCodeLength(patternMatchCodeLength));
    setTempPatternMatchFlashMs(clampPatternMatchFlashMs(patternMatchFlashMs));
    setTempPatternMatchCellCount(clampPatternMatchCellCount(patternMatchCellCount));
    setTempPatternMatchHardness(clampPatternMatchHardness(patternMatchHardness));
    setTempPatternMatchRounds(clampPatternMatchRounds(patternMatchRounds));
    setTempLocationMemoryGridSize(clampLocationMemoryGridSize(locationMemoryGridSize));
    setTempLocationMemoryActiveCells(
      clampLocationMemoryActiveCells(locationMemoryActiveCells, locationMemoryGridSize),
    );
    setTempLocationMemoryRounds(clampLocationMemoryRounds(locationMemoryRounds));
    setTempLocationMemoryExploreSec(clampLocationMemoryExploreSec(locationMemoryExploreSec));
    setTempLocationMemoryRecallSec(clampLocationMemoryRecallSec(locationMemoryRecallSec));
    setTempDirectionSenseChoiceCount(clampDirectionSenseChoiceCount(directionSenseChoiceCount));
    setTempDirectionSenseTrials(clampDirectionSenseTrials(directionSenseTrials));
    setTempDirectionSenseShapeSizePx(clampDirectionSenseShapeSize(directionSenseShapeSizePx));
    setTempDirectionSenseTurnDirection(clampDirectionSenseTurnDirection(directionSenseTurnDirection));
    setConfirmApplyOpen(false);
    if (showPeripheralViewControls) {
      setTempLetterSize(clampPeripheralLetterSize(letterSize));
    }
    if (showNumberSearchControls) {
      setTempLetterSize(clampNumberSearchLetterSize(letterSize));
      setTempBgColor(bgColor || DEFAULT_NUMBER_SEARCH_BG);
      setTempShapeColor(shapeColor || DEFAULT_NUMBER_SEARCH_CHAR_COLOR);
    }
    if (showPatternMatchControls) {
      setTempLetterSize(clampPatternMatchLetterSize(letterSize));
      setTempBgColor(bgColor || DEFAULT_PATTERN_MATCH_BG);
      setTempShapeColor(shapeColor || DEFAULT_PATTERN_MATCH_CHAR_COLOR);
    }
    if (showLocationMemoryControls) {
      setTempLetterSize(clampLocationMemoryLetterSize(letterSize));
      setTempBgColor(bgColor || DEFAULT_LOCATION_MEMORY_BG);
      setTempShapeColor(shapeColor || DEFAULT_LOCATION_MEMORY_CHAR_COLOR);
    }
    if (showDirectionSenseControls) {
      setTempBgColor(bgColor || DEFAULT_DIRECTION_SENSE_BG);
      setTempShapeColor(shapeColor || DEFAULT_DIRECTION_SENSE_SHAPE_COLOR);
    }
    setTempTherapyColors((prev) => {
      if (
        prev.length === therapyColors.length &&
        prev.every((hex, i) => hex === therapyColors[i])
      ) {
        return prev;
      }
      return therapyColors;
    });
    // Sync draft fields only when the modal opens. Listing every prop here
    // retriggered setState on each parent render and overflowed the update depth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const getAppliedPayload = (): AppliedClinicalSettings => {
    const numberRange = clampSortingNumberRange(tempNumberRangeFrom, tempNumberRangeTo);
    return {
      patientName: tempPatientName,
      letterSize: showPeripheralViewControls
        ? clampPeripheralLetterSize(tempLetterSize)
        : showNumberSearchControls
          ? clampNumberSearchLetterSize(tempLetterSize)
          : showPatternMatchControls
            ? clampPatternMatchLetterSize(tempLetterSize)
            : showLocationMemoryControls
              ? clampLocationMemoryLetterSize(tempLetterSize)
            : tempLetterSize,
      bubbleSize: tempBubbleSize,
      speed: tempSpeed,
      wheelColor: tempWheelColor,
      tracingMode: tempTracingMode,
      pathType: tempPathType,
      toleranceBandPx: tempPathType === 'spiral' ? 12 : tempTolerance,
      colorTheme: tempTheme,
      audioEnabled: tempAudio,
      roundsPerSet: tempRounds,
      pathComplexity: tempComplexity,
      beeSpeedSec: tempBeeSpeed,
      orientation: tempOrientation,
      pursuitMovementPattern: tempPattern,
      pursuitTargetColor: tempTargetColor,
      pursuitDecoyCount: tempDecoys,
      pursuitSpeedPxPerSec: tempPursuitSpeed,
      pursuitTrialTimeoutSec: tempTimeout,
      therapyColors: tempTherapyColors,
      stimuliColor: tempStimuliColor,
      bubbleAppearance: tempBubbleAppearance,
      numberRangeFrom: numberRange.from,
      numberRangeTo: numberRange.to,
      hexSizePx: clampHexSizePx(tempHexSizePx),
      stimuliCount: clampStimuliCount(tempStimuliCount, deviceTier),
      batchesPerSession: clampBatchesPerSession(tempBatchesPerSession),
      stimulusColor: tempStimulusColor,
      fixationDotColor: tempFixationDotColor,
      bgColor: tempBgColor,
      shapeColor: tempShapeColor,
      peripheralTargetTimeoutSec: clampPeripheralTargetTimeoutSec(tempPeripheralTargetTimeoutSec),
      peripheralBubbleType: tempPeripheralBubbleType,
      targetDigitCount: clampNumberSearchTargetDigits(tempTargetDigitCount),
      timeLimitSec: showDirectionSenseControls
        ? clampDirectionSenseTimeLimitSec(tempTimeLimitSec)
        : showPatternMatchControls
          ? clampPatternMatchTimeLimitSec(tempTimeLimitSec)
          : clampNumberSearchTimeLimitSec(tempTimeLimitSec),
      numberSearchLayout: clampNumberSearchLayoutMode(tempNumberSearchLayout),
      numberSearchFieldCount: clampNumberSearchFieldCount(tempNumberSearchFieldCount),
      patternMatchCodeLength: showPatternMatchControls
        ? clampPatternMatchCodeLength(tempPatternMatchCodeLength)
        : tempPatternMatchCodeLength,
      patternMatchFlashMs: showPatternMatchControls
        ? clampPatternMatchFlashMs(tempPatternMatchFlashMs)
        : tempPatternMatchFlashMs,
      patternMatchCellCount: showPatternMatchControls
        ? clampPatternMatchCellCount(tempPatternMatchCellCount)
        : tempPatternMatchCellCount,
      patternMatchHardness: showPatternMatchControls
        ? clampPatternMatchHardness(tempPatternMatchHardness)
        : tempPatternMatchHardness,
      patternMatchRounds: showPatternMatchControls
        ? clampPatternMatchRounds(tempPatternMatchRounds)
        : tempPatternMatchRounds,
      locationMemoryActiveCells: showLocationMemoryControls
        ? clampLocationMemoryActiveCells(tempLocationMemoryActiveCells, tempLocationMemoryGridSize)
        : tempLocationMemoryActiveCells,
      locationMemoryRounds: showLocationMemoryControls
        ? clampLocationMemoryRounds(tempLocationMemoryRounds)
        : tempLocationMemoryRounds,
      locationMemoryExploreSec: showLocationMemoryControls
        ? clampLocationMemoryExploreSec(tempLocationMemoryExploreSec)
        : tempLocationMemoryExploreSec,
      locationMemoryRecallSec: showLocationMemoryControls
        ? clampLocationMemoryRecallSec(tempLocationMemoryRecallSec)
        : tempLocationMemoryRecallSec,
      locationMemoryGridSize: showLocationMemoryControls
        ? clampLocationMemoryGridSize(tempLocationMemoryGridSize)
        : tempLocationMemoryGridSize,
      directionSenseChoiceCount: showDirectionSenseControls
        ? clampDirectionSenseChoiceCount(tempDirectionSenseChoiceCount)
        : tempDirectionSenseChoiceCount,
      directionSenseTrials: showDirectionSenseControls
        ? clampDirectionSenseTrials(tempDirectionSenseTrials)
        : tempDirectionSenseTrials,
      directionSenseShapeSizePx: showDirectionSenseControls
        ? clampDirectionSenseShapeSize(tempDirectionSenseShapeSizePx)
        : tempDirectionSenseShapeSizePx,
      directionSenseTurnDirection: showDirectionSenseControls
        ? clampDirectionSenseTurnDirection(tempDirectionSenseTurnDirection)
        : tempDirectionSenseTurnDirection,
    };
  };

  const getBaselinePayload = (): AppliedClinicalSettings => {
    const numberRange = clampSortingNumberRange(numberRangeFrom, numberRangeTo);
    return {
      patientName,
      letterSize: showPeripheralViewControls
        ? clampPeripheralLetterSize(letterSize)
        : showNumberSearchControls
          ? clampNumberSearchLetterSize(letterSize)
          : showPatternMatchControls
            ? clampPatternMatchLetterSize(letterSize)
            : showLocationMemoryControls
              ? clampLocationMemoryLetterSize(letterSize)
            : letterSize,
      bubbleSize,
      speed,
      wheelColor,
      tracingMode,
      pathType,
      toleranceBandPx: pathType === 'spiral' ? 12 : toleranceBandPx,
      colorTheme,
      audioEnabled,
      roundsPerSet,
      pathComplexity,
      beeSpeedSec,
      orientation,
      pursuitMovementPattern,
      pursuitTargetColor,
      pursuitDecoyCount,
      pursuitSpeedPxPerSec,
      pursuitTrialTimeoutSec,
      therapyColors,
      stimuliColor,
      bubbleAppearance,
      numberRangeFrom: numberRange.from,
      numberRangeTo: numberRange.to,
      hexSizePx: clampHexSizePx(hexSizePx),
      stimuliCount: clampStimuliCount(stimuliCount, deviceTier),
      batchesPerSession: clampBatchesPerSession(batchesPerSession),
      stimulusColor,
      fixationDotColor,
      bgColor,
      shapeColor,
      peripheralTargetTimeoutSec: clampPeripheralTargetTimeoutSec(peripheralTargetTimeoutSec),
      peripheralBubbleType,
      targetDigitCount: clampNumberSearchTargetDigits(targetDigitCount),
      timeLimitSec: showDirectionSenseControls
        ? clampDirectionSenseTimeLimitSec(timeLimitSec)
        : showPatternMatchControls
          ? clampPatternMatchTimeLimitSec(timeLimitSec)
          : clampNumberSearchTimeLimitSec(timeLimitSec),
      numberSearchLayout: clampNumberSearchLayoutMode(numberSearchLayout),
      numberSearchFieldCount: clampNumberSearchFieldCount(numberSearchFieldCount),
      patternMatchCodeLength: showPatternMatchControls
        ? clampPatternMatchCodeLength(patternMatchCodeLength)
        : patternMatchCodeLength,
      patternMatchFlashMs: showPatternMatchControls
        ? clampPatternMatchFlashMs(patternMatchFlashMs)
        : patternMatchFlashMs,
      patternMatchCellCount: showPatternMatchControls
        ? clampPatternMatchCellCount(patternMatchCellCount)
        : patternMatchCellCount,
      patternMatchHardness: showPatternMatchControls
        ? clampPatternMatchHardness(patternMatchHardness)
        : patternMatchHardness,
      patternMatchRounds: showPatternMatchControls
        ? clampPatternMatchRounds(patternMatchRounds)
        : patternMatchRounds,
      locationMemoryActiveCells: showLocationMemoryControls
        ? clampLocationMemoryActiveCells(locationMemoryActiveCells, locationMemoryGridSize)
        : locationMemoryActiveCells,
      locationMemoryRounds: showLocationMemoryControls
        ? clampLocationMemoryRounds(locationMemoryRounds)
        : locationMemoryRounds,
      locationMemoryExploreSec: showLocationMemoryControls
        ? clampLocationMemoryExploreSec(locationMemoryExploreSec)
        : locationMemoryExploreSec,
      locationMemoryRecallSec: showLocationMemoryControls
        ? clampLocationMemoryRecallSec(locationMemoryRecallSec)
        : locationMemoryRecallSec,
      locationMemoryGridSize: showLocationMemoryControls
        ? clampLocationMemoryGridSize(locationMemoryGridSize)
        : locationMemoryGridSize,
      directionSenseChoiceCount: showDirectionSenseControls
        ? clampDirectionSenseChoiceCount(directionSenseChoiceCount)
        : directionSenseChoiceCount,
      directionSenseTrials: showDirectionSenseControls
        ? clampDirectionSenseTrials(directionSenseTrials)
        : directionSenseTrials,
      directionSenseShapeSizePx: showDirectionSenseControls
        ? clampDirectionSenseShapeSize(directionSenseShapeSizePx)
        : directionSenseShapeSizePx,
      directionSenseTurnDirection: showDirectionSenseControls
        ? clampDirectionSenseTurnDirection(directionSenseTurnDirection)
        : directionSenseTurnDirection,
    };
  };

  const settingsHaveChanged = () =>
    JSON.stringify(getAppliedPayload()) !== JSON.stringify(getBaselinePayload());

  const commitApply = () => {
    onApply(getAppliedPayload());
  };

  const apply = () => {
    if (sessionLocked) {
      if (!settingsHaveChanged()) {
        onClose();
        return;
      }
      setConfirmApplyOpen(true);
      return;
    }
    commitApply();
  };

  const isBubbleGame =
    !showBeeTracingControls &&
    !showPursuitControls &&
    !showPeripheralViewControls &&
    !showNumberSearchControls &&
    !showPatternMatchControls &&
    !showLocationMemoryControls &&
    !showDirectionSenseControls;
  const previewSize = Math.min(tempBubbleSize, 130);
  const previewStimuliHex = showStimuliColorPicker
    ? resolveStimuliBubbleColor(tempStimuliColor, 0)
    : '#2F80FF';
  const bubblePreviewPaint = resolveBubblePaint(
    showBubbleAppearancePicker || showStimuliColorPicker ? tempBubbleAppearance : 'solid',
    previewStimuliHex,
    { borderFill: '#0D0D0D', solidBorderWidth: 0 },
  );
  const peripheralHexR = Math.max(36, Math.min(54, clampHexSizePx(tempHexSizePx) * 0.85));
  const peripheralLetterPx = peripheralLetterFontPx(clampHexSizePx(tempHexSizePx), tempLetterSize);
  const previewPaint = peripheralHexPaint({
    bubbleType: tempPeripheralBubbleType,
    isActive: true,
    stimulusColor: tempStimulusColor,
  });
  const peripheralLetterColorValue = peripheralLetterColor({
    bubbleType: tempPeripheralBubbleType,
    stimulusColor: tempStimulusColor,
  });

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.85)',
          paddingTop: insets.top + s(8),
          paddingBottom: insets.bottom + s(8),
          paddingHorizontal: s(12),
        }}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: s(8) }}>
          <View
            style={{
              backgroundColor: '#1A1A1A',
              borderRadius: s(24),
              borderWidth: 1,
              borderColor: 'rgba(55,65,81,0.8)',
              padding: s(18),
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                borderBottomWidth: 1,
                borderBottomColor: '#1F2937',
                paddingBottom: s(14),
                marginBottom: s(14),
              }}
            >
              <View style={{ flex: 1, paddingRight: s(12) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: s(8) }}>
                  <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '800' }}>Clinical Configuration</Text>
                  <View
                    style={{
                      backgroundColor: 'rgba(59,130,246,0.2)',
                      borderWidth: 1,
                      borderColor: 'rgba(59,130,246,0.3)',
                      borderRadius: 999,
                      paddingHorizontal: s(10),
                      paddingVertical: s(4),
                    }}
                  >
                    <Text style={{ color: '#60A5FA', fontSize: fs(10), fontWeight: '800', letterSpacing: 1 }}>
                      VISION THERAPY
                    </Text>
                  </View>
                </View>
                <Text style={{ color: '#9CA3AF', fontSize: fs(12), marginTop: s(6) }}>
                  {showPursuitControls
                    ? 'Configure pursuit trajectory, target salience, decoy density and trial timing.'
                    : showDirectionSenseControls
                      ? 'Configure turn direction, choice count, trials, shape size, and field colors.'
                    : showPatternMatchControls
                      ? 'Configure code length, flash encoding, field size, and near-miss hardness.'
                      : showLocationMemoryControls
                        ? 'Configure explore time, recall timing, active cells, and contrast colors.'
                      : showNumberSearchControls
                      ? 'Configure glyph size, digit count, layout density, and high-contrast field colors.'
                      : showPeripheralViewControls
                        ? 'Configure hive size, batch density, and therapy stimulus colors for peripheral fields.'
                        : 'Configure patient parameters, stimulus diameter & optical symbol scaling.'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                style={{
                  width: s(36),
                  height: s(36),
                  borderRadius: s(18),
                  backgroundColor: '#1F2937',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#D1D5DB', fontSize: fs(16), fontWeight: '700' }}>✕</Text>
              </Pressable>
            </View>

            {isBubbleGame ? (
              <>
                <View
                  style={{
                    backgroundColor: '#0D0D0D',
                    borderRadius: s(16),
                    borderWidth: 1,
                    borderColor: '#1F2937',
                    padding: s(16),
                    alignItems: 'center',
                    marginBottom: s(12),
                    minHeight: s(200),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: s(8) }}>
                    <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: '#3B82F6' }} />
                    <Text style={{ color: '#60A5FA', fontSize: fs(11), fontWeight: '800', letterSpacing: 1.4 }}>
                      LIVE PREVIEW
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: s(16) }}>
                    <View
                      style={{
                        width: previewSize,
                        height: previewSize,
                        borderRadius: previewSize / 2,
                        backgroundColor: bubblePreviewPaint.backgroundColor,
                        borderWidth: bubblePreviewPaint.borderWidth,
                        borderColor: bubblePreviewPaint.borderColor,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: bubblePreviewPaint.textColor, fontWeight: '800', fontSize: Math.round(16 * tempLetterSize) }}>
                        {sampleSymbol}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: '#141414',
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#1F2937',
                      paddingHorizontal: s(16),
                      paddingVertical: s(8),
                      gap: s(12),
                    }}
                  >
                    <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                      Bubble: <Text style={{ color: '#60A5FA', fontWeight: '800' }}>{tempBubbleSize}</Text>
                    </Text>
                    {showLetterSizeControl ? (
                      <>
                        <Text style={{ color: '#4B5563' }}>|</Text>
                        <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                          Font: <Text style={{ color: '#60A5FA', fontWeight: '800' }}>{tempLetterSize}</Text>
                        </Text>
                      </>
                    ) : null}
                  </View>
                </View>

                {showLetterSizeControl ? (
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                      LETTER SIZE
                    </Text>
                    <Text style={{ color: '#60A5FA', fontSize: fs(16), fontWeight: '900' }}>{tempLetterSize}</Text>
                  </View>
                  <StepSlider values={LETTER_SIZES} value={tempLetterSize} onChange={setTempLetterSize} />
                </Card>
                ) : null}

                {!showPeripheralViewControls ? (
                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                      BUBBLE SIZE
                    </Text>
                    <Text style={{ color: '#60A5FA', fontSize: fs(16), fontWeight: '900' }}>{tempBubbleSize}</Text>
                  </View>
                  <StepSlider values={BUBBLE_SIZES} value={tempBubbleSize} onChange={setTempBubbleSize} />
                </Card>
                ) : null}

                <Card>
                  <FloatingLabelInput
                    label="Patient Name"
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    variant="dark"
                    style={{ marginBottom: 0 }}
                  />
                </Card>

                {showNumberRangeControl ? (
                  <Card>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
                      NUMBER RANGE
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginBottom: s(8) }}>
                      Any start. At most {MAX_SORTING_NUMBER_COUNT} numbers (default {DEFAULT_SORTING_NUMBER_FROM}–{DEFAULT_SORTING_NUMBER_TO}).
                    </Text>
                    <View style={{ flexDirection: 'row', gap: s(10) }}>
                      <View style={{ flex: 1 }}>
                        <FloatingLabelInput
                          label="From"
                          value={String(Number.isFinite(tempNumberRangeFrom) ? tempNumberRangeFrom : '')}
                          onChangeText={(text) => setTempNumberRangeFrom(parseInt(text, 10))}
                          variant="dark"
                          keyboardType="number-pad"
                          style={{ marginBottom: 0 }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <FloatingLabelInput
                          label="To"
                          value={String(Number.isFinite(tempNumberRangeTo) ? tempNumberRangeTo : '')}
                          onChangeText={(text) => setTempNumberRangeTo(parseInt(text, 10))}
                          variant="dark"
                          keyboardType="number-pad"
                          style={{ marginBottom: 0 }}
                        />
                      </View>
                    </View>
                    <Text style={{ color: '#67E8F9', fontSize: fs(12), fontWeight: '700', marginTop: s(8) }}>
                      {(() => {
                        const range = clampSortingNumberRange(tempNumberRangeFrom, tempNumberRangeTo);
                        const count = range.to - range.from + 1;
                        return `${range.from}–${range.to} · ${count} number${count === 1 ? '' : 's'}`;
                      })()}
                    </Text>
                  </Card>
                ) : null}

                {showSpeedControl ? (
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                      <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                        WHEEL SPEED
                      </Text>
                      <Text style={{ color: '#60A5FA', fontSize: fs(16), fontWeight: '900' }}>{tempSpeed}</Text>
                    </View>
                    <StepSlider values={SPEED_PRESETS} value={tempSpeed} onChange={setTempSpeed} format={(n) => `${n}`} />
                  </Card>
                ) : null}

                {showWheelColorControl ? (
                  <Card>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                        {wheelColorTitle.toUpperCase()}
                      </Text>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: s(8),
                          backgroundColor: '#141414',
                          borderRadius: s(12),
                          borderWidth: 1,
                          borderColor: '#374151',
                          paddingHorizontal: s(10),
                          paddingVertical: s(6),
                        }}
                      >
                        <View
                          style={{
                            width: s(28),
                            height: s(28),
                            borderRadius: s(8),
                            backgroundColor: tempWheelColor,
                            borderWidth: 1,
                            borderColor: '#4B5563',
                          }}
                        />
                        <Text style={{ color: '#E5E7EB', fontSize: fs(13), fontWeight: '700' }}>
                          {wheelColorLabel(tempWheelColor)}
                        </Text>
                      </View>
                    </View>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: s(6), marginBottom: s(4) }}>
                      {wheelColorHint}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: s(10), gap: s(8) }}>
                      {WHEEL_COLORS.map((c) => {
                        const active = tempWheelColor.toLowerCase() === c.code.toLowerCase();
                        return (
                          <Pressable
                            key={c.code}
                            onPress={() => setTempWheelColor(c.code)}
                            accessibilityLabel={`Wheel color ${c.name}`}
                            style={{ alignItems: 'center', width: s(56) }}
                          >
                            <View
                              style={{
                                width: s(28),
                                height: s(28),
                                borderRadius: s(14),
                                backgroundColor: c.code,
                                borderWidth: active ? 2 : 1,
                                borderColor: active ? '#60A5FA' : '#4B5563',
                              }}
                            />
                            <Text
                              style={{
                                color: active ? '#FFFFFF' : '#6B7280',
                                fontSize: fs(9),
                                fontWeight: '700',
                                marginTop: s(4),
                                textAlign: 'center',
                              }}
                            >
                              {c.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Card>
                ) : null}

                {showBubbleAppearancePicker ? (
                  <Card>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(6) }}>
                      BUBBLE STYLE
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginBottom: s(10) }}>
                      Solid fills the bubble. Border keeps an outline with the letter in the same color.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <Chip
                        label="Solid"
                        active={tempBubbleAppearance === 'solid'}
                        onPress={() => setTempBubbleAppearance('solid')}
                      />
                      <Chip
                        label="Border"
                        active={tempBubbleAppearance === 'border'}
                        onPress={() => setTempBubbleAppearance('border')}
                      />
                    </View>
                  </Card>
                ) : null}

                {showStimuliColorPicker ? (
                  <Card>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(6) }}>
                      STIMULI COLOR
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginBottom: s(10) }}>
                      Bubble fill for letters/numbers. White reduces color confusion; Mixed keeps therapy-grade variety.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                      {STIMULI_BUBBLE_COLOR_OPTIONS.map((item) => {
                        const active =
                          tempStimuliColor !== STIMULI_COLOR_MIXED &&
                          tempStimuliColor.toLowerCase() === item.code.toLowerCase();
                        return (
                          <Pressable
                            key={item.code}
                            onPress={() => setTempStimuliColor(item.code)}
                            style={{ width: s(46), alignItems: 'center', gap: s(4) }}
                          >
                            <View
                              style={{
                                width: s(34),
                                height: s(34),
                                borderRadius: s(17),
                                backgroundColor: item.code,
                                borderWidth: active ? 2 : 1,
                                borderColor: active ? '#FFFFFF' : item.code.toLowerCase() === '#ffffff' ? '#9CA3AF' : '#4B5563',
                              }}
                            />
                            <Text style={{ color: active ? '#fff' : '#9CA3AF', fontSize: fs(9), fontWeight: '800' }}>
                              {item.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                      <Pressable
                        onPress={() => setTempStimuliColor(STIMULI_COLOR_MIXED)}
                        style={{ width: s(52), alignItems: 'center', gap: s(4) }}
                      >
                        <View
                          style={{
                            width: s(34),
                            height: s(34),
                            borderRadius: s(17),
                            overflow: 'hidden',
                            borderWidth: tempStimuliColor === STIMULI_COLOR_MIXED ? 2 : 1,
                            borderColor: tempStimuliColor === STIMULI_COLOR_MIXED ? '#FFFFFF' : '#4B5563',
                            flexDirection: 'row',
                            flexWrap: 'wrap',
                          }}
                        >
                          {['#FFD600', '#00F0FF', '#FF3D00', '#00E676'].map((c) => (
                            <View key={c} style={{ width: '50%', height: '50%', backgroundColor: c }} />
                          ))}
                        </View>
                        <Text
                          style={{
                            color: tempStimuliColor === STIMULI_COLOR_MIXED ? '#fff' : '#9CA3AF',
                            fontSize: fs(9),
                            fontWeight: '800',
                          }}
                        >
                          Mixed
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                ) : null}

                {showTherapyColorPicker ? (
                  <Card>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(6) }}>
                      THERAPY COLORS
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginBottom: s(10) }}>
                      Simple names children know. Keep at least two selected.
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                      {THERAPY_COLOR_ITEMS.map((item) => {
                        const active = tempTherapyColors.some((hex) => hex.toLowerCase() === item.code.toLowerCase());
                        return (
                          <Pressable
                            key={item.code}
                            onPress={() => {
                              setTempTherapyColors((prev) => {
                                const on = prev.some((hex) => hex.toLowerCase() === item.code.toLowerCase());
                                if (on) {
                                  if (prev.length <= 2) return prev;
                                  return prev.filter((hex) => hex.toLowerCase() !== item.code.toLowerCase());
                                }
                                return [...prev, item.code];
                              });
                            }}
                            style={{
                              width: s(46),
                              alignItems: 'center',
                              gap: s(4),
                            }}
                          >
                            <View
                              style={{
                                width: s(38),
                                height: s(38),
                                borderRadius: s(19),
                                borderWidth: active ? 2 : 0,
                                borderColor: '#FFFFFF',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <View
                                style={{
                                  width: s(34),
                                  height: s(34),
                                  borderRadius: s(17),
                                  backgroundColor: '#121626',
                                  borderWidth: 3,
                                  borderColor: item.code,
                                }}
                              />
                            </View>
                            <Text style={{ color: active ? '#fff' : '#9CA3AF', fontSize: fs(9), fontWeight: '800' }}>
                              {item.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </Card>
                ) : null}
              </>
            ) : null}

            {showPeripheralViewControls ? (
              <>
                <View
                  style={{
                    backgroundColor: '#0D0D0D',
                    borderRadius: s(16),
                    borderWidth: 1,
                    borderColor: '#1F2937',
                    padding: s(16),
                    alignItems: 'center',
                    marginBottom: s(12),
                    minHeight: s(200),
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: s(8) }}>
                    <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: '#22D3EE' }} />
                    <Text style={{ color: '#67E8F9', fontSize: fs(11), fontWeight: '800', letterSpacing: 1.4 }}>
                      LIVE HEX PREVIEW
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: s(16), backgroundColor: tempBgColor, borderRadius: s(12), width: '100%' }}>
                    <Svg width={peripheralHexR * 2.4} height={peripheralHexR * 2.4}>
                      <Polygon
                        points={hexVertices(peripheralHexR * 1.2, peripheralHexR * 1.2, peripheralHexR)
                          .map((p) => `${p.x},${p.y}`)
                          .join(' ')}
                        fill={previewPaint.fill}
                        stroke={previewPaint.stroke}
                        strokeWidth={previewPaint.strokeWidth}
                        strokeLinejoin="round"
                      />
                      <SvgText
                        x={peripheralHexR * 1.2}
                        y={peripheralHexR * 1.2 + peripheralLetterPx * 0.35}
                        fill={peripheralLetterColorValue}
                        fontSize={peripheralLetterPx}
                        fontWeight="900"
                        textAnchor="middle"
                      >
                        {sampleSymbol}
                      </SvgText>
                    </Svg>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      backgroundColor: '#141414',
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: '#1F2937',
                      paddingHorizontal: s(16),
                      paddingVertical: s(8),
                      gap: s(12),
                    }}
                  >
                    <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                      Hex: <Text style={{ color: '#67E8F9', fontWeight: '800' }}>{clampHexSizePx(tempHexSizePx)}px</Text>
                    </Text>
                    <Text style={{ color: '#4B5563' }}>|</Text>
                    <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                      Stimuli:{' '}
                      <Text style={{ color: '#67E8F9', fontWeight: '800' }}>
                        {clampStimuliCount(tempStimuliCount, deviceTier)}
                      </Text>
                      <Text style={{ color: '#64748B', fontSize: fs(10) }}> (max {stimuliMax})</Text>
                    </Text>
                    <Text style={{ color: '#4B5563' }}>|</Text>
                    <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                      Letter:{' '}
                      <Text style={{ color: '#67E8F9', fontWeight: '800' }}>
                        {clampPeripheralLetterSize(tempLetterSize)}
                      </Text>
                    </Text>
                  </View>
                </View>

                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                      LETTER SIZE
                    </Text>
                    <Text style={{ color: '#67E8F9', fontSize: fs(16), fontWeight: '900' }}>
                      {clampPeripheralLetterSize(tempLetterSize)}
                    </Text>
                  </View>
                  <StepSlider
                    values={[...PERIPHERAL_LETTER_SIZE_PRESETS]}
                    value={clampPeripheralLetterSize(tempLetterSize)}
                    onChange={setTempLetterSize}
                  />
                </Card>

                <Card>
                  <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
                    TARGET TIMER
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {PERIPHERAL_TARGET_TIMEOUT_PRESETS.map((sec) => (
                      <Chip
                        key={sec}
                        label={sec === 0 ? 'Off' : `${sec}s`}
                        active={tempPeripheralTargetTimeoutSec === sec}
                        onPress={() => setTempPeripheralTargetTimeoutSec(sec)}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#6B7280', fontSize: fs(11), marginTop: s(6) }}>
                    Off keeps the target until you find a match. Timed mode counts a miss and advances the target.
                  </Text>
                </Card>

                <Card>
                  <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
                    BUBBLE TYPE
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    <Chip
                      label="Solid"
                      active={tempPeripheralBubbleType === 'solid'}
                      onPress={() => setTempPeripheralBubbleType('solid')}
                    />
                    <Chip
                      label="Boundary"
                      active={tempPeripheralBubbleType === 'boundary'}
                      onPress={() => setTempPeripheralBubbleType('boundary')}
                    />
                  </View>
                </Card>

                <Card>
                  <FloatingLabelInput
                    label="Patient Name"
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    variant="dark"
                    style={{ marginBottom: 0 }}
                  />
                </Card>

                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                      HEX SIZE
                    </Text>
                    <Text style={{ color: '#67E8F9', fontSize: fs(16), fontWeight: '900' }}>
                      {clampHexSizePx(tempHexSizePx)}px
                    </Text>
                  </View>
                  <StepSlider
                    values={HEX_SIZE_STEPS}
                    value={nearestStep(HEX_SIZE_STEPS, tempHexSizePx)}
                    onChange={setTempHexSizePx}
                  />
                </Card>

                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                      STIMULI / BATCH
                    </Text>
                    <Text style={{ color: '#67E8F9', fontSize: fs(16), fontWeight: '900' }}>
                      {clampStimuliCount(tempStimuliCount, deviceTier)}
                    </Text>
                  </View>
                  <StepSlider
                    values={stimuliSteps}
                    value={nearestStep(stimuliSteps, tempStimuliCount)}
                    onChange={setTempStimuliCount}
                  />
                  <Text style={{ color: '#64748B', fontSize: fs(11), marginTop: s(4) }}>
                    Device max {stimuliMax} per batch (phone · tablet · desktop presets differ).
                  </Text>
                </Card>

                <Card>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                    <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8 }}>
                      BATCHES / SESSION
                    </Text>
                    <Text style={{ color: '#67E8F9', fontSize: fs(16), fontWeight: '900' }}>
                      {clampBatchesPerSession(tempBatchesPerSession)}
                    </Text>
                  </View>
                  <StepSlider
                    values={BATCHES_STEPS}
                    value={nearestStep(BATCHES_STEPS, tempBatchesPerSession)}
                    onChange={setTempBatchesPerSession}
                  />
                </Card>

                <Card>
                  <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
                    ENGINE BACKGROUND
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {PERIPHERAL_BG_COLORS.map((c) => (
                      <Pressable
                        key={`bg-${c.code}`}
                        onPress={() => setTempBgColor(c.code)}
                        style={{
                          width: s(36),
                          height: s(36),
                          borderRadius: 999,
                          backgroundColor: c.code,
                          marginRight: s(8),
                          marginBottom: s(8),
                          borderWidth: tempBgColor.toLowerCase() === c.code.toLowerCase() ? 3 : 1,
                          borderColor: tempBgColor.toLowerCase() === c.code.toLowerCase() ? '#fff' : '#374151',
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginTop: s(8), marginBottom: s(8) }}>
                    STIMULUS COLOR
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {PERIPHERAL_STIMULUS_COLORS.map((c) => (
                      <Pressable
                        key={`stim-${c.code}`}
                        onPress={() => setTempStimulusColor(c.code)}
                        style={{
                          width: s(36),
                          height: s(36),
                          borderRadius: 999,
                          backgroundColor: c.code,
                          marginRight: s(8),
                          marginBottom: s(8),
                          borderWidth: tempStimulusColor === c.code ? 3 : 0,
                          borderColor: '#fff',
                        }}
                      />
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {showBeeTracingControls ? (
              <>
                <FloatingLabelInput
                  label="Patient Name"
                  value={tempPatientName}
                  onChangeText={setTempPatientName}
                  variant="dark"
                  style={{ marginBottom: s(16) }}
                />
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Tracing mode</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  <Chip label="Active" active={tempTracingMode === 'active'} onPress={() => setTempTracingMode('active')} />
                  <Chip label="Guided" active={tempTracingMode === 'guided'} onPress={() => setTempTracingMode('guided')} />
                </View>
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Path type</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {PATH_TYPES.map((p) => (
                    <Chip key={p} label={p} active={tempPathType === p} onPress={() => setTempPathType(p)} />
                  ))}
                </View>
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Complexity</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(['short', 'medium', 'long'] as const).map((p) => (
                    <Chip key={p} label={p} active={tempComplexity === p} onPress={() => setTempComplexity(p)} />
                  ))}
                </View>
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Bee speed (sec)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {[3, 5, 8, 10].map((n) => (
                    <Chip key={n} label={`${n}s`} active={tempBeeSpeed === n} onPress={() => setTempBeeSpeed(n)} />
                  ))}
                </View>
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Tolerance</Text>
                {tempPathType !== 'spiral' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {[24, 40, 56, 72].map((n) => (
                    <Chip key={n} label={`${n}px`} active={tempTolerance === n} onPress={() => setTempTolerance(n)} />
                  ))}
                </View>
                ) : (
                  <Text style={{ color: '#9CA3AF', fontSize: fs(12), marginBottom: s(8) }}>Spiral uses a fixed narrow path.</Text>
                )}
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Theme</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(['dark', 'standard', 'high_contrast'] as const).map((p) => (
                    <Chip key={p} label={p} active={tempTheme === p} onPress={() => setTempTheme(p)} />
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  <Chip label={tempAudio ? 'Audio on' : 'Audio off'} active={tempAudio} onPress={() => setTempAudio((v) => !v)} />
                </View>
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Rounds</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {[5, 7, 10].map((n) => (
                    <Chip key={n} label={`${n}`} active={tempRounds === n} onPress={() => setTempRounds(n)} />
                  ))}
                </View>
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Orientation</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {(['auto', 'portrait', 'landscape'] as const).map((p) => (
                    <Chip key={p} label={p} active={tempOrientation === p} onPress={() => setTempOrientation(p)} />
                  ))}
                </View>
              </>
            ) : null}

            {showPursuitControls ? (
              <>
                <Card>
                  <Text
                    style={{
                      color: '#22D3EE',
                      fontSize: fs(12),
                      fontWeight: '800',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      borderBottomWidth: 1,
                      borderBottomColor: '#1F2937',
                      paddingBottom: s(8),
                      marginBottom: s(12),
                    }}
                  >
                    Pursuit Stimulus & Target Profile
                  </Text>
                  <FloatingLabelInput
                    label="Patient Name"
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    variant="dark"
                    style={{ marginBottom: s(14) }}
                  />
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, marginBottom: s(8) }}>
                    MOVEMENT PATTERN
                  </Text>
                  <View
                    style={{
                      backgroundColor: '#141414',
                      borderWidth: 1,
                      borderColor: '#1F2937',
                      borderRadius: s(12),
                      padding: s(12),
                      marginBottom: s(14),
                    }}
                  >
                    <Text style={{ color: '#fff', fontSize: fs(14), fontWeight: '800' }}>
                      {PURSUIT_PATTERN_OPTIONS.find((opt) => opt.val === tempPattern)?.label.replace(/^\d+\.\s/, '') || tempPattern}
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: s(4) }}>
                      Chosen from the pursuit level list. Switch levels to change trajectory.
                    </Text>
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, marginBottom: s(8) }}>
                    TARGET LUMINANCE COLOR
                  </Text>
                  <View style={{ flexDirection: 'row', gap: s(8) }}>
                    {PURSUIT_COLOR_OPTIONS.map((clr) => (
                      <Pressable
                        key={clr.val}
                        onPress={() => setTempTargetColor(clr.val)}
                        style={{
                          flex: 1,
                          paddingVertical: s(10),
                          borderRadius: s(12),
                          alignItems: 'center',
                          backgroundColor: clr.val,
                          borderWidth: 2,
                          borderColor: tempTargetColor === clr.val ? '#fff' : 'transparent',
                        }}
                      >
                        <Text style={{ color: clr.text, fontSize: fs(11), fontWeight: '900' }}>{clr.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>

                <Card>
                  <Text
                    style={{
                      color: '#60A5FA',
                      fontSize: fs(12),
                      fontWeight: '800',
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      borderBottomWidth: 1,
                      borderBottomColor: '#1F2937',
                      paddingBottom: s(8),
                      marginBottom: s(12),
                    }}
                  >
                    Dynamics & Selective Attention
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(8) }}>
                    <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, flex: 1, paddingRight: s(8) }}>
                      DECOY ELEMENT COUNT
                    </Text>
                    <Text style={{ color: '#22D3EE', fontSize: fs(11), fontWeight: '800' }}>
                      {tempDecoys + 1} Total
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: s(8), marginBottom: s(14) }}>
                    {[
                      { label: '1 Decoy', val: 1 },
                      { label: '2 Decoys', val: 2 },
                      { label: '3 Decoys', val: 3 },
                    ].map((dc) => (
                      <Pressable
                        key={dc.val}
                        onPress={() => setTempDecoys(dc.val)}
                        style={{
                          flex: 1,
                          paddingVertical: s(10),
                          borderRadius: s(12),
                          alignItems: 'center',
                          backgroundColor: tempDecoys === dc.val ? '#06B6D4' : '#1F2937',
                        }}
                      >
                        <Text
                          style={{
                            color: tempDecoys === dc.val ? '#0F172A' : '#D1D5DB',
                            fontSize: fs(11),
                            fontWeight: '800',
                            textAlign: 'center',
                          }}
                        >
                          {dc.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(4) }}>
                    <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                      BUBBLE SIZE
                    </Text>
                    <Text style={{ color: '#22D3EE', fontSize: fs(14), fontWeight: '900' }}>{tempBubbleSize}px</Text>
                  </View>
                  <StepSlider values={PURSUIT_BUBBLE_SIZES} value={tempBubbleSize} onChange={setTempBubbleSize} />
                  <Text
                    style={{
                      color: '#D1D5DB',
                      fontSize: fs(11),
                      fontWeight: '800',
                      letterSpacing: 0.6,
                      marginTop: s(14),
                      marginBottom: s(8),
                    }}
                  >
                    PURSUIT SPEED
                  </Text>
                  <View style={{ gap: s(8), marginBottom: s(14) }}>
                    {PURSUIT_SPEEDS.map((spd) => (
                      <Pressable
                        key={spd.val}
                        onPress={() => setTempPursuitSpeed(spd.val)}
                        style={{
                          paddingVertical: s(10),
                          paddingHorizontal: s(12),
                          borderRadius: s(12),
                          backgroundColor: tempPursuitSpeed === spd.val ? '#06B6D4' : '#1F2937',
                        }}
                      >
                        <Text
                          style={{
                            color: tempPursuitSpeed === spd.val ? '#0F172A' : '#D1D5DB',
                            fontSize: fs(12),
                            fontWeight: '800',
                            textAlign: 'center',
                          }}
                        >
                          {spd.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, marginBottom: s(8) }}>
                    TRIAL TIMEOUT
                  </Text>
                  <View style={{ flexDirection: 'row', gap: s(8) }}>
                    {PURSUIT_TIMEOUTS.map((to) => (
                      <Pressable
                        key={to.val}
                        onPress={() => setTempTimeout(to.val)}
                        style={{
                          flex: 1,
                          paddingVertical: s(10),
                          borderRadius: s(12),
                          alignItems: 'center',
                          backgroundColor: tempTimeout === to.val ? '#06B6D4' : '#1F2937',
                        }}
                      >
                        <Text
                          style={{
                            color: tempTimeout === to.val ? '#0F172A' : '#D1D5DB',
                            fontSize: fs(11),
                            fontWeight: '800',
                            textAlign: 'center',
                          }}
                        >
                          {to.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: s(8) }}>
                    Off keeps the trial running until the target or a decoy is tapped.
                  </Text>
                </Card>
              </>
            ) : null}

            {showLocationMemoryControls ? (
              <>
                <Card>
                  <Text style={{ color: '#FBBF24', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    GRID PREVIEW · {locationMemoryGridLabel(tempLocationMemoryGridSize)}
                  </Text>
                  {(() => {
                    const n = tempLocationMemoryGridSize;
                    const gap = s(6);
                    const pad = s(12);
                    const maxInner = Math.min(width - s(96), s(260));
                    const cellW = Math.floor(
                      Math.max(s(36), (maxInner - gap * Math.max(0, n - 1)) / Math.max(1, n)),
                    );
                    const gridWidth = cellW * n + gap * Math.max(0, n - 1);
                    const total = n * n;
                    const highlight = Math.ceil(total / 2);
                    const rows = Array.from({ length: n }, (_, row) =>
                      Array.from({ length: n }, (_, col) => row * n + col + 1),
                    );
                    return (
                      <View style={{ width: '100%', alignItems: 'center' }}>
                        <View
                          style={{
                            backgroundColor: tempBgColor,
                            padding: pad,
                            borderRadius: s(16),
                            borderWidth: 1,
                            borderColor: '#1F2937',
                            alignItems: 'center',
                          }}
                        >
                          <View style={{ width: gridWidth, gap }}>
                            {rows.map((row, rowIdx) => (
                              <View
                                key={`lm-preview-row-${rowIdx}`}
                                style={{
                                  flexDirection: 'row',
                                  width: gridWidth,
                                  gap,
                                  justifyContent: 'center',
                                }}
                              >
                                {row.map((cellNum) => {
                                  const isOpen = cellNum === highlight;
                                  return (
                                    <View
                                      key={cellNum}
                                      style={{
                                        width: cellW,
                                        height: cellW,
                                        borderRadius: s(10),
                                        borderWidth: isOpen ? 3 : 2,
                                        borderColor: isOpen ? '#FACC15' : '#CBD5E1',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isOpen ? '#FACC15' : '#FFFFFF',
                                      }}
                                    >
                                      <Text
                                        style={{
                                          color: '#0F172A',
                                          fontWeight: '900',
                                          fontSize: Math.max(
                                            10,
                                            Math.round(cellW * 0.28 * tempLetterSize),
                                          ),
                                        }}
                                      >
                                        {isOpen ? String(cellNum) : '?'}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    );
                  })()}
                  <FloatingLabelInput
                    label="Patient Name"
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    variant="dark"
                    style={{ marginTop: s(12), marginBottom: 0 }}
                  />
                </Card>
                <Card>
                  <Text style={{ color: '#FBBF24', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    SESSION PARAMETERS
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Grid Size</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {LOCATION_MEMORY_GRID_SIZE_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={locationMemoryGridLabel(n)}
                        active={tempLocationMemoryGridSize === n}
                        onPress={() => {
                          setTempLocationMemoryGridSize(n);
                          setTempLocationMemoryActiveCells((prev) =>
                            clampLocationMemoryActiveCells(prev, n),
                          );
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Active Cells</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {locationMemoryActiveCellOptions(tempLocationMemoryGridSize).map((n) => (
                      <Chip
                        key={n}
                        label={String(n)}
                        active={tempLocationMemoryActiveCells === n}
                        onPress={() => setTempLocationMemoryActiveCells(n)}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Explore Time</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {LOCATION_MEMORY_EXPLORE_SEC_PRESETS.map((sec) => (
                      <Chip key={sec} label={locationMemoryExploreLabel(sec)} active={tempLocationMemoryExploreSec === sec} onPress={() => setTempLocationMemoryExploreSec(sec)} />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Recall / Target</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {LOCATION_MEMORY_RECALL_SEC_PRESETS.map((sec) => (
                      <Chip key={sec} label={locationMemoryRecallLabel(sec)} active={tempLocationMemoryRecallSec === sec} onPress={() => setTempLocationMemoryRecallSec(sec)} />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Rounds</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {LOCATION_MEMORY_ROUNDS_PRESETS.map((n) => (
                      <Chip key={n} label={String(n)} active={tempLocationMemoryRounds === n} onPress={() => setTempLocationMemoryRounds(n)} />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Glyph Size</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {LOCATION_MEMORY_LETTER_SIZE_PRESETS.map((size) => (
                      <Chip key={size} label={String(size)} active={tempLetterSize === size} onPress={() => setTempLetterSize(size)} />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Background</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginBottom: s(12) }}>
                    {LOCATION_MEMORY_BG_COLORS.map((c) => (
                      <Pressable key={c.code} onPress={() => setTempBgColor(c.code)} style={{ width: s(56), height: s(36), borderRadius: s(10), backgroundColor: c.code, borderWidth: 2, borderColor: tempBgColor === c.code ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: c.code === '#E8ECF0' || c.code === '#F8FAFC' ? '#0F172A' : '#F8FAFC', fontSize: fs(9), fontWeight: '800' }}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>Number Color</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                    {LOCATION_MEMORY_CHAR_COLORS.map((c) => (
                      <Pressable key={c.code} onPress={() => setTempShapeColor(c.code)} style={{ width: s(56), height: s(36), borderRadius: s(10), backgroundColor: c.code, borderWidth: 2, borderColor: tempShapeColor === c.code ? '#FBBF24' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: c.code === '#F5F7FA' || c.code === '#FFFFFF' || c.code === '#FBBF24' ? '#0F172A' : '#F8FAFC', fontSize: fs(9), fontWeight: '800' }}>{c.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {showDirectionSenseControls ? (
              <>
                <Card>
                  <Text style={{ color: '#38BDF8', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    LIVE PREVIEW
                  </Text>
                  {(() => {
                    const previewSize = Math.min(tempDirectionSenseShapeSizePx, s(96));
                    const arrowSize = Math.round(previewSize * 0.52);
                    const optionSize = Math.round(previewSize * 0.55);
                    const optionGlyph = Math.max(24, optionSize - s(12));
                    return (
                      <View
                        style={{
                          minHeight: s(180),
                          borderRadius: s(16),
                          borderWidth: 1,
                          borderColor: '#1F2937',
                          backgroundColor: tempBgColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                          paddingVertical: s(18),
                          paddingHorizontal: s(12),
                          gap: s(16),
                          marginBottom: s(12),
                        }}
                      >
                        {directionSenseStraightenMode ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(16) }}>
                            <Svg width={previewSize} height={previewSize} viewBox="0 0 100 100">
                              <Path
                                d={DIRECTION_SENSE_SHAPE_PATHS.eee}
                                fill="none"
                                stroke={tempShapeColor}
                                strokeWidth={DIRECTION_SENSE_SHAPE_STROKE_WIDTH}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                transform={directionSensePoseTransform({ orientation: 0, flipH: false })}
                              />
                            </Svg>
                            <View
                              style={{
                                width: Math.round(previewSize * 1.7),
                                height: Math.round(previewSize * 1.7),
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Svg
                                width={Math.round(previewSize * 1.7)}
                                height={Math.round(previewSize * 1.7)}
                                style={{ position: 'absolute' }}
                              >
                                <Circle
                                  cx={Math.round(previewSize * 1.7) / 2}
                                  cy={Math.round(previewSize * 1.7) / 2}
                                  r={Math.round(previewSize * 1.7) / 2 - 2}
                                  fill="none"
                                  stroke={tempShapeColor}
                                  strokeWidth={2}
                                  strokeDasharray="8 6"
                                />
                              </Svg>
                              <Svg width={previewSize} height={previewSize} viewBox="0 0 100 100">
                                <Path
                                  d={DIRECTION_SENSE_SHAPE_PATHS.eee}
                                  fill="none"
                                  stroke={tempShapeColor}
                                  strokeWidth={DIRECTION_SENSE_SHAPE_STROKE_WIDTH}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  transform="rotate(48 50 50)"
                                />
                              </Svg>
                            </View>
                          </View>
                        ) : (
                          <>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(16) }}>
                              <Svg width={previewSize} height={previewSize} viewBox="0 0 100 100">
                                <Path
                                  d={DIRECTION_SENSE_SHAPE_PATHS.eee}
                                  fill="none"
                                  stroke={tempShapeColor}
                                  strokeWidth={DIRECTION_SENSE_SHAPE_STROKE_WIDTH}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  transform={directionSensePoseTransform({ orientation: 0, flipH: false })}
                                />
                              </Svg>
                              <Svg width={arrowSize} height={arrowSize} viewBox="0 0 100 100">
                                <Path
                                  d={directionSenseCurvedArrowPath(90, tempDirectionSenseTurnDirection)}
                                  fill="none"
                                  stroke={DEFAULT_DIRECTION_SENSE_ARROW_COLOR}
                                  strokeWidth={DIRECTION_SENSE_ARROW_STROKE_WIDTH}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  transform={directionSenseArrowTransform(tempDirectionSenseTurnDirection)}
                                />
                              </Svg>
                            </View>
                            <View style={{ flexDirection: 'row', gap: s(8) }}>
                              {([0, 1, 2] as const).map((ori) => (
                                <View
                                  key={ori}
                                  style={{
                                    width: optionSize,
                                    height: optionSize,
                                    borderRadius: s(12),
                                    borderWidth: 1,
                                    borderColor: '#475569',
                                    padding: s(6),
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Svg width={optionGlyph} height={optionGlyph} viewBox="0 0 100 100">
                                    <Path
                                      d={DIRECTION_SENSE_SHAPE_PATHS.eee}
                                      fill="none"
                                      stroke={tempShapeColor}
                                      strokeWidth={DIRECTION_SENSE_SHAPE_STROKE_WIDTH}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      transform={directionSensePoseTransform({ orientation: ori, flipH: false })}
                                    />
                                  </Svg>
                                </View>
                              ))}
                            </View>
                          </>
                        )}
                      </View>
                    );
                  })()}
                  <FloatingLabelInput
                    label="Patient Name"
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    variant="dark"
                    style={{ marginBottom: 0 }}
                  />
                </Card>
                <Card>
                  <Text style={{ color: '#38BDF8', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    SESSION PARAMETERS
                  </Text>
                  {!directionSenseStraightenMode ? (
                    <>
                      <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                        Turn Direction
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                        {(['cw', 'ccw'] as const).map((dir) => (
                          <Chip
                            key={dir}
                            label={directionSenseTurnDirectionLabel(dir)}
                            active={tempDirectionSenseTurnDirection === dir}
                            onPress={() => setTempDirectionSenseTurnDirection(dir)}
                          />
                        ))}
                      </View>
                      <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                        Choices per Trial
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                        {DIRECTION_SENSE_CHOICE_COUNT_PRESETS.map((n) => (
                          <Chip
                            key={n}
                            label={`${n} options`}
                            active={tempDirectionSenseChoiceCount === n}
                            onPress={() => setTempDirectionSenseChoiceCount(n)}
                          />
                        ))}
                      </View>
                    </>
                  ) : null}
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Trials
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {DIRECTION_SENSE_TRIALS_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={String(n)}
                        active={tempDirectionSenseTrials === n}
                        onPress={() => setTempDirectionSenseTrials(n)}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Shape Size
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {DIRECTION_SENSE_SHAPE_SIZE_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={`${n}px`}
                        active={tempDirectionSenseShapeSizePx === n}
                        onPress={() => setTempDirectionSenseShapeSizePx(n)}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Session Timer
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {DIRECTION_SENSE_TIME_LIMIT_PRESETS.map((sec) => (
                      <Chip
                        key={sec}
                        label={sec === 0 ? 'Off' : `${sec}s`}
                        active={tempTimeLimitSec === sec}
                        onPress={() => setTempTimeLimitSec(sec)}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Background
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginBottom: s(12) }}>
                    {DIRECTION_SENSE_BG_COLORS.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => setTempBgColor(c.code)}
                        style={{
                          width: s(56),
                          height: s(36),
                          borderRadius: s(10),
                          backgroundColor: c.code,
                          borderWidth: 2,
                          borderColor: tempBgColor === c.code ? '#38BDF8' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: c.code === '#E8ECF0' || c.code === '#F8FAFC' ? '#0F172A' : '#F8FAFC',
                            fontSize: fs(9),
                            fontWeight: '800',
                          }}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Shape Color
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                    {DIRECTION_SENSE_SHAPE_COLORS.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => setTempShapeColor(c.code)}
                        style={{
                          width: s(56),
                          height: s(36),
                          borderRadius: s(10),
                          backgroundColor: c.code,
                          borderWidth: 2,
                          borderColor: tempShapeColor === c.code ? '#38BDF8' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color:
                              c.code === '#F5F7FA' || c.code === '#FFFFFF' || c.code === '#FBBF24'
                                ? '#0F172A'
                                : '#F8FAFC',
                            fontSize: fs(9),
                            fontWeight: '800',
                          }}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {showPatternMatchControls ? (
              <>
                <Card>
                  <Text style={{ color: '#FB7185', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    LIVE CODE PREVIEW
                    {clampPatternMatchStimulusMode(patternMatchStimulusMode) === 'compound'
                      ? ' · Compound'
                      : ' · Digit'}
                  </Text>
                  {(() => {
                    const preview = patternMatchPreviewCodes(
                      tempPatternMatchCodeLength,
                      patternMatchStimulusMode,
                    );
                    return (
                      <View
                        style={{
                          minHeight: s(140),
                          borderRadius: s(16),
                          borderWidth: 1,
                          borderColor: '#1F2937',
                          backgroundColor: tempBgColor,
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: s(12),
                          marginBottom: s(12),
                          padding: s(16),
                        }}
                      >
                        <Text
                          style={{
                            color: tempShapeColor,
                            fontSize: Math.round(22 * tempLetterSize),
                            fontWeight: '900',
                            letterSpacing: 8,
                          }}
                        >
                          {preview.target}
                        </Text>
                        <View style={{ flexDirection: 'row', gap: s(8) }}>
                          {preview.field.slice(0, 3).map((c) => (
                            <View
                              key={c}
                              style={{
                                borderWidth: 1,
                                borderColor: '#475569',
                                borderRadius: s(8),
                                paddingHorizontal: s(8),
                                paddingVertical: s(4),
                              }}
                            >
                              <Text
                                style={{
                                  color: tempShapeColor,
                                  fontSize: Math.round(12 * tempLetterSize),
                                  fontWeight: '800',
                                  letterSpacing: 2,
                                }}
                              >
                                {c}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    );
                  })()}
                  <FloatingLabelInput
                    label="Patient Name"
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    variant="dark"
                    style={{ marginBottom: 0 }}
                  />
                </Card>

                <Card>
                  <Text style={{ color: '#FB7185', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    SESSION PARAMETERS
                  </Text>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Code Length
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {PATTERN_MATCH_CODE_LENGTH_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={String(n)}
                        active={tempPatternMatchCodeLength === n}
                        onPress={() => setTempPatternMatchCodeLength(n)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Flash Encoding
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {PATTERN_MATCH_FLASH_MS_PRESETS.map((ms) => (
                      <Chip
                        key={ms}
                        label={patternMatchFlashLabel(ms)}
                        active={tempPatternMatchFlashMs === ms}
                        onPress={() => setTempPatternMatchFlashMs(ms)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Field Size
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {PATTERN_MATCH_CELL_COUNT_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={String(n)}
                        active={tempPatternMatchCellCount === n}
                        onPress={() => setTempPatternMatchCellCount(n)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Hardness
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {(['easy', 'medium', 'hard'] as PatternMatchHardness[]).map((h) => (
                      <Chip
                        key={h}
                        label={patternMatchHardnessLabel(h)}
                        active={tempPatternMatchHardness === h}
                        onPress={() => setTempPatternMatchHardness(h)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Rounds
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {PATTERN_MATCH_ROUNDS_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={String(n)}
                        active={tempPatternMatchRounds === n}
                        onPress={() => setTempPatternMatchRounds(n)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Glyph Size
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {PATTERN_MATCH_LETTER_SIZE_PRESETS.map((size) => (
                      <Chip
                        key={size}
                        label={String(size)}
                        active={tempLetterSize === size}
                        onPress={() => setTempLetterSize(size)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Time Limit
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(4) }}>
                    {PATTERN_MATCH_TIME_LIMIT_PRESETS.map((sec) => (
                      <Chip
                        key={sec}
                        label={sec <= 0 ? 'Off' : `${sec}s`}
                        active={tempTimeLimitSec === sec}
                        onPress={() => setTempTimeLimitSec(sec)}
                      />
                    ))}
                  </View>
                </Card>

                <Card>
                  <Text style={{ color: '#FB7185', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    FIELD COLORS
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Background
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginBottom: s(12) }}>
                    {PATTERN_MATCH_BG_COLORS.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => setTempBgColor(c.code)}
                        style={{
                          width: s(56),
                          height: s(36),
                          borderRadius: s(10),
                          backgroundColor: c.code,
                          borderWidth: 2,
                          borderColor: tempBgColor === c.code ? '#FB7185' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: c.code === '#E8ECF0' || c.code === '#F8FAFC' ? '#0F172A' : '#F8FAFC',
                            fontSize: fs(9),
                            fontWeight: '800',
                          }}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Code Color
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                    {PATTERN_MATCH_CHAR_COLORS.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => setTempShapeColor(c.code)}
                        style={{
                          width: s(56),
                          height: s(36),
                          borderRadius: s(10),
                          backgroundColor: c.code,
                          borderWidth: 2,
                          borderColor: tempShapeColor === c.code ? '#FB7185' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color:
                              c.code === '#F5F7FA' || c.code === '#FFFFFF' || c.code === '#FBBF24'
                                ? '#0F172A'
                                : '#F8FAFC',
                            fontSize: fs(9),
                            fontWeight: '800',
                          }}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            {showNumberSearchControls ? (
              <>
                <Card>
                  <Text style={{ color: '#FBBF24', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    LIVE FIELD PREVIEW
                  </Text>
                  <View
                    style={{
                      minHeight: s(140),
                      borderRadius: s(16),
                      borderWidth: 1,
                      borderColor: '#1F2937',
                      backgroundColor: tempBgColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'row',
                      gap: s(10),
                      marginBottom: s(12),
                    }}
                  >
                    {['A', '7', 'b', '3', 'm', '9'].map((ch) => (
                      <Text
                        key={ch}
                        style={{
                          color: tempShapeColor,
                          fontSize: Math.round(16 * tempLetterSize),
                          fontWeight: '900',
                        }}
                      >
                        {ch}
                      </Text>
                    ))}
                  </View>
                  <FloatingLabelInput
                    label="Patient Name"
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    variant="dark"
                    style={{ marginBottom: 0 }}
                  />
                </Card>

                <Card>
                  <Text style={{ color: '#FBBF24', fontSize: fs(12), fontWeight: '800', letterSpacing: 1, marginBottom: s(12) }}>
                    SESSION PARAMETERS
                  </Text>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Glyph Size
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {NUMBER_SEARCH_LETTER_SIZE_PRESETS.map((size) => (
                      <Chip
                        key={size}
                        label={String(size)}
                        active={tempLetterSize === size}
                        onPress={() => setTempLetterSize(size)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Digits to Find
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {NUMBER_SEARCH_TARGET_DIGIT_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={String(n)}
                        active={tempTargetDigitCount === n}
                        onPress={() => setTempTargetDigitCount(n)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Character Layout
                  </Text>
                  <View style={{ flexDirection: 'row', gap: s(8), marginBottom: s(12) }}>
                    {(
                      [
                        { id: 'grid' as const, label: 'Organised grid' },
                        { id: 'random' as const, label: 'Random scatter' },
                      ] as const
                    ).map((opt) => (
                      <Pressable
                        key={opt.id}
                        onPress={() => setTempNumberSearchLayout(opt.id)}
                        style={{
                          flex: 1,
                          padding: s(12),
                          borderRadius: s(12),
                          backgroundColor: tempNumberSearchLayout === opt.id ? '#F59E0B' : '#1F2937',
                          borderWidth: 1,
                          borderColor: tempNumberSearchLayout === opt.id ? '#FBBF24' : 'transparent',
                        }}
                      >
                        <Text
                          style={{
                            color: tempNumberSearchLayout === opt.id ? '#0F172A' : '#D1D5DB',
                            fontSize: fs(12),
                            fontWeight: '800',
                          }}
                        >
                          {opt.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Field Character Count
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {NUMBER_SEARCH_FIELD_COUNT_PRESETS.map((n) => (
                      <Chip
                        key={n}
                        label={n === 0 ? 'Auto' : String(n)}
                        active={tempNumberSearchFieldCount === n}
                        onPress={() => setTempNumberSearchFieldCount(n)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Session Time Limit
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {NUMBER_SEARCH_TIME_LIMIT_PRESETS.map((sec) => (
                      <Chip
                        key={sec}
                        label={sec === 0 ? 'Off' : `${sec}s`}
                        active={tempTimeLimitSec === sec}
                        onPress={() => setTempTimeLimitSec(sec)}
                      />
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Engine Background
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: s(12) }}>
                    {NUMBER_SEARCH_BG_COLORS.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => setTempBgColor(c.code)}
                        style={{
                          minWidth: s(44),
                          height: s(36),
                          paddingHorizontal: s(10),
                          borderRadius: s(12),
                          marginRight: s(8),
                          marginBottom: s(8),
                          backgroundColor: c.code,
                          borderWidth: 2,
                          borderColor: tempBgColor === c.code ? '#fff' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color: c.code === '#E8ECF0' || c.code === '#F8FAFC' ? '#0F172A' : '#F8FAFC',
                            fontSize: fs(10),
                            fontWeight: '800',
                          }}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700', marginBottom: s(8) }}>
                    Character Color
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                    {NUMBER_SEARCH_CHAR_COLORS.map((c) => (
                      <Pressable
                        key={c.code}
                        onPress={() => setTempShapeColor(c.code)}
                        style={{
                          minWidth: s(44),
                          height: s(36),
                          paddingHorizontal: s(10),
                          borderRadius: s(12),
                          marginRight: s(8),
                          marginBottom: s(8),
                          backgroundColor: c.code,
                          borderWidth: 2,
                          borderColor: tempShapeColor === c.code ? '#FBBF24' : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            color:
                              c.code === '#F5F7FA' || c.code === '#FFFFFF' || c.code === '#FBBF24'
                                ? '#0F172A'
                                : '#F8FAFC',
                            fontSize: fs(10),
                            fontWeight: '800',
                          }}
                        >
                          {c.name}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </Card>
              </>
            ) : null}

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: s(10),
                borderTopWidth: 1,
                borderTopColor: '#1F2937',
                paddingTop: s(14),
                marginTop: s(8),
              }}
            >
              <Pressable
                onPress={onClose}
                style={{
                  paddingHorizontal: s(18),
                  paddingVertical: s(12),
                  borderRadius: s(12),
                  backgroundColor: 'rgba(31,41,55,0.9)',
                  borderWidth: 1,
                  borderColor: '#374151',
                }}
              >
                <Text style={{ color: '#D1D5DB', fontWeight: '700', fontSize: fs(13) }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={apply}
                style={{
                  paddingHorizontal: s(20),
                  paddingVertical: s(12),
                  borderRadius: s(12),
                  backgroundColor: '#2563EB',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(13) }}>
                  Save & Apply Settings  ✓
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {confirmApplyOpen ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.72)',
              justifyContent: 'center',
              paddingHorizontal: s(24),
              zIndex: 50,
            }}
          >
            <View
              style={{
                backgroundColor: '#1A1A1A',
                borderRadius: s(20),
                borderWidth: 1,
                borderColor: '#374151',
                padding: s(20),
              }}
            >
              <Text style={{ color: '#fff', fontSize: fs(18), fontWeight: '800', marginBottom: s(8) }}>
                Start a fresh game?
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: fs(14), lineHeight: fs(20), marginBottom: s(18) }}>
                Applying settings will end the current game and start a new one. Progress in this round will be lost.
              </Text>
              <View style={{ flexDirection: 'row', gap: s(10) }}>
                <Pressable
                  onPress={() => setConfirmApplyOpen(false)}
                  style={{
                    flex: 1,
                    backgroundColor: '#222',
                    borderWidth: 1,
                    borderColor: '#374151',
                    borderRadius: s(12),
                    paddingVertical: s(12),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#E5E7EB', fontWeight: '700' }}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setConfirmApplyOpen(false);
                    commitApply();
                  }}
                  style={{
                    flex: 1,
                    backgroundColor: '#B91C1C',
                    borderRadius: s(12),
                    paddingVertical: s(12),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Continue</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
