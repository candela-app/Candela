import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  APPLAUSE_EARLY_MS,
  clapLineSpeakMs,
  type GeoboardSessionResultData,
  type NumberSearchSessionResultData,
  type SessionResultData,
  isRotatorySessionResult,
} from '@candela/shared/rn';
import { shareSessionCsv } from '../lib/csv';
import { useLayout } from '../lib/layout';
import { playClapBed, playPartyBlast, preloadClapBed, stopClapBed } from '../lib/sfx';
import { speakClapFor, stopSpeaking } from '../lib/speech';
import { ResultsConfetti } from './ResultsConfetti';

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

  useEffect(() => {
    if (!isOpen) return;
    let clapped = false;
    let stopped = false;
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
    }, 420);
    const clapTimer = setTimeout(clapOnce, 420 + Math.max(0, speakMs - APPLAUSE_EARLY_MS));
    const fallbackTimer = setTimeout(clapOnce, 420 + speakMs + 1400);
    return () => {
      stopped = true;
      clearTimeout(speakTimer);
      clearTimeout(clapTimer);
      clearTimeout(fallbackTimer);
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

  const metrics: { label: string; value: string; color: string }[] = [
    { label: 'Duration', value: `${data.durationSec}s`, color: '#34D399' },
    { label: 'Accuracy', value: `${data.accuracy}%`, color: '#60A5FA' },
    {
      label: isRotatory ? 'Median Search' : 'Avg Reaction',
      value: `${Math.round((isRotatory ? rotatory!.medianReactionSec : data.avgReactionSec) * 1000)}ms`,
      color: '#FBBF24',
    },
    {
      label: isGeoboard ? 'Patterns Drawn' : isNumberSearch ? 'Digits Found' : isRotatory ? 'Targets' : 'Bubbles Popped',
      value: isNumberSearch ? String(numberSearch?.digitsFound ?? data.correct) : String(data.stimuliCount),
      color: '#C084FC',
    },
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
            borderColor: 'rgba(16,185,129,0.3)',
            padding: s(20),
            maxHeight: '92%',
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
                Date: <Text style={{ color: '#D1D5DB' }}>{formattedDate}</Text>
              </Text>
            </View>

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
                  VISUAL FIELD
                </Text>
                <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>
                  Search time and clean-tap rate by where the target appeared — not which letter it was.
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700' }}>
                    Left {rotatory.leftFieldAccuracy}% · {Math.round(rotatory.leftFieldMedianRtSec * 1000)}ms
                  </Text>
                  <Text style={{ color: '#9CA3AF', fontSize: fs(10), fontWeight: '700' }}>
                    Right {rotatory.rightFieldAccuracy}% · {Math.round(rotatory.rightFieldMedianRtSec * 1000)}ms
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: s(6) }}>
                  <View
                    style={{
                      flex: 1,
                      height: s(8),
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      overflow: 'hidden',
                      alignItems: 'flex-end',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${rotatory.leftFieldAccuracy}%`,
                        backgroundColor: '#38BDF8',
                        borderRadius: 999,
                      }}
                    />
                  </View>
                  <View
                    style={{
                      flex: 1,
                      height: s(8),
                      borderRadius: 999,
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={{
                        height: '100%',
                        width: `${rotatory.rightFieldAccuracy}%`,
                        backgroundColor: '#34D399',
                        borderRadius: 999,
                      }}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: s(8) }}>
                  {[
                    { label: 'Upper', value: `${Math.round(rotatory.upperFieldMedianRtSec * 1000)}ms`, color: '#7DD3FC' },
                    { label: 'Lower', value: `${Math.round(rotatory.lowerFieldMedianRtSec * 1000)}ms`, color: '#6EE7B7' },
                  ].map((item) => (
                    <View
                      key={item.label}
                      style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: s(12), padding: s(8), alignItems: 'center' }}
                    >
                      <Text style={{ color: '#9CA3AF', fontSize: fs(9), fontWeight: '700' }}>{item.label.toUpperCase()}</Text>
                      <Text style={{ color: item.color, fontSize: fs(16), fontWeight: '900' }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                {rotatory.mode !== 'colors' ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(8) }}>
                    {[
                      { label: 'Simple strokes', value: rotatory.simpleStrokeMedianRtSec },
                      { label: 'Closed forms', value: rotatory.closedRoundMedianRtSec },
                      { label: 'Open forms', value: rotatory.openRoundMedianRtSec },
                      { label: 'Dense forms', value: rotatory.denseStrokeMedianRtSec },
                    ].map((item) => (
                      <View
                        key={item.label}
                        style={{
                          width: '47%',
                          flexGrow: 1,
                          backgroundColor: 'rgba(15,23,42,0.6)',
                          borderRadius: s(12),
                          padding: s(8),
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#9CA3AF', fontSize: fs(9), fontWeight: '700' }}>{item.label.toUpperCase()}</Text>
                        <Text style={{ color: '#FCD34D', fontSize: fs(15), fontWeight: '900' }}>
                          {item.value > 0 ? `${Math.round(item.value * 1000)}ms` : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
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

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(10), marginBottom: s(18) }}>
              {metrics.map((item) => (
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
