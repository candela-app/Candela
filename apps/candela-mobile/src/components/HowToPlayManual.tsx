import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { getHowToPlay, type HowToPlayMode, type TherapyModuleId } from '@candela/shared/rn';
import { useLayout } from '../lib/layout';

function VisualFrame({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        height: 168,
        borderRadius: 20,
        backgroundColor: '#0B1220',
        borderWidth: 1,
        borderColor: '#1F2937',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      {children}
    </View>
  );
}

function HowToPlayVisual({ moduleId }: { moduleId: TherapyModuleId }) {
  switch (moduleId) {
    case 'rotatory':
      return (
        <VisualFrame>
          <View style={{ width: 128, height: 128, borderRadius: 64, backgroundColor: '#111827', borderWidth: 6, borderColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' }}>
            {[
              { x: 64, y: 16, label: 'A', color: '#34D399' },
              { x: 112, y: 64, label: 'B', color: '#60A5FA' },
              { x: 64, y: 112, label: 'C', color: '#FBBF24' },
              { x: 16, y: 64, label: 'D', color: '#F472B6' },
            ].map((b) => (
              <View
                key={b.label}
                style={{
                  position: 'absolute',
                  left: b.x - 16,
                  top: b.y - 16,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: b.color,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#052e1c', fontWeight: '900', fontSize: 13 }}>{b.label}</Text>
              </View>
            ))}
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#34D399', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#052e1c', fontWeight: '900' }}>A</Text>
            </View>
          </View>
        </VisualFrame>
      );
    case 'sorting':
      return (
        <VisualFrame>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            {['1', '2', '3'].map((n, i) => (
              <View key={n} style={{ alignItems: 'center', gap: 6 }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    backgroundColor: i === 0 ? '#34D399' : '#1F2937',
                    borderWidth: 2,
                    borderColor: i === 0 ? '#6EE7B7' : '#374151',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: i === 0 ? '#052e1c' : '#E5E7EB', fontWeight: '900', fontSize: 16 }}>{n}</Text>
                </View>
                <Text style={{ color: '#64748B', fontSize: 10, fontWeight: '800' }}>{i === 0 ? 'NEXT' : ''}</Text>
              </View>
            ))}
          </View>
        </VisualFrame>
      );
    case 'bee_tracing':
      return (
        <VisualFrame>
          <Svg width={220} height={120} viewBox="0 0 220 120">
            <Path d="M18 92 C 50 20, 90 20, 110 60 S 170 110, 202 36" stroke="#334155" strokeWidth={10} fill="none" strokeLinecap="round" />
            <Path d="M18 92 C 50 20, 90 20, 110 60 S 170 110, 202 36" stroke="#34D399" strokeWidth={3} fill="none" strokeDasharray="6 7" strokeLinecap="round" />
            <Circle cx="110" cy="60" r="14" fill="#FBBF24" />
            <Circle cx="106" cy="56" r="2.5" fill="#111827" />
            <Circle cx="114" cy="56" r="2.5" fill="#111827" />
          </Svg>
        </VisualFrame>
      );
    case 'pursuit':
      return (
        <VisualFrame>
          <View style={{ width: '86%', height: 90 }}>
            <View style={{ position: 'absolute', left: '8%', top: 28, width: 28, height: 28, borderRadius: 14, backgroundColor: '#1F2937', opacity: 0.85 }} />
            <View style={{ position: 'absolute', left: '42%', top: 52, width: 22, height: 22, borderRadius: 11, backgroundColor: '#374151' }} />
            <View style={{ position: 'absolute', left: '68%', top: 18, width: 38, height: 38, borderRadius: 19, backgroundColor: '#22D3EE', borderWidth: 3, borderColor: '#ECFEFF' }} />
            <View style={{ position: 'absolute', left: '58%', top: 8, width: 48, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#67E8F9', transform: [{ rotate: '18deg' }] }} />
          </View>
        </VisualFrame>
      );
    case 'mobile_target':
      return (
        <VisualFrame>
          <View style={{ width: '88%', height: 100 }}>
            <View style={{ position: 'absolute', left: '12%', top: 38, width: 44, height: 44, borderRadius: 22, backgroundColor: '#1F2937', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#9CA3AF', fontWeight: '900' }}>B</Text>
            </View>
            <View style={{ position: 'absolute', right: '16%', top: 18, width: 52, height: 52, borderRadius: 26, backgroundColor: '#34D399', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#052e1c', fontWeight: '900', fontSize: 18 }}>A</Text>
            </View>
          </View>
        </VisualFrame>
      );
    case 'geoboard':
      return (
        <VisualFrame>
          <Svg width={150} height={130} viewBox="0 0 150 130">
            {[0, 1, 2, 3].flatMap((row) =>
              [0, 1, 2, 3].map((col) => (
                <Circle key={`${row}-${col}`} cx={24 + col * 34} cy={22 + row * 30} r="4" fill="#64748B" />
              )),
            )}
            <Path d="M24 22 L92 22 L92 82 L24 82 Z" stroke="#34D399" strokeWidth="3" fill="none" />
          </Svg>
        </VisualFrame>
      );
    case 'peripheral_view':
      return (
        <VisualFrame>
          <View style={{ width: '90%', height: 110, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontWeight: '900', color: '#111' }}>A</Text>
            </View>
            <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#60A5FA' }} />
            <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#38BDF8', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#082f49', fontWeight: '900' }}>B</Text>
            </View>
          </View>
        </VisualFrame>
      );
    case 'number_search':
      return (
        <VisualFrame>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 168, gap: 6, justifyContent: 'center' }}>
            {['K', '3', 'M', 'R', 'P', '7', 'W', 'Q', '2'].map((ch) => {
              const digit = /\d/.test(ch);
              return (
                <View
                  key={ch}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: digit ? '#34D399' : '#1F2937',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: digit ? '#052e1c' : '#94A3B8', fontWeight: '800' }}>{ch}</Text>
                </View>
              );
            })}
          </View>
        </VisualFrame>
      );
    case 'pattern_match':
      return (
        <VisualFrame>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <View style={{ backgroundColor: '#111827', borderWidth: 2, borderColor: '#34D399', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 }}>
              <Text style={{ color: '#34D399', fontWeight: '900', letterSpacing: 4, fontSize: 16 }}>A7F</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['A7F', 'A9F', 'A7E'].map((code, i) => (
                <View
                  key={code}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: i === 0 ? '#065F46' : '#1F2937',
                    borderWidth: 1,
                    borderColor: i === 0 ? '#34D399' : '#374151',
                  }}
                >
                  <Text style={{ color: i === 0 ? '#6EE7B7' : '#9CA3AF', fontWeight: '800', fontSize: 12 }}>{code}</Text>
                </View>
              ))}
            </View>
          </View>
        </VisualFrame>
      );
    case 'location_memory':
      return (
        <VisualFrame>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: 132, gap: 8 }}>
            {['1', '', '3', '', '2', ''].map((n, i) => (
              <View
                key={i}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 8,
                  backgroundColor: n ? '#1D4ED8' : '#1F2937',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900' }}>{n}</Text>
              </View>
            ))}
          </View>
        </VisualFrame>
      );
    case 'direction_sense':
      return (
        <VisualFrame>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#E5E7EB', fontWeight: '900', fontSize: 32 }}>F</Text>
              <Text style={{ color: '#34D399', fontWeight: '800', fontSize: 18 }}>↻</Text>
            </View>
            <Text style={{ color: '#64748B', fontWeight: '900', fontSize: 22 }}>→</Text>
            <Text style={{ color: '#34D399', fontWeight: '900', fontSize: 32, transform: [{ rotate: '90deg' }] }}>F</Text>
          </View>
        </VisualFrame>
      );
    case 'computer_vision':
      return (
        <VisualFrame>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#94A3B8' }} />
        </VisualFrame>
      );
    case 'familiar_faces':
      return (
        <VisualFrame>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 64, height: 64, borderRadius: 16, backgroundColor: '#FB7185', borderWidth: 2, borderColor: '#FECDD3' }} />
            <Text style={{ color: '#64748B', fontWeight: '900', fontSize: 22 }}>→</Text>
            <View style={{ gap: 6 }}>
              <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#34D399' }}>
                <Text style={{ color: '#052e1c', fontWeight: '900', fontSize: 10 }}>Mother</Text>
              </View>
              <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#1F2937' }}>
                <Text style={{ color: '#E5E7EB', fontWeight: '900', fontSize: 10 }}>Father</Text>
              </View>
            </View>
          </View>
        </VisualFrame>
      );
    default:
      return null;
  }
}

