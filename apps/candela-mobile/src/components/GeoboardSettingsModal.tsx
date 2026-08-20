import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GEOBOARD_PEN_COLORS,
  GEOBOARD_PEG_SIZE_PRESETS,
  getContrastAdjustedColor,
  getPenColorName,
  type AlphabetVariant,
  type GeoboardMatrixTier,
  type GeoboardProtocol,
  type GeoboardTransform,
} from '@candela/shared/rn';
import { useLayout } from '../lib/layout';

const BOARD_COLORS = ['#FFFFFF', '#F2F5F3', '#0B1220', '#111827'];
const MODEL_COLORS = ['#000000', '#1F2937', '#1F6F6A', '#E2B93B'];
const DOT_COLORS = ['#111827', '#64748B', '#0F766E', '#0284C7', '#D97706', '#F8FAFC'];
const DOT_ACTIVE_COLORS = ['#0284C7', '#0D9488', '#F59E0B', '#F43F5E', '#8B5CF6', '#111827'];
const TRANSFORMS: { id: GeoboardTransform; label: string }[] = [
  { id: 'duplicate', label: 'Duplicate' },
  { id: 'flip_h', label: 'Mirror H' },
  { id: 'flip_v', label: 'Mirror V' },
  { id: 'rotate_90_r', label: 'Rotate 90° R' },
  { id: 'rotate_90_l', label: 'Rotate 90° L' },
];

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
  activeColor = '#14B8A6',
  half = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  activeColor?: string;
  half?: boolean;
}) {
  const { fs, s } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: half ? undefined : 1,
        width: half ? '47%' : undefined,
        minWidth: 0,
        paddingVertical: s(8),
        paddingHorizontal: s(6),
        borderRadius: s(10),
        backgroundColor: active ? activeColor : '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        numberOfLines={1}
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

export function GeoboardSettingsModal({
  isOpen,
  onClose,
  onApply,
  protocol,
  boardName,
  supportsLetterCase,
  beginnerLineBoard = false,
  patternCount,
}: {
  isOpen: boolean;
  onClose: () => void;
  onApply: (next: GeoboardProtocol) => void;
  protocol: GeoboardProtocol;
  boardName: string;
  supportsLetterCase: boolean;
  beginnerLineBoard?: boolean;
  patternCount: number;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();
  const [draft, setDraft] = useState(protocol);

  useEffect(() => {
    if (isOpen) {
      setDraft({
        ...protocol,
        dotColor: protocol.dotColor || '#111827',
        dotActiveColor: protocol.dotActiveColor || '#0284C7',
        pegSizeScale: protocol.pegSizeScale ?? 1,
      });
    }
  }, [isOpen, protocol]);

  const patch = (partial: Partial<GeoboardProtocol>) => setDraft((prev) => ({ ...prev, ...partial }));
  const previewColor = getContrastAdjustedColor(draft.shapeColor, draft.bgColor, draft.contrastSensitivity);
  const previewPeg = Math.max(8, Math.round(s(16) * (draft.pegSizeScale ?? 1)));

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
          <View style={{ backgroundColor: '#1A1A1A', borderRadius: s(20), borderWidth: 1, borderColor: '#374151', padding: s(16), overflow: 'hidden' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: s(14) }}>
              <View style={{ flex: 1, paddingRight: s(10) }}>
                <Text style={{ color: '#fff', fontSize: fs(20), fontWeight: '800' }}>Clinical Configuration</Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(12), marginTop: s(4) }}>
                  Configure this board. Every pattern runs in order.
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
            <Card title="Session & Stimulus" color="#2DD4BF">
              <View style={{ backgroundColor: '#141414', borderRadius: s(12), padding: s(12), borderWidth: 1, borderColor: '#1F2937' }}>
                <Text style={{ color: '#F3F4F6', fontWeight: '700', fontSize: fs(13) }}>{boardName}</Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: s(2) }}>
                  {supportsLetterCase && draft.alphabetVariant === 'lowercase'
                    ? `${patternCount} patterns · lowercase set`
                    : `${patternCount} patterns in this playlist`}
                </Text>
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>PATIENT NAME</Text>
              <TextInput
                value={draft.patientName}
                onChangeText={(patientName) => patch({ patientName })}
                placeholder="Enter patient name..."
                placeholderTextColor="#6B7280"
                style={{
                  backgroundColor: '#141414',
                  color: '#fff',
                  borderWidth: 1,
                  borderColor: '#374151',
                  borderRadius: s(12),
                  paddingHorizontal: s(12),
                  paddingVertical: s(10),
                  fontSize: fs(14),
                }}
              />
              {supportsLetterCase ? (
                <>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>LETTER CASE</Text>
                  <View style={{ flexDirection: 'row', gap: s(8) }}>
                    {([
                      { id: 'uppercase' as AlphabetVariant, label: 'Uppercase  A B C' },
                      { id: 'lowercase' as AlphabetVariant, label: 'Lowercase  a b c' },
                    ]).map((item) => (
                      <Option
                        key={item.id}
                        label={item.label}
                        active={draft.alphabetVariant === item.id}
                        onPress={() => patch({ alphabetVariant: item.id })}
                      />
                    ))}
                  </View>
                  <Text style={{ color: '#6B7280', fontSize: fs(11) }}>
                    The lowercase set omits a, e, s and g — their curves are not legible on a 5×5 dot grid.
                  </Text>
                </>
              ) : null}
              {beginnerLineBoard ? (
                <Text style={{ color: '#9CA3AF', fontSize: fs(12), lineHeight: fs(18) }}>
                  First the reference line stays on screen so they can copy a standing (vertical) or steep (horizontal)
                  line. Later the reference is hidden and they draw the same kind of line on their own.
                </Text>
              ) : (
                <>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>MATRIX DENSITY (DOT SUPPORT)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
                {([
                  { label: '25', val: 1 as GeoboardMatrixTier },
                  { label: '17', val: 2 as GeoboardMatrixTier },
                  { label: '13', val: 3 as GeoboardMatrixTier },
                  { label: '9', val: 4 as GeoboardMatrixTier },
                  { label: '5', val: 5 as GeoboardMatrixTier },
                ]).map((tier) => (
                  <Option
                    key={tier.val}
                    label={tier.label}
                    active={draft.matrixTier === tier.val}
                    onPress={() => patch({ matrixTier: tier.val })}
                  />
                ))}
              </View>
              <Text style={{ color: '#6B7280', fontSize: fs(11) }}>
                Visible dots on the answer grid. Fewer dots removes scaffolding and loads spatial memory.
              </Text>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>RESPONSE TRANSFORM</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {TRANSFORMS.map((item) => (
                  <Option
                    key={item.id}
                    label={item.label}
                    active={draft.transform === item.id}
                    onPress={() => patch({ transform: item.id })}
                    half
                  />
                ))}
              </View>
                </>
              )}
            </Card>

            <Card title="Difficulty & Presentation" color="#FBBF24">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: s(12) }}>
                  <Text style={{ color: '#E5E7EB', fontSize: fs(13), fontWeight: '700' }}>Memory Mode</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>Hide the model after a preview interval</Text>
                </View>
                <Pressable
                  onPress={() => patch({ memoryMode: !draft.memoryMode })}
                  style={{
                    paddingHorizontal: s(14),
                    paddingVertical: s(8),
                    borderRadius: s(12),
                    backgroundColor: draft.memoryMode ? '#F59E0B' : '#1F2937',
                  }}
                >
                  <Text style={{ color: draft.memoryMode ? '#0F172A' : '#9CA3AF', fontWeight: '900', fontSize: fs(12) }}>
                    {draft.memoryMode ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>
              {draft.memoryMode ? (
                <>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>PREVIEW DURATION · {draft.memorizeSec}s</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                    {[2, 5, 8, 10, 15].map((sec) => (
                      <Option
                        key={sec}
                        label={`${sec}s`}
                        active={draft.memorizeSec === sec}
                        onPress={() => patch({ memorizeSec: sec })}
                        activeColor="#F59E0B"
                        half
                      />
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>TIME LIMIT PER PATTERN</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
                {[
                  { label: 'Off', val: 0 },
                  { label: '15s', val: 15 },
                  { label: '30s', val: 30 },
                  { label: '45s', val: 45 },
                  { label: '60s', val: 60 },
                ].map((tl) => (
                  <Option
                    key={tl.val}
                    label={tl.label}
                    active={draft.timeLimitSec === tl.val}
                    onPress={() => patch({ timeLimitSec: tl.val })}
                    activeColor="#F59E0B"
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1, paddingRight: s(12) }}>
                  <Text style={{ color: '#E5E7EB', fontSize: fs(13), fontWeight: '700' }}>Metronome Pacing</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>Audible beat to time each connection</Text>
                </View>
                <Pressable
                  onPress={() => patch({ metronomeEnabled: !draft.metronomeEnabled })}
                  style={{
                    paddingHorizontal: s(14),
                    paddingVertical: s(8),
                    borderRadius: s(12),
                    backgroundColor: draft.metronomeEnabled ? '#10B981' : '#1F2937',
                  }}
                >
                  <Text style={{ color: draft.metronomeEnabled ? '#0F172A' : '#9CA3AF', fontWeight: '900', fontSize: fs(12) }}>
                    {draft.metronomeEnabled ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>
              {draft.metronomeEnabled ? (
                <>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>TEMPO · {draft.bpm} BPM</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                    {[40, 60, 80, 100, 120, 140].map((bpm) => (
                      <Option
                        key={bpm}
                        label={`${bpm}`}
                        active={draft.bpm === bpm}
                        onPress={() => patch({ bpm })}
                        activeColor="#10B981"
                      />
                    ))}
                  </View>
                </>
              ) : null}
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>OCULARITY</Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {([
                  { label: 'Right Eye', val: 'R' as const },
                  { label: 'Left Eye', val: 'L' as const },
                  { label: 'Binocular', val: 'Both' as const },
                ]).map((oc) => (
                  <Option
                    key={oc.val}
                    label={oc.label}
                    active={draft.ocularity === oc.val}
                    onPress={() => patch({ ocularity: oc.val })}
                    activeColor="#3B82F6"
                  />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>
                STIMULUS CONTRAST · {Math.round(draft.contrastSensitivity * 100)}%
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {[0.25, 0.5, 0.75, 1].map((val) => (
                  <Option
                    key={val}
                    label={`${Math.round(val * 100)}%`}
                    active={draft.contrastSensitivity === val}
                    onPress={() => patch({ contrastSensitivity: val })}
                    activeColor="#3B82F6"
                  />
                ))}
              </View>
              <View style={{ height: s(44), borderRadius: s(12), borderWidth: 1, borderColor: '#374151', backgroundColor: draft.bgColor, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: previewColor, fontWeight: '900', letterSpacing: 2 }}>PREVIEW</Text>
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>PEN COLOUR · {getPenColorName(draft.penColor)}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {GEOBOARD_PEN_COLORS.map((preset) => (
                  <Pressable
                    key={preset.hex}
                    onPress={() => patch({ penColor: preset.hex })}
                    style={{
                      width: s(36),
                      height: s(36),
                      borderRadius: s(10),
                      backgroundColor: preset.hex,
                      borderWidth: draft.penColor.toLowerCase() === preset.hex.toLowerCase() ? 2 : 0,
                      borderColor: '#fff',
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>BOARD</Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {BOARD_COLORS.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => patch({ bgColor: hex })}
                    style={{
                      flex: 1,
                      height: s(32),
                      borderRadius: s(8),
                      backgroundColor: hex,
                      borderWidth: draft.bgColor === hex ? 2 : 1,
                      borderColor: draft.bgColor === hex ? '#14B8A6' : '#374151',
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>MODEL</Text>
              <View style={{ flexDirection: 'row', gap: s(8) }}>
                {MODEL_COLORS.map((hex) => (
                  <Pressable
                    key={hex}
                    onPress={() => patch({ shapeColor: hex })}
                    style={{
                      flex: 1,
                      height: s(32),
                      borderRadius: s(8),
                      backgroundColor: hex,
                      borderWidth: draft.shapeColor === hex ? 2 : 1,
                      borderColor: draft.shapeColor === hex ? '#14B8A6' : '#374151',
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>DOT COLOUR</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {DOT_COLORS.map((hex) => (
                  <Pressable
                    key={`idle-${hex}`}
                    onPress={() => patch({ dotColor: hex })}
                    style={{
                      width: s(36),
                      height: s(36),
                      borderRadius: s(18),
                      backgroundColor: hex,
                      borderWidth: (draft.dotColor || '#111827') === hex ? 2 : 1,
                      borderColor: (draft.dotColor || '#111827') === hex ? '#fff' : '#374151',
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>ACTIVE DOT COLOUR</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                {DOT_ACTIVE_COLORS.map((hex) => (
                  <Pressable
                    key={`active-${hex}`}
                    onPress={() => patch({ dotActiveColor: hex })}
                    style={{
                      width: s(36),
                      height: s(36),
                      borderRadius: s(18),
                      backgroundColor: hex,
                      borderWidth: (draft.dotActiveColor || '#0284C7') === hex ? 2 : 1,
                      borderColor: (draft.dotActiveColor || '#0284C7') === hex ? '#fff' : '#374151',
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800' }}>PEG SIZE</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: s(8) }}>
                {GEOBOARD_PEG_SIZE_PRESETS.map((preset) => (
                  <Option
                    key={preset.id}
                    label={preset.label}
                    active={Math.abs((draft.pegSizeScale ?? 1) - preset.scale) < 0.01}
                    onPress={() => patch({ pegSizeScale: preset.scale })}
                    activeColor="#F59E0B"
                  />
                ))}
              </View>
              <View
                style={{
                  marginTop: s(4),
                  borderRadius: s(12),
                  borderWidth: 1,
                  borderColor: '#374151',
                  backgroundColor: draft.bgColor,
                  paddingVertical: s(14),
                  paddingHorizontal: s(16),
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: s(14),
                }}
              >
                {[0, 1, 2, 3, 4].map((idx) => (
                  <View
                    key={idx}
                    style={{
                      width: previewPeg,
                      height: previewPeg,
                      borderRadius: previewPeg / 2,
                      backgroundColor: idx === 2 ? draft.dotActiveColor || '#0284C7' : draft.dotColor || '#111827',
                      borderWidth: previewPeg >= 14 ? 2 : 1,
                      borderColor: draft.bgColor === '#FFFFFF' || draft.bgColor === '#F2F5F3' ? '#E5E7EB' : '#94A3B8',
                    }}
                  />
                ))}
              </View>
              <Text style={{ color: '#6B7280', fontSize: fs(11), textAlign: 'center' }}>
                Dot preview · size and colours
              </Text>
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
                onPress={() => onApply(draft)}
                style={{
                  paddingHorizontal: s(18),
                  paddingVertical: s(12),
                  borderRadius: s(12),
                  backgroundColor: '#14B8A6',
                }}
              >
                <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: fs(13) }}>Apply & Start</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}
