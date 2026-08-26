import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPEED_PRESETS, THERAPY_COLOR_ITEMS, DEFAULT_SORTING_NUMBER_FROM, DEFAULT_SORTING_NUMBER_TO, MAX_SORTING_NUMBER_COUNT, clampSortingNumberRange, clampBatchesPerSession, clampHexSizePx, clampPeripheralLetterSize, clampPeripheralTargetTimeoutSec, clampStimuliCount, DEFAULT_BUBBLE_APPEARANCE, DEFAULT_PERIPHERAL_BG_COLOR, DEFAULT_PERIPHERAL_BUBBLE_TYPE, DEFAULT_PERIPHERAL_FIXATION_COLOR, DEFAULT_PERIPHERAL_STIMULUS_COLOR, DEFAULT_STIMULI_BUBBLE_COLOR, getDeviceTier, hexVertices, peripheralHexPaint, peripheralLetterColor, peripheralLetterFontPx, peripheralMaxStimuliCount, peripheralStimuliPresets, PERIPHERAL_BATCH_PRESETS, PERIPHERAL_BG_COLORS, PERIPHERAL_DEFAULT_BATCHES, PERIPHERAL_HEX_SIZE_PRESETS, PERIPHERAL_LETTER_SIZE_PRESETS, PERIPHERAL_STIMULUS_COLORS, PERIPHERAL_TARGET_TIMEOUT_PRESETS, resolveBubblePaint, resolveStimuliBubbleColor, STIMULI_BUBBLE_COLOR_OPTIONS, STIMULI_COLOR_MIXED, type BubbleAppearance, type PeripheralBubbleType } from '@candela/shared/rn';
import type { DeviceOrientation, PursuitMovementPattern, PursuitTargetColor } from '@candela/shared/rn';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
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
  peripheralTargetTimeoutSec?: number;
  peripheralBubbleType?: PeripheralBubbleType;
}

