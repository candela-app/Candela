import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import type { BeeSessionResultData } from '@candela/shared/rn';
import { shareSessionCsv } from '../lib/csv';
import { useLayout } from '../lib/layout';

export function BeeResultsModal({
  isOpen,
  onClose,
  onReplay,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
  data: BeeSessionResultData;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();
  const [toast, setToast] = useState<string | null>(null);
  const [activeRoundTab, setActiveRoundTab] = useState(0);
  const currentRound = data.roundResults[activeRoundTab] || data.roundResults[0];

  const viewBox = useMemo(() => {
    const pts = [...(currentRound?.targetPoints || []), ...(currentRound?.tracedPoints || [])];
    if (!pts.length) return { w: 600, h: 300 };
    const maxX = Math.max(...pts.map((p) => p.x), 1);
    const maxY = Math.max(...pts.map((p) => p.y), 1);
    return { w: maxX, h: maxY };
  }, [currentRound]);

  const exportCsv = async () => {
    try {
      await shareSessionCsv(data);
      setToast('CSV ready to share');
    } catch {
      setToast('Export failed');
    }
    setTimeout(() => setToast(null), 2500);
  };

  const metrics = [
    { label: 'Duration', value: `${data.durationSec}s`, color: '#34D399' },
    { label: 'Accuracy', value: `${data.accuracy}%`, color: '#60A5FA' },
    { label: 'Off-Path Deviations', value: String(data.deviationCount ?? 0), color: '#FB7185' },
    { label: 'Avg Recovery', value: `${data.avgRecoveryTimeSec ?? 0}s`, color: '#22D3EE' },
    { label: 'Visual Focus Score', value: '96 / 100', color: '#22D3EE' },
    { label: 'Processing Speed', value: 'Optimal', color: '#4ADE80' },
  ];

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.75)',
          paddingTop: insets.top + s(12),
          paddingBottom: insets.bottom + s(12),
          paddingHorizontal: s(16),
          justifyContent: 'center',
        }}
      >
        {toast ? (
          <View
            style={{
              position: 'absolute',
              top: insets.top + s(12),
              right: s(16),
              zIndex: 20,
              backgroundColor: 'rgba(5,150,105,0.92)',
              paddingHorizontal: s(14),
              paddingVertical: s(8),
              borderRadius: s(14),
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(12) }}>✓ {toast}</Text>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: '#121212',
            borderRadius: s(24),
            borderWidth: 1,
            borderColor: 'rgba(245,158,11,0.28)',
            maxHeight: '100%',
            overflow: 'hidden',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: s(20) }}>
            <Text style={{ color: '#fff', fontSize: fs(24), fontWeight: '900', textAlign: 'center' }}>Session Completed</Text>
            <Text style={{ color: '#9CA3AF', fontSize: fs(13), textAlign: 'center', marginTop: s(6) }}>
              {data.gameName} • Patient:{' '}
              <Text style={{ color: '#34D399', fontWeight: '700' }}>{data.patientName || 'Demo Patient'}</Text>
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: fs(11), textAlign: 'center', marginTop: s(4) }}>Date: {data.date}</Text>

            {currentRound ? (
              <View
                style={{
                  marginTop: s(16),
                  backgroundColor: 'rgba(2,6,23,0.8)',
                  borderRadius: s(16),
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)',
                  padding: s(12),
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(8) }}>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>Target Path (Amber Dotted)</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>Traced Path (Cyan)</Text>
                </View>
                {data.roundResults.length > 1 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: s(6), marginBottom: s(8) }}>
                    {data.roundResults.map((rnd, idx) => (
                      <Pressable
                        key={idx}
                        onPress={() => setActiveRoundTab(idx)}
                        style={{
                          paddingHorizontal: s(10),
                          paddingVertical: s(6),
                          borderRadius: s(10),
                          backgroundColor: activeRoundTab === idx ? '#F59E0B' : 'rgba(255,255,255,0.1)',
                        }}
                      >
                        <Text
                          style={{
                            color: activeRoundTab === idx ? '#0F172A' : '#D1D5DB',
                            fontSize: fs(11),
                            fontWeight: '800',
                          }}
                        >
                          R{rnd.roundNumber} ({rnd.pathType})
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <View style={{ height: s(140), backgroundColor: '#0B0D14', borderRadius: s(12), overflow: 'hidden' }}>
                  <Svg width="100%" height="100%" viewBox={`0 0 ${viewBox.w} ${viewBox.h}`} preserveAspectRatio="xMidYMid meet">
                    {currentRound.idealSvgPathD ? (
                      <Path
                        d={currentRound.idealSvgPathD}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth={8}
                        strokeDasharray="6 6"
                        strokeOpacity={0.8}
                      />
                    ) : null}
                    {currentRound.tracedPoints && currentRound.tracedPoints.length > 1 ? (
                      <Polyline
                        points={currentRound.tracedPoints.map((p) => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#06B6D4"
                        strokeWidth={5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ) : null}
                    {currentRound.targetPoints[0] ? (
                      <Circle cx={currentRound.targetPoints[0].x} cy={currentRound.targetPoints[0].y} r={10} fill="#EAB308" />
                    ) : null}
                    {currentRound.targetPoints[currentRound.targetPoints.length - 1] ? (
                      <Circle
                        cx={currentRound.targetPoints[currentRound.targetPoints.length - 1].x}
                        cy={currentRound.targetPoints[currentRound.targetPoints.length - 1].y}
                        r={12}
                        fill="#EC4899"
                      />
                    ) : null}
                  </Svg>
                </View>
              </View>
            ) : null}

            {data.horizontalAccuracyPercent !== undefined || data.verticalAccuracyPercent !== undefined ? (
              <View
                style={{
                  marginTop: s(12),
                  backgroundColor: 'rgba(69,26,3,0.25)',
                  borderRadius: s(16),
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.25)',
                  padding: s(12),
                }}
              >
                <Text
                  style={{
                    color: '#FBBF24',
                    fontSize: fs(11),
                    fontWeight: '800',
                    textAlign: 'center',
                    letterSpacing: 1,
                    marginBottom: s(8),
                  }}
                >
                  CLINICAL AXIS PURSUIT METRICS
                </Text>
                <View style={{ flexDirection: 'row', gap: s(8) }}>
                  <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: s(12), padding: s(10), alignItems: 'center' }}>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700' }}>Horizontal (↔) Acc</Text>
                    <Text style={{ color: '#FBBF24', fontSize: fs(20), fontWeight: '900' }}>
                      {data.horizontalAccuracyPercent !== undefined ? `${data.horizontalAccuracyPercent}%` : 'N/A'}
                    </Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.7)', borderRadius: s(12), padding: s(10), alignItems: 'center' }}>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700' }}>Vertical (↕) Acc</Text>
                    <Text style={{ color: '#34D399', fontSize: fs(20), fontWeight: '900' }}>
                      {data.verticalAccuracyPercent !== undefined ? `${data.verticalAccuracyPercent}%` : 'N/A'}
                    </Text>
                  </View>
                </View>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginTop: s(14) }}>
              {metrics.map((item) => (
                <View
                  key={item.label}
                  style={{
                    width: '47%',
                    flexGrow: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: s(16),
                    padding: s(12),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700', letterSpacing: 0.6 }}>{item.label.toUpperCase()}</Text>
                  <Text style={{ color: item.color, fontSize: fs(20), fontWeight: '900', marginTop: s(4) }}>{item.value}</Text>
                </View>
              ))}
            </View>

            <View style={{ gap: s(8), marginTop: s(16) }}>
              <Pressable
                onPress={onReplay}
                style={{ backgroundColor: '#10B981', borderRadius: s(14), paddingVertical: s(14), alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(15) }}>Play Again</Text>
              </Pressable>
              <Pressable
                onPress={() => void exportCsv()}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderRadius: s(14),
                  paddingVertical: s(14),
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.15)',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(14) }}>Export CSV</Text>
              </Pressable>
              <Pressable
                onPress={onClose}
                style={{
                  backgroundColor: 'rgba(239,68,68,0.1)',
                  borderRadius: s(14),
                  paddingVertical: s(14),
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(239,68,68,0.3)',
                }}
              >
                <Text style={{ color: '#F87171', fontWeight: '700', fontSize: fs(14) }}>Exit to Menu</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
