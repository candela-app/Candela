import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SessionResultData } from '@candela/shared/rn';
import { shareSessionCsv } from '../lib/csv';
import { useLayout } from '../lib/layout';

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
  if (!isOpen) return null;

  const rows: [string, string | number][] = [
    ['Patient', data.patientName],
    ['Game', data.gameName],
    ['Date', data.date],
    ['Accuracy', `${data.accuracy}%`],
    ['Correct', data.correct],
    ['Wrong', data.wrong],
    ['Clicks', data.clicksTotal],
    ['Duration', `${data.durationSec}s`],
    ['Avg reaction', `${data.avgReactionSec}s`],
    ['Speed', data.speed],
  ];

  return (
    <Modal visible={isOpen} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <ScrollView contentContainerStyle={{ padding: s(20) }}>
          <Text style={{ color: '#fff', fontSize: fs(24), fontWeight: '800', marginBottom: s(6) }}>Session complete</Text>
          <Text style={{ color: '#9CA3AF', marginBottom: s(20) }}>{data.gameName}</Text>
          {rows.map(([label, value]) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: s(10),
                borderBottomWidth: 1,
                borderBottomColor: '#1F2937',
              }}
            >
              <Text style={{ color: '#9CA3AF', fontSize: fs(13) }}>{label}</Text>
              <Text style={{ color: '#fff', fontSize: fs(14), fontWeight: '700' }}>{String(value)}</Text>
            </View>
          ))}
          <Pressable
            onPress={() => void shareSessionCsv(data)}
            style={{ marginTop: s(20), backgroundColor: '#1F2937', borderRadius: s(12), padding: s(14), alignItems: 'center' }}
          >
            <Text style={{ color: '#93C5FD', fontWeight: '700' }}>Export CSV</Text>
          </Pressable>
          <Pressable
            onPress={onReplay}
            style={{ marginTop: s(10), backgroundColor: '#2563EB', borderRadius: s(12), padding: s(14), alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Replay</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            style={{ marginTop: s(10), borderRadius: s(12), padding: s(14), alignItems: 'center' }}
          >
            <Text style={{ color: '#D1D5DB', fontWeight: '700' }}>Close</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
  );
}