const LETTER_SIZES = [1, 1.5, 2, 2.5, 3];
const BUBBLE_SIZES = [60, 80, 100, 120];
const WHEEL_COLORS = ['#000000', '#0B1B3A', '#1A1A1A', '#111827', '#0D0D0D', '#1E3A8A'];
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
  hexSizePx = 64,
  stimuliCount = 16,
  batchesPerSession = PERIPHERAL_DEFAULT_BATCHES,
  stimulusColor = DEFAULT_PERIPHERAL_STIMULUS_COLOR,
  fixationDotColor = DEFAULT_PERIPHERAL_FIXATION_COLOR,
  bgColor = DEFAULT_PERIPHERAL_BG_COLOR,
  peripheralTargetTimeoutSec = 0,
  peripheralBubbleType = DEFAULT_PERIPHERAL_BUBBLE_TYPE,
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
  hexSizePx?: number;
  stimuliCount?: number;
  batchesPerSession?: number;
  stimulusColor?: string;
  fixationDotColor?: string;
  bgColor?: string;
  peripheralTargetTimeoutSec?: number;
  peripheralBubbleType?: PeripheralBubbleType;
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
    if (showPeripheralViewControls) {
      setTempLetterSize(clampPeripheralLetterSize(letterSize));
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

  const apply = () => {
    const numberRange = clampSortingNumberRange(tempNumberRangeFrom, tempNumberRangeTo);
    onApply({
      patientName: tempPatientName,
      letterSize: tempLetterSize,
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
      peripheralTargetTimeoutSec: clampPeripheralTargetTimeoutSec(tempPeripheralTargetTimeoutSec),
      peripheralBubbleType: tempPeripheralBubbleType,
    });
  };

  const isBubbleGame = !showBeeTracingControls && !showPursuitControls && !showPeripheralViewControls;
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
                  <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
                    PATIENT PROFILE
                  </Text>
                  <TextInput
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    placeholder="Enter patient name..."
                    placeholderTextColor="#9CA3AF"
                    style={{
                      backgroundColor: '#141414',
                      color: '#fff',
                      borderRadius: s(12),
                      padding: s(12),
                      borderWidth: 1,
                      borderColor: '#374151',
                    }}
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
                        <Text style={{ color: '#9CA3AF', fontSize: fs(10), marginBottom: s(4) }}>FROM</Text>
                        <TextInput
                          keyboardType="number-pad"
                          value={String(Number.isFinite(tempNumberRangeFrom) ? tempNumberRangeFrom : '')}
                          onChangeText={(text) => setTempNumberRangeFrom(parseInt(text, 10))}
                          style={{
                            backgroundColor: '#141414',
                            color: '#fff',
                            borderRadius: s(12),
                            padding: s(12),
                            borderWidth: 1,
                            borderColor: '#374151',
                            fontWeight: '800',
                          }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#9CA3AF', fontSize: fs(10), marginBottom: s(4) }}>TO</Text>
                        <TextInput
                          keyboardType="number-pad"
                          value={String(Number.isFinite(tempNumberRangeTo) ? tempNumberRangeTo : '')}
                          onChangeText={(text) => setTempNumberRangeTo(parseInt(text, 10))}
                          style={{
                            backgroundColor: '#141414',
                            color: '#fff',
                            borderRadius: s(12),
                            padding: s(12),
                            borderWidth: 1,
                            borderColor: '#374151',
                            fontWeight: '800',
                          }}
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
                        WHEEL COLOR
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
                        <TextInput
                          value={tempWheelColor}
                          onChangeText={setTempWheelColor}
                          autoCapitalize="none"
                          style={{ color: '#E5E7EB', minWidth: s(80), fontSize: fs(13), fontWeight: '700' }}
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: s(10) }}>
                      {WHEEL_COLORS.map((c) => (
                        <Pressable
                          key={c}
                          onPress={() => setTempWheelColor(c)}
                          style={{
                            width: s(28),
                            height: s(28),
                            borderRadius: s(14),
                            backgroundColor: c,
                            marginRight: s(8),
                            borderWidth: tempWheelColor.toLowerCase() === c.toLowerCase() ? 2 : 1,
                            borderColor: tempWheelColor.toLowerCase() === c.toLowerCase() ? '#60A5FA' : '#4B5563',
                          }}
                        />
                      ))}
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
                  <Text style={{ color: '#E5E7EB', fontSize: fs(12), fontWeight: '800', letterSpacing: 0.8, marginBottom: s(8) }}>
                    PATIENT PROFILE
                  </Text>
                  <TextInput
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    placeholder="Enter patient name..."
                    placeholderTextColor="#9CA3AF"
                    style={{
                      backgroundColor: '#141414',
                      color: '#fff',
                      borderRadius: s(12),
                      padding: s(12),
                      borderWidth: 1,
                      borderColor: '#374151',
                    }}
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
                <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Patient name</Text>
                <TextInput
                  value={tempPatientName}
                  onChangeText={setTempPatientName}
                  placeholder="Enter patient name..."
                  placeholderTextColor="#9CA3AF"
                  style={{
                    backgroundColor: '#141414',
                    color: '#fff',
                    borderRadius: s(12),
                    padding: s(12),
                    marginBottom: s(16),
                    borderWidth: 1,
                    borderColor: '#374151',
                  }}
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
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, marginBottom: s(8) }}>
                    PATIENT NAME
                  </Text>
                  <TextInput
                    value={tempPatientName}
                    onChangeText={setTempPatientName}
                    placeholder="Enter patient name..."
                    placeholderTextColor="#9CA3AF"
                    style={{
                      backgroundColor: '#141414',
                      color: '#fff',
                      borderRadius: s(12),
                      padding: s(12),
                      marginBottom: s(14),
                      borderWidth: 1,
                      borderColor: '#374151',
                    }}
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
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(13) }}>Save & Apply Settings  ✓</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
