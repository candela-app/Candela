import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parentSummaryCells, sessionErrorCounts, type PursuitSessionResultData } from '@candela/shared/rn';
import { shareSessionCsv } from '../lib/csv';
import { useLayout } from '../lib/layout';
import { useSavedSessionNumber } from '../lib/use-saved-session-number';

export function PursuitResultsModal({
  isOpen,
  onClose,
  onReplay,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
  data: PursuitSessionResultData;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();
  const [viewTab, setViewTab] = useState<'summary' | 'advanced'>('summary');
  const [toast, setToast] = useState<string | null>(null);
  const { sessionNumber, status: sessionSaveStatus } = useSavedSessionNumber(isOpen, data);

  const formattedDate =
    data.date ||
    new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const exportCsv = async () => {
    try {
      await shareSessionCsv(data);
      setToast('CSV ready to share');
    } catch {
      setToast('Export failed');
    }
    setTimeout(() => setToast(null), 2500);
  };

  const parentCells = parentSummaryCells(data);
  const errors = sessionErrorCounts(data);

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.85)',
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
              backgroundColor: '#06B6D4',
              paddingHorizontal: s(14),
              paddingVertical: s(8),
              borderRadius: s(14),
            }}
          >
            <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: fs(12) }}>{toast}</Text>
          </View>
        ) : null}

        <View
          style={{
            backgroundColor: '#090A0F',
            borderRadius: s(24),
            borderWidth: 1,
            borderColor: 'rgba(6,182,212,0.3)',
            maxHeight: '92%',
            overflow: 'hidden',
          }}
        >
          <ScrollView contentContainerStyle={{ padding: s(20) }} showsVerticalScrollIndicator={false}>
            <Text style={{ color: '#22D3EE', fontSize: fs(11), fontWeight: '800', letterSpacing: 1.4 }}>
              VISION PURSUIT THERAPY
            </Text>
            <Text style={{ color: '#fff', fontSize: fs(24), fontWeight: '900', marginTop: s(4) }}>Session Completed</Text>
            <Text style={{ color: '#9CA3AF', fontSize: fs(12), marginTop: s(4) }}>
              Patient: <Text style={{ color: '#fff', fontWeight: '700' }}>{data.patientName || 'Demo Patient'}</Text>
              {'  ·  '}
              Session #: {sessionNumber != null ? sessionNumber : sessionSaveStatus === 'saving' ? 'saving…' : '—'}
              {'  ·  '}
              {formattedDate}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                backgroundColor: '#12141F',
                borderRadius: s(12),
                borderWidth: 1,
                borderColor: '#1F2937',
                padding: s(4),
                marginTop: s(16),
                marginBottom: s(16),
              }}
            >
              {(
                [
                  { id: 'summary' as const, label: 'Summary' },
                  { id: 'advanced' as const, label: 'Advanced' },
                ]
              ).map((tab) => (
                <Pressable
                  key={tab.id}
                  onPress={() => setViewTab(tab.id)}
                  style={{
                    flex: 1,
                    paddingVertical: s(10),
                    borderRadius: s(10),
                    backgroundColor: viewTab === tab.id ? '#06B6D4' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: viewTab === tab.id ? '#0F172A' : '#9CA3AF',
                      fontSize: fs(11),
                      fontWeight: '800',
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {viewTab === 'summary' ? (
              <View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8), marginBottom: s(12) }}>
                  {parentCells.map((item) => (
                    <View
                      key={item.label}
                      style={{
                        width: '48%',
                        flexGrow: 1,
                        backgroundColor: '#121522',
                        borderWidth: 1,
                        borderColor: '#1F2937',
                        borderRadius: s(12),
                        padding: s(12),
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', letterSpacing: 0.5 }}>
                        {item.label.toUpperCase()}
                      </Text>
                      <Text style={{ color: item.color, fontSize: fs(18), fontWeight: '900', marginTop: s(4) }}>
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: s(8) }}>
                  <View style={{ borderRadius: 99, borderWidth: 1, borderColor: 'rgba(251,113,133,0.3)', backgroundColor: 'rgba(244,63,94,0.12)', paddingHorizontal: s(12), paddingVertical: s(6) }}>
                    <Text style={{ color: '#FDA4AF', fontSize: fs(11), fontWeight: '800' }}>Wrong taps {errors.wrongTaps}</Text>
                  </View>
                  <View style={{ borderRadius: 99, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', backgroundColor: 'rgba(245,158,11,0.12)', paddingHorizontal: s(12), paddingVertical: s(6) }}>
                    <Text style={{ color: '#FCD34D', fontSize: fs(11), fontWeight: '800' }}>Misses {errors.misses}</Text>
                  </View>
                  {errors.timeouts > 0 ? (
                    <View style={{ borderRadius: 99, borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)', backgroundColor: 'rgba(14,165,233,0.12)', paddingHorizontal: s(12), paddingVertical: s(6) }}>
                      <Text style={{ color: '#7DD3FC', fontSize: fs(11), fontWeight: '800' }}>Timeouts {errors.timeouts}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={{ gap: s(14) }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                  {[
                    { label: 'Accuracy', value: `${data.accuracy}%`, color: '#22D3EE' },
                    { label: 'Avg Reaction', value: `${Math.round(data.avgReactionSec * 1000)}ms`, color: '#FBBF24' },
                    { label: 'Avg Error', value: `${data.avgTrackingErrorPx || 0}px`, color: '#FB7185' },
                    { label: 'Pattern', value: data.movementPattern.replace(/_/g, ' '), color: '#60A5FA' },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={{
                        width: '48%',
                        flexGrow: 1,
                        backgroundColor: '#121522',
                        borderWidth: 1,
                        borderColor: '#1F2937',
                        borderRadius: s(12),
                        padding: s(12),
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '800', letterSpacing: 0.5 }}>
                        {item.label.toUpperCase()}
                      </Text>
                      <Text
                        style={{
                          color: item.color,
                          fontSize: item.label === 'Pattern' ? fs(12) : fs(18),
                          fontWeight: '900',
                          marginTop: s(4),
                          textAlign: 'center',
                          textTransform: item.label === 'Pattern' ? 'capitalize' : 'none',
                        }}
                      >
                        {item.value}
                      </Text>
                    </View>
                  ))}
                </View>

                <View
                  style={{
                    backgroundColor: '#121522',
                    borderWidth: 1,
                    borderColor: 'rgba(6,182,212,0.2)',
                    borderRadius: s(16),
                    padding: s(14),
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: s(6) }}>
                    <Text style={{ color: '#22D3EE', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6 }}>
                      PURSUIT VECTOR ALIGNMENT
                    </Text>
                  </View>
                  <Text style={{ color: '#fff', fontSize: fs(13), fontWeight: '700', marginBottom: s(4) }}>
                    {data.anticipationVsLagScore}
                  </Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>
                    Measures whether taps lead (anticipation) or trail (lag) the target velocity vector.
                  </Text>
                </View>

                <View>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.6, marginBottom: s(8) }}>
                    BLOCK TREND (4 BLOCKS OF 5 TRIALS)
                  </Text>
                  <View style={{ flexDirection: 'row', gap: s(8) }}>
                    {(data.blockMetrics || []).map((blk) => (
                      <View
                        key={blk.blockIndex}
                        style={{
                          flex: 1,
                          backgroundColor: '#121522',
                          borderWidth: 1,
                          borderColor: '#1F2937',
                          borderRadius: s(12),
                          padding: s(10),
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#9CA3AF', fontSize: fs(9), fontWeight: '800' }}>
                          BLOCK {blk.blockIndex + 1}
                        </Text>
                        <Text style={{ color: '#22D3EE', fontSize: fs(16), fontWeight: '900', marginTop: s(4) }}>
                          {blk.accuracyPercent}%
                        </Text>
                        <Text style={{ color: '#9CA3AF', fontSize: fs(9), marginTop: s(2) }}>
                          Err {blk.avgTrackingErrorPx}px
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View
                  style={{
                    backgroundColor: '#121522',
                    borderWidth: 1,
                    borderColor: '#1F2937',
                    borderRadius: s(12),
                    padding: s(12),
                    gap: s(6),
                  }}
                >
                  <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                    Decoy Density: <Text style={{ color: '#fff', fontWeight: '800' }}>{data.decoyCount} Decoys</Text>
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                    Pursuit Speed: <Text style={{ color: '#fff', fontWeight: '800' }}>{data.speedPxPerSec} px/s</Text>
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                    Duration: <Text style={{ color: '#fff', fontWeight: '800' }}>{data.durationSec}s</Text>
                  </Text>
                  <Text style={{ color: '#D1D5DB', fontSize: fs(12) }}>
                    Total Trials: <Text style={{ color: '#fff', fontWeight: '800' }}>{data.stimuliCount}</Text>
                  </Text>
                </View>
              </View>
            )}

            <Pressable
              onPress={onReplay}
              style={{
                backgroundColor: '#06B6D4',
                borderRadius: s(12),
                paddingVertical: s(14),
                alignItems: 'center',
                marginTop: s(20),
              }}
            >
              <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: fs(15) }}>Play Again</Text>
            </Pressable>
            <Pressable
              onPress={() => void exportCsv()}
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.15)',
                borderRadius: s(12),
                paddingVertical: s(14),
                alignItems: 'center',
                marginTop: s(10),
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: fs(14) }}>Export CSV</Text>
            </Pressable>
            <Pressable
              onPress={onClose}
              style={{
                backgroundColor: 'rgba(239,68,68,0.1)',
                borderWidth: 1,
                borderColor: 'rgba(239,68,68,0.3)',
                borderRadius: s(12),
                paddingVertical: s(14),
                alignItems: 'center',
                marginTop: s(10),
              }}
            >
              <Text style={{ color: '#F87171', fontWeight: '700', fontSize: fs(14) }}>Exit Menu</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
