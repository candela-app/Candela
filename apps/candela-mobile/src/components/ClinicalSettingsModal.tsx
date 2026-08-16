import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPEED_PRESETS } from '@candela/shared/rn';
import type { DeviceOrientation, PursuitMovementPattern, PursuitTargetColor } from '@candela/shared/rn';
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
}

const LETTER_SIZES = [1, 1.4, 1.8, 2.2, 2.6, 3];
const BUBBLE_SIZES = [50, 70, 90, 110, 130];
const WHEEL_COLORS = ['#000000', '#0B1B3A', '#1A1A1A', '#111827'];
const PATH_TYPES = ['auto', 'straight', 'curve', 'zigzag', 'wave', 'spiral', 'branching', 'dotted', 'random'];
const PURSUIT_PATTERNS: PursuitMovementPattern[] = [
  'linear_bounce',
  'circular_orbit',
  'figure_eight',
  'random_walk',
  'freeze_drift',
];
const PURSUIT_COLORS: PursuitTargetColor[] = ['#FFFFFF', '#FFD600', '#00E5FF'];

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
  showBeeTracingControls = false,
  tracingMode = 'active',
  pathType = 'auto',
  toleranceBandPx = 40,
  colorTheme = 'dark',
  audioEnabled = true,
  roundsPerSet = 7,
  pathComplexity = 'medium',
  beeSpeedSec = 5,
  orientation = 'auto',
  showPursuitControls = false,
  pursuitMovementPattern = 'linear_bounce',
  pursuitTargetColor = '#00E5FF',
  pursuitDecoyCount = 2,
  pursuitSpeedPxPerSec = 180,
  pursuitTrialTimeoutSec = 5,
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
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();
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

  useEffect(() => {
    if (!isOpen) return;
    setTempPatientName(patientName);
    setTempLetterSize(letterSize);
    setTempBubbleSize(bubbleSize);
    setTempSpeed(speed);
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
  }, [
    isOpen,
    patientName,
    letterSize,
    bubbleSize,
    speed,
    wheelColor,
    tracingMode,
    pathType,
    toleranceBandPx,
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
  ]);

  if (!isOpen) return null;

  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#0B1020', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: s(16), paddingVertical: s(12) }}>
          <Text style={{ color: '#fff', fontSize: fs(20), fontWeight: '800' }}>Clinical Settings</Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: '#9CA3AF', fontSize: fs(16), fontWeight: '700' }}>Close</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: s(16), paddingBottom: s(40) }}>
          <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(6) }}>Patient name</Text>
          <TextInput
            value={tempPatientName}
            onChangeText={setTempPatientName}
            style={{
              backgroundColor: '#111827',
              color: '#fff',
              borderRadius: s(12),
              padding: s(12),
              marginBottom: s(16),
              borderWidth: 1,
              borderColor: '#374151',
            }}
          />

          <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Letter size</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {LETTER_SIZES.map((n) => (
              <Chip key={n} label={`${n}`} active={tempLetterSize === n} onPress={() => setTempLetterSize(n)} />
            ))}
          </View>

          <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8), marginTop: s(8) }}>
            Bubble size
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {BUBBLE_SIZES.map((n) => (
              <Chip key={n} label={`${n}px`} active={tempBubbleSize === n} onPress={() => setTempBubbleSize(n)} />
            ))}
          </View>

          {showSpeedControl ? (
            <>
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8), marginTop: s(8) }}>
                Speed
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {SPEED_PRESETS.map((n) => (
                  <Chip key={n} label={`${n}x`} active={tempSpeed === n} onPress={() => setTempSpeed(n)} />
                ))}
              </View>
            </>
          ) : null}

          {showWheelColorControl ? (
            <>
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8), marginTop: s(8) }}>
                Wheel color
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {WHEEL_COLORS.map((c) => (
                  <Chip key={c} label={c} active={tempWheelColor === c} onPress={() => setTempWheelColor(c)} />
                ))}
              </View>
            </>
          ) : null}

          {showBeeTracingControls ? (
            <>
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8), marginTop: s(8) }}>
                Tracing mode
              </Text>
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
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[24, 40, 56, 72].map((n) => (
                  <Chip key={n} label={`${n}px`} active={tempTolerance === n} onPress={() => setTempTolerance(n)} />
                ))}
              </View>
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
                {[1, 3, 5, 7].map((n) => (
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
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8), marginTop: s(8) }}>
                Movement
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {PURSUIT_PATTERNS.map((p) => (
                  <Chip key={p} label={p} active={tempPattern === p} onPress={() => setTempPattern(p)} />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Target color</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {PURSUIT_COLORS.map((c) => (
                  <Chip key={c} label={c} active={tempTargetColor === c} onPress={() => setTempTargetColor(c)} />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Decoys</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[1, 2, 3].map((n) => (
                  <Chip key={n} label={`${n}`} active={tempDecoys === n} onPress={() => setTempDecoys(n)} />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Speed px/s</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[120, 180, 240, 300].map((n) => (
                  <Chip key={n} label={`${n}`} active={tempPursuitSpeed === n} onPress={() => setTempPursuitSpeed(n)} />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(13), fontWeight: '600', marginBottom: s(8) }}>Trial timeout</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[3, 5, 7, 10].map((n) => (
                  <Chip key={n} label={`${n}s`} active={tempTimeout === n} onPress={() => setTempTimeout(n)} />
                ))}
              </View>
            </>
          ) : null}

          <Pressable
            onPress={() =>
              onApply({
                patientName: tempPatientName,
                letterSize: tempLetterSize,
                bubbleSize: tempBubbleSize,
                speed: tempSpeed,
                wheelColor: tempWheelColor,
                tracingMode: tempTracingMode,
                pathType: tempPathType,
                toleranceBandPx: tempTolerance,
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
              })
            }
            style={{
              marginTop: s(16),
              backgroundColor: '#10B981',
              borderRadius: s(14),
              paddingVertical: s(14),
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#022c22', fontWeight: '800', fontSize: fs(16) }}>Apply & Start</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