export function HowToPlayManual({
  moduleId,
  isOpen,
  mode = 'entry',
  onContinue,
  onClose,
}: {
  moduleId: TherapyModuleId;
  isOpen: boolean;
  mode?: HowToPlayMode;
  onContinue: () => void;
  onClose?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s, isTablet } = useLayout();
  if (!isOpen) return null;
  const guide = getHowToPlay(moduleId);
  const isReview = mode === 'review';

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 120,
        backgroundColor: 'rgba(6,7,13,0.98)',
        paddingTop: insets.top + s(8),
        paddingBottom: insets.bottom + s(16),
        paddingHorizontal: s(20),
      }}
    >
      {isReview ? (
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close how to play"
          style={{
            position: 'absolute',
            top: insets.top + s(10),
            right: s(16),
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: '#1F2937',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 121,
          }}
        >
          <Text style={{ color: '#E5E7EB', fontSize: fs(16), fontWeight: '700' }}>✕</Text>
        </Pressable>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingTop: s(48),
          paddingBottom: s(12),
          maxWidth: isTablet ? 520 : 480,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Text style={{ color: '#94A3B8', fontWeight: '800', fontSize: fs(12), letterSpacing: 1.2, marginBottom: s(6) }}>
          HOW TO PLAY
        </Text>
        <Text style={{ color: '#fff', fontSize: fs(26), fontWeight: '900', marginBottom: s(6) }}>{guide.title}</Text>
        <Text style={{ color: '#9CA3AF', fontSize: fs(14), fontWeight: '600', lineHeight: fs(20), marginBottom: s(16) }}>
          {guide.subtitle}
        </Text>
        <HowToPlayVisual moduleId={moduleId} />
        <View style={{ marginTop: s(18), gap: s(12) }}>
          {guide.steps.map((step, i) => {
            const isClap = i === guide.steps.length - 1;
            return (
            <View key={step.title} style={{ flexDirection: 'row', gap: s(12) }}>
              <View
                style={{
                  width: s(28),
                  height: s(28),
                  borderRadius: s(14),
                  backgroundColor: isClap ? '#F59E0B' : '#065F46',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: isClap ? '#111827' : '#6EE7B7', fontWeight: '900', fontSize: fs(13) }}>
                  {i + 1}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F8FAFC', fontWeight: '800', fontSize: fs(15) }}>{step.title}</Text>
                <Text style={{ color: '#94A3B8', fontSize: fs(13), lineHeight: fs(19), marginTop: 2 }}>{step.body}</Text>
              </View>
            </View>
            );
          })}
        </View>
      </ScrollView>

      {isReview ? null : (
        <Pressable
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel="Continue to settings"
          style={{
            backgroundColor: '#34D399',
            borderRadius: 999,
            paddingVertical: s(16),
            alignItems: 'center',
            maxWidth: isTablet ? 520 : 480,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text style={{ color: '#052e1c', fontWeight: '900', fontSize: fs(17) }}>Continue to settings</Text>
        </Pressable>
      )}
    </View>
  );
}
