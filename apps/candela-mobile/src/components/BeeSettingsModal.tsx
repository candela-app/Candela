import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BeeTracingSettings, ColorTheme, DeviceOrientation, PathComplexity, TracingMode } from '@candela/shared/rn';
import { BEE_TARGET_DOT_COLORS, DEFAULT_BEE_TARGET_DOT_COLOR } from '@candela/shared/rn';
import { FloatingLabelInput } from './FloatingLabelInput';
import { useLayout } from '../lib/layout';

function Card({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  const { fs, s } = useLayout();
  return (
    <View
      style={{
        backgroundColor: '#242424',
        borderRadius: s(16),
        borderWidth: 1,
        borderColor: '#1F2937',
        padding: s(16),
        marginBottom: s(12),
        gap: s(12),
      }}
    >
      <Text
        style={{
          color,
          fontSize: fs(12),
          fontWeight: '800',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          borderBottomWidth: 1,
          borderBottomColor: '#1F2937',
          paddingBottom: s(8),
        }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
}

function Option({
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
        flex: 1,
        minWidth: '30%',
        paddingVertical: s(10),
        paddingHorizontal: s(8),
        borderRadius: s(12),
        backgroundColor: active ? '#F59E0B' : '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: active ? '#0F172A' : '#D1D5DB',
          fontSize: fs(11),
          fontWeight: '800',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function BeeSettingsModal({
  isOpen,
  onClose,
  settings,
  onApply,
  sessionInProgress = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  settings: BeeTracingSettings;
  onApply: (next: BeeTracingSettings) => void;
  sessionInProgress?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s, isTablet } = useLayout();
  const [draft, setDraft] = useState<BeeTracingSettings>(settings);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...settings,
        toleranceBandPx: settings.toleranceBandPx <= 12 ? 12 : 24,
      });
      setConfirmApplyOpen(false);
    }
  }, [isOpen, settings]);

  const patch = (next: Partial<BeeTracingSettings>) => setDraft((prev) => ({ ...prev, ...next }));

  const commitApply = () =>
    onApply({
      ...draft,
      toleranceBandPx: draft.pathType === 'spiral' ? 12 : draft.toleranceBandPx,
    });
  const settingsHaveChanged = () => {
    const next = {
      ...draft,
      toleranceBandPx: draft.pathType === 'spiral' ? 12 : draft.toleranceBandPx,
    };
    const baseline = {
      ...settings,
      toleranceBandPx: settings.pathType === 'spiral' ? 12 : settings.toleranceBandPx <= 12 ? 12 : 24,
    };
    return JSON.stringify(next) !== JSON.stringify(baseline);
  };
  const handleApply = () => {
    if (sessionInProgress) {
      if (!settingsHaveChanged()) {
        onClose();
        return;
      }
      setConfirmApplyOpen(true);
      return;
    }
    commitApply();
  };

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
        <ScrollView contentContainerStyle={{ paddingVertical: s(8) }}>
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: s(24), borderWidth: 1, borderColor: '#374151', padding: s(18) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s(16) }}>
              <View style={{ flex: 1, paddingRight: s(12) }}>
                <Text style={{ color: '#fff', fontSize: fs(22), fontWeight: '900' }}>Clinical Configuration</Text>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: s(6),
                    backgroundColor: 'rgba(59,130,246,0.2)',
                    borderWidth: 1,
                    borderColor: 'rgba(59,130,246,0.35)',
                    borderRadius: 999,
                    paddingHorizontal: s(10),
                    paddingVertical: s(4),
                  }}
                >
                  <Text style={{ color: '#60A5FA', fontSize: fs(10), fontWeight: '800', letterSpacing: 1.2 }}>VISION THERAPY</Text>
                </View>
                <Text style={{ color: '#9CA3AF', fontSize: fs(12), marginTop: s(8) }}>
                  Configure ocular pursuit parameters, low-vision contrast, and tolerance corridors
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

            <Card title="Patient & Session Configuration" color="#60A5FA">
              <FloatingLabelInput
                label="Patient Name"
                value={draft.patientName}
                onChangeText={(patientName) => patch({ patientName })}
                variant="dark"
                style={{ marginBottom: 0 }}
              />
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>ROUNDS PER SESSION / SET</Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {[
                  { label: '5 Rounds', val: 5 },
                  { label: '7 Rounds', val: 7 },
                  { label: '10 Rounds (All)', val: 10 },
                ].map((item) => (
                  <Option
                    key={item.val}
                    label={item.label}
                    active={draft.roundsPerSet === item.val}
                    onPress={() => patch({ roundsPerSet: item.val })}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: s(4) }}>
                <View style={{ flex: 1, paddingRight: s(12) }}>
                  <Text style={{ color: '#E5E7EB', fontSize: fs(13), fontWeight: '700' }}>Multisensory Audio FX</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>Bee buzz & off-trail warning hums</Text>
                </View>
                <Pressable
                  onPress={() => patch({ audioEnabled: !draft.audioEnabled })}
                  style={{
                    paddingHorizontal: s(14),
                    paddingVertical: s(8),
                    borderRadius: s(12),
                    backgroundColor: draft.audioEnabled ? '#10B981' : '#1F2937',
                  }}
                >
                  <Text style={{ color: draft.audioEnabled ? '#022c22' : '#9CA3AF', fontWeight: '900', fontSize: fs(11) }}>
                    {draft.audioEnabled ? 'ENABLED' : 'MUTED'}
                  </Text>
                </Pressable>
              </View>
            </Card>

            <Card title="Tracing Mechanics & Mode" color="#FBBF24">
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>TRACING MODE</Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                <Option
                  label="Active Trace (Manual Pursuit)"
                  active={draft.tracingMode === 'active'}
                  onPress={() => patch({ tracingMode: 'active' as TracingMode })}
                />
                <Option
                  label="Guided Trace (Demo First)"
                  active={draft.tracingMode === 'guided'}
                  onPress={() => patch({ tracingMode: 'guided' as TracingMode })}
                />
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                BEE SPEED & PURSUIT RESPONSIVENESS
              </Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {[
                  { label: 'Slow (10s)', val: 10 },
                  { label: 'Normal (5s)', val: 5 },
                  { label: 'Fast (2.5s)', val: 2.5 },
                ].map((item) => (
                  <Option
                    key={item.val}
                    label={item.label}
                    active={draft.beeSpeedSec === item.val}
                    onPress={() => patch({ beeSpeedSec: item.val })}
                  />
                ))}
              </View>
            </Card>

            <Card title="Path Complexity" color="#34D399">
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                PATH LENGTH & COMPLEXITY
              </Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {[
                  { id: 'medium' as PathComplexity, label: 'Medium' },
                  { id: 'short' as PathComplexity, label: 'Short' },
                  { id: 'long' as PathComplexity, label: 'Long / Complex' },
                ].map((item) => (
                  <Option
                    key={item.id}
                    label={item.label}
                    active={(draft.pathComplexity || 'medium') === item.id}
                    onPress={() => patch({ pathComplexity: item.id })}
                  />
                ))}
              </View>
              {!isTablet ? (
                <>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                    DEVICE ORIENTATION & PRIMARY MOTION AXIS
                  </Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(12) }}>Portrait only on phones</Text>
                </>
              ) : (
                <>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                    DEVICE ORIENTATION & PRIMARY MOTION AXIS
                  </Text>
                  <View style={{ flexDirection: 'row', gap: s(8) }}>
                    {[
                      { id: 'auto' as DeviceOrientation, label: 'Auto' },
                      { id: 'landscape' as DeviceOrientation, label: 'Landscape' },
                      { id: 'portrait' as DeviceOrientation, label: 'Portrait' },
                    ].map((item) => (
                      <Option
                        key={item.id}
                        label={item.label}
                        active={(draft.orientation || 'auto') === item.id}
                        onPress={() => patch({ orientation: item.id })}
                      />
                    ))}
                  </View>
                </>
              )}
            </Card>

            <Card title="Visual & Contrast Theme" color="#C084FC">
              {draft.pathType !== 'spiral' ? (
                <>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                  PATH WIDTH
                </Text>
                <Text style={{ color: '#C084FC', fontWeight: '900', fontSize: fs(12) }}>{draft.toleranceBandPx}px</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {[
                  { label: 'Wide (24px)', val: 24 },
                  { label: 'Narrow (12px)', val: 12 },
                ].map((item) => (
                  <Option
                    key={item.val}
                    label={item.label}
                    active={draft.toleranceBandPx === item.val}
                    onPress={() => patch({ toleranceBandPx: item.val })}
                  />
                ))}
              </View>
                </>
              ) : null}
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                THERAPY COLOR THEME
              </Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {[
                  { id: 'dark' as ColorTheme, label: 'Dark Clinical' },
                  { id: 'standard' as ColorTheme, label: 'Clinical Light' },
                ].map((item) => (
                  <Option
                    key={item.id}
                    label={item.label}
                    active={(draft.colorTheme === 'high_contrast' ? 'standard' : draft.colorTheme) === item.id}
                    onPress={() => patch({ colorTheme: item.id })}
                  />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                TARGET DOT COLOR
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {BEE_TARGET_DOT_COLORS.map((swatch) => (
                  <Pressable
                    key={swatch.code}
                    onPress={() => patch({ targetDotColor: swatch.code })}
                    style={{
                      width: s(36),
                      height: s(36),
                      borderRadius: s(18),
                      backgroundColor: swatch.code,
                      borderWidth: (draft.targetDotColor || DEFAULT_BEE_TARGET_DOT_COLOR) === swatch.code ? 3 : 0,
                      borderColor: '#fff',
                    }}
                  />
                ))}
              </View>
            </Card>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(10), paddingTop: s(8) }}>
              <Pressable
                onPress={onClose}
                style={{
                  paddingHorizontal: s(18),
                  paddingVertical: s(12),
                  borderRadius: s(12),
                  backgroundColor: '#1F2937',
                  borderWidth: 1,
                  borderColor: '#374151',
                }}
              >
                <Text style={{ color: '#D1D5DB', fontWeight: '700', fontSize: fs(13) }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleApply}
                style={{
                  paddingHorizontal: s(18),
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
