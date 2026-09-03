import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  APPLAUSE_EARLY_MS,
  clapLineSpeakMs,
  type GeoboardSessionResultData,
  type NumberSearchSessionResultData,
  type SessionResultData,
  formatReactionMsFromSec,
  isRotatorySessionResult,
  parentSummaryCells,
  sessionErrorCounts,
} from '@candela/shared/rn';
import { shareSessionCsv } from '../lib/csv';
import { useLayout } from '../lib/layout';
import { playClapBed, playPartyBlast, preloadClapBed, stopClapBed } from '../lib/sfx';
import { speakClapFor, stopSpeaking } from '../lib/speech';
import { ResultsConfetti } from './ResultsConfetti';
import { useSavedSessionNumber } from '../lib/use-saved-session-number';

export function GameResultsModal({
  isOpen,
  onClose,
  onReplay,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  onReplay: () => void;
  data: SessionResultData;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();
  const [toast, setToast] = useState<string | null>(null);
  const [resultsTab, setResultsTab] = useState<'summary' | 'advanced'>('summary');
  const { sessionNumber, status: sessionSaveStatus } = useSavedSessionNumber(isOpen, data);

  useEffect(() => {
    if (isOpen) setResultsTab('summary');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let clapped = false;
    let stopped = false;
    let clapTimer: ReturnType<typeof setTimeout> | null = null;
    const clapOnce = () => {
      if (stopped || clapped) return;
      clapped = true;
      void playClapBed();
    };
    void preloadClapBed();
    void playPartyBlast();
    const speakMs = clapLineSpeakMs(data.patientName);
    const speakTimer = setTimeout(() => {
      if (stopped) return;
      speakClapFor(data.patientName, clapOnce);
      clapTimer = setTimeout(clapOnce, Math.max(0, speakMs - APPLAUSE_EARLY_MS));
    }, 420);
    const fallbackTimer = setTimeout(clapOnce, 420 + speakMs + 1400);
    return () => {
      stopped = true;
      clearTimeout(speakTimer);
      clearTimeout(fallbackTimer);
      if (clapTimer) clearTimeout(clapTimer);
      stopSpeaking();
      stopClapBed();
    };
  }, [isOpen, data.patientName]);

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

  const isGeoboard = 'boardId' in data && 'leftHalfAccuracy' in data;
  const geo = isGeoboard ? (data as GeoboardSessionResultData) : null;
  const isNumberSearch = 'digitsFound' in data && 'endedBy' in data;
  const numberSearch = isNumberSearch ? (data as NumberSearchSessionResultData) : null;
  const isRotatory = isRotatorySessionResult(data);
  const rotatory = isRotatory ? data : null;
  const parentCells = parentSummaryCells(data);
  const errors = sessionErrorCounts(data);

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
              zIndex: 60,
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
            borderColor: 'rgba(16,185,129,0.3)',
            padding: s(20),
            maxHeight: '92%',
            zIndex: 1,
          }}
        >
          <Pressable onPress={() => void exportCsv()} style={{ position: 'absolute', top: s(16), right: s(16), zIndex: 10, padding: s(6) }}>
            <Text style={{ color: '#9CA3AF', fontSize: fs(18) }}>⇩</Text>
          </Pressable>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', marginBottom: s(18), paddingHorizontal: s(12) }}>
              <Text style={{ color: '#fff', fontSize: fs(24), fontWeight: '800', textAlign: 'center' }}>
                Session Completed
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: fs(13), marginTop: s(6), textAlign: 'center' }}>
                {data.gameName} • Patient:{' '}
                <Text style={{ color: '#34D399', fontWeight: '700' }}>{data.patientName || 'Demo Patient'}</Text>
              </Text>
              <Text style={{ color: '#9CA3AF', fontSize: fs(12), marginTop: s(4) }}>
                Session #: {sessionNumber != null ? sessionNumber : sessionSaveStatus === 'saving' ? 'saving…' : '—'}
                {'  ·  '}
                Date: <Text style={{ color: '#D1D5DB' }}>{formattedDate}</Text>
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                backgroundColor: 'rgba(255,255,255,0.05)',
                borderRadius: s(12),
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.1)',
                padding: s(4),
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
                  onPress={() => setResultsTab(tab.id)}
                  style={{
                    flex: 1,
                    paddingVertical: s(10),
                    borderRadius: s(10),
                    backgroundColor: resultsTab === tab.id ? '#10B981' : 'transparent',
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: resultsTab === tab.id ? '#0F172A' : '#9CA3AF',
                      fontSize: fs(12),
                      fontWeight: '800',
                    }}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {resultsTab === 'advanced' ? (
              <>
            {rotatory ? (
              <View
                style={{
                  borderRadius: s(16),
                  borderWidth: 1,
                  borderColor: 'rgba(56,189,248,0.25)',
                  backgroundColor: 'rgba(8,47,73,0.35)',
                  padding: s(14),
                  marginBottom: s(16),
                  gap: s(12),
                }}
              >
                <Text style={{ color: '#38BDF8', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8 }}>
                  ROTATORY WHEEL VISUAL SEARCH PERFORMANCE
                </Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>
                  Performance can be affected by movement, attention, device, and target crowding.
                </Text>
                <Text style={{ color: '#FCD34D', fontSize: fs(22), fontWeight: '900' }}>
                  {Math.round(rotatory.medianReactionSec * 1000)}ms
                </Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>
                  Median correct-target response · IQR {Math.round((rotatory.iqrReactionSec ?? 0) * 1000)}ms
                </Text>
                <Text style={{ color: '#6EE7B7', fontSize: fs(13), fontWeight: '700' }}>
                  Clean taps {Math.round((rotatory.cleanTapRate ?? 0) * 100)}%
                </Text>
                <Text style={{ color: '#FDA4AF', fontSize: fs(13), fontWeight: '700' }}>
                  Wrong bubble {Math.round((rotatory.discriminationErrorRate ?? 0) * 100)}% · empty-wheel miss{' '}
                  {Math.round((rotatory.motorMissRate ?? 0) * 100)}%
                </Text>
                {rotatory.lateralityEligible ? (
                  <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>
                    Onset left n={rotatory.leftOnsetN} {Math.round(rotatory.leftFieldMedianRtSec * 1000)}ms · right n=
                    {rotatory.rightOnsetN} {Math.round(rotatory.rightFieldMedianRtSec * 1000)}ms
                  </Text>
                ) : (
                  <Text style={{ color: '#6B7280', fontSize: fs(11) }}>
                    Left/right onset hidden ({rotatory.lateralitySuppressedReason?.replace(/_/g, ' ') || 'insufficient trials'}).
                  </Text>
                )}
                <Text style={{ color: '#7DD3FC', fontSize: fs(10), fontWeight: '800' }}>CLINICIAN DETAILS</Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>
                  Valid {rotatory.validTrials ?? rotatory.trialsCompleted}/{rotatory.trialsConfigured} · excluded{' '}
                  {rotatory.excludedTrials ?? 0} · warm-up {rotatory.warmupTrials ?? 0} · crossings{' '}
                  {Math.round((rotatory.fieldCrossingRate ?? 0) * 100)}% · {rotatory.deviceTier} · {rotatory.bubbleCount}{' '}
                  bubbles · {rotatory.cueMode} · hand {rotatory.handUsed}
                </Text>
                {rotatory.qualityFlags ? (
                  <Text style={{ color: '#FCD34D', fontSize: fs(10) }}>Flags: {rotatory.qualityFlags.replace(/\|/g, ' · ')}</Text>
                ) : null}
                {rotatory.mode !== 'colors' && rotatory.formClasses
                  ? (
                      [
                        ['simple_stroke', 'Simple'],
                        ['closed_round', 'Closed'],
                        ['open_round', 'Open'],
                        ['dense_stroke', 'Dense'],
                      ] as const
                    ).map(([id, label]) => {
                      const row = rotatory.formClasses[id];
                      return (
                        <Text key={id} style={{ color: '#D1D5DB', fontSize: fs(11) }}>
                          {label}: {row?.sufficient ? `${Math.round(row.medianRtSec * 1000)}ms` : 'insufficient trials'} (n=
                          {row?.n ?? 0})
                        </Text>
                      );
                    })
                  : null}
                <Text style={{ color: '#6B7280', fontSize: fs(10) }}>
                  Not an acuity, saccade, neglect, or alphabet score. Do not compare devices without device-specific norms.
                </Text>
              </View>
            ) : null}

            {geo ? (
              <View
                style={{
                  borderRadius: s(16),
                  borderWidth: 1,
                  borderColor: 'rgba(20,184,166,0.25)',
                  backgroundColor: 'rgba(4,47,46,0.35)',
                  padding: s(14),
                  marginBottom: s(16),
                  gap: s(12),
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, paddingRight: s(8) }}>
                    <Text style={{ color: '#2DD4BF', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8 }}>
                      {geo.boardName.toUpperCase()}
                    </Text>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), marginTop: 2 }}>
                      {geo.correct} of {data.stimuliCount} patterns reproduced
                      {geo.alphabetVariant ? ` · ${geo.alphabetVariant}` : ''}
                    </Text>
                  </View>
                  <Text style={{ color: '#FBBF24', fontSize: fs(16) }}>
                    {'★'.repeat(geo.starRating ?? 0)}
                    <Text style={{ color: 'rgba(255,255,255,0.15)' }}>{'★'.repeat(5 - (geo.starRating ?? 0))}</Text>
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700' }}>Left Field {geo.leftHalfAccuracy}%</Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700' }}>Right Field {geo.rightHalfAccuracy}%</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: s(8) }}>
                  {[
                    { label: 'Wrong Dot', value: geo.errorBreakdown?.wrongDot ?? 0, color: '#FB7185' },
                    { label: 'Wrong Shape', value: geo.errorBreakdown?.wrongShape ?? 0, color: '#FBBF24' },
                    { label: 'Incomplete', value: geo.errorBreakdown?.incomplete ?? 0, color: '#38BDF8' },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: s(12), padding: s(8), alignItems: 'center' }}
                    >
                      <Text style={{ color: '#9CA3AF', fontSize: fs(9), fontWeight: '700' }}>{item.label.toUpperCase()}</Text>
                      <Text style={{ color: item.color, fontSize: fs(18), fontWeight: '900' }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                {geo.penColor ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                    <Text style={{ color: '#9CA3AF', fontSize: fs(11), fontWeight: '700' }}>PEN</Text>
                    <View style={{ width: s(14), height: s(14), borderRadius: 99, backgroundColor: geo.penColor, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
                    <Text style={{ color: '#D1D5DB', fontSize: fs(11), fontWeight: '700' }}>{geo.penColorName}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {numberSearch ? (
              <View
                style={{
                  borderRadius: s(16),
                  borderWidth: 1,
                  borderColor: 'rgba(245,158,11,0.3)',
                  backgroundColor: 'rgba(69,26,3,0.35)',
                  padding: s(14),
                  marginBottom: s(16),
                  gap: s(10),
                }}
              >
                <Text style={{ color: '#FBBF24', fontSize: fs(11), fontWeight: '800', letterSpacing: 0.8 }}>
                  CROWDED SEARCH
                </Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(12) }}>
                  {numberSearch.digitsFound} of {numberSearch.targetDigitsConfigured} digits found
                  {numberSearch.endedBy === 'timeout' ? ' · timed out' : ' · cleared'}
                  {numberSearch.timeLimitSec > 0 ? ` · limit ${numberSearch.timeLimitSec}s` : ' · untimed'}
                </Text>
                <View style={{ flexDirection: 'row', gap: s(8) }}>
                  {[
                    { label: 'Found', value: numberSearch.digitsFound, color: '#34D399' },
                    { label: 'Left', value: numberSearch.digitsRemaining, color: '#FBBF24' },
                    { label: 'Wrong', value: numberSearch.wrong, color: '#FB7185' },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: s(12), padding: s(8), alignItems: 'center' }}
                    >
                      <Text style={{ color: '#9CA3AF', fontSize: fs(9), fontWeight: '700' }}>{item.label.toUpperCase()}</Text>
                      <Text style={{ color: item.color, fontSize: fs(18), fontWeight: '900' }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
              </>
            ) : null}

            {resultsTab === 'summary' ? (
              <>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10), marginBottom: s(12) }}>
                  {parentCells.map((item) => (
                    <View
                      key={item.label}
                      style={{
                        width: '48%',
                        flexGrow: 1,
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderRadius: s(16),
                        padding: s(14),
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700', letterSpacing: 0.8, marginBottom: s(4) }}>
                        {item.label.toUpperCase()}
                      </Text>
                      <Text style={{ color: item.color, fontSize: fs(22), fontWeight: '900' }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: s(8), marginBottom: s(18) }}>
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
              </>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10), marginBottom: s(18) }}>
                {typeof data.medianReactionSec === 'number' ? (
                  <View
                    style={{
                      width: '48%',
                      flexGrow: 1,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: s(16),
                      padding: s(14),
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700', letterSpacing: 0.8, marginBottom: s(4) }}>
                      MEDIAN REACTION
                    </Text>
                    <Text style={{ color: '#FBBF24', fontSize: fs(22), fontWeight: '900' }}>
                      {formatReactionMsFromSec(data.medianReactionSec)}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={{
                    width: '48%',
                    flexGrow: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: s(16),
                    padding: s(14),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700', letterSpacing: 0.8, marginBottom: s(4) }}>
                    WRONG-TAP RATE
                  </Text>
                  <Text style={{ color: '#FB7185', fontSize: fs(22), fontWeight: '900' }}>{data.wrongTapRate ?? 0}%</Text>
                </View>
                <View
                  style={{
                    width: '48%',
                    flexGrow: 1,
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderRadius: s(16),
                    padding: s(14),
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700', letterSpacing: 0.8, marginBottom: s(4) }}>
                    MISS RATE
                  </Text>
                  <Text style={{ color: '#FBBF24', fontSize: fs(22), fontWeight: '900' }}>{data.missRate ?? 0}%</Text>
                </View>
                {(data.timeouts ?? 0) > 0 ? (
                  <View
                    style={{
                      width: '48%',
                      flexGrow: 1,
                      backgroundColor: 'rgba(255,255,255,0.05)',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.1)',
                      borderRadius: s(16),
                      padding: s(14),
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700', letterSpacing: 0.8, marginBottom: s(4) }}>
                      TIMEOUT RATE
                    </Text>
                    <Text style={{ color: '#38BDF8', fontSize: fs(22), fontWeight: '900' }}>{data.timeoutRate ?? 0}%</Text>
                  </View>
                ) : null}
              </View>
            )}

            <Pressable
              onPress={onReplay}
              style={{
                backgroundColor: '#10B981',
                borderRadius: s(12),
                paddingVertical: s(14),
                alignItems: 'center',
                marginBottom: s(10),
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: fs(15) }}>Play Again</Text>
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
                marginBottom: s(10),
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
              }}
            >
              <Text style={{ color: '#F87171', fontWeight: '700', fontSize: fs(14) }}>Exit to Menu</Text>
            </Pressable>
          </ScrollView>
        </View>
        {isOpen ? <ResultsConfetti /> : null}
      </View>
    </Modal>
  );
}
