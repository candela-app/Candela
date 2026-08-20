import { Modal, Pressable, Text, View } from 'react-native';
import { useLayout } from '../lib/layout';

export function ResetConfirmDialog({
  visible,
  onCancel,
  onConfirm,
  title = 'Reset this game?',
  message = 'This session will start over, and the current progress will be lost.',
  cancelLabel = 'Keep playing',
  confirmLabel = 'Reset',
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  cancelLabel?: string;
  confirmLabel?: string;
}) {
  const { s, fs } = useLayout();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.72)',
          justifyContent: 'center',
          paddingHorizontal: s(24),
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
            {title}
          </Text>
          <Text style={{ color: '#9CA3AF', fontSize: fs(14), lineHeight: fs(20), marginBottom: s(18) }}>
            {message}
          </Text>
          <View style={{ flexDirection: 'row', gap: s(10) }}>
            <Pressable
              onPress={onCancel}
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
              <Text style={{ color: '#E5E7EB', fontWeight: '700' }}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{
                flex: 1,
                backgroundColor: '#B91C1C',
                borderRadius: s(12),
                paddingVertical: s(12),
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '800' }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
