import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../lib/layout';
import { ResetConfirmDialog } from './ResetConfirmDialog';

export interface ClinicalSettingSummaryItem {
  label: string;
  value: ReactNode;
}

export function GameMenuDrawer({
  isOpen,
  onClose,
  onQuit,
  onReset,
  onOpenSettings,
  resetButtonLabel = 'Reset Game',
  extraControls,
  settingsSummary,
  sessionInProgress = true,
}: {
  isOpen: boolean;
  onClose: () => void;
  onQuit: () => void;
  onReset: () => void;
  onOpenSettings?: () => void;
  resetButtonLabel?: string;
  extraControls?: ReactNode;
  settingsSummary: ClinicalSettingSummaryItem[];
  sessionInProgress?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s, width } = useLayout();
  const drawerWidth = Math.min(340, width * 0.88);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setConfirmReset(false);
      setConfirmQuit(false);
    }
  }, [isOpen]);

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            width: drawerWidth,
            backgroundColor: '#111111',
            paddingTop: insets.top + s(12),
            paddingBottom: insets.bottom + s(16),
            paddingHorizontal: s(18),
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: s(16) }}>
            <Text style={{ color: '#fff', fontSize: fs(20), fontWeight: '700' }}>Menu</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: '#fff', fontSize: fs(22) }}>✕</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              if (sessionInProgress) setConfirmQuit(true);
              else {
                onClose();
                onQuit();
              }
            }}
            style={[menuBtn, menuBtnQuit]}
          >
            <Text style={[menuBtnText, { color: '#fff' }]}>Quit Game</Text>
          </Pressable>
          <Pressable
            onPress={() => setConfirmReset(true)}
            style={menuBtn}
          >
            <Text style={menuBtnText}>{resetButtonLabel}</Text>
          </Pressable>
          {onOpenSettings ? (
            <Pressable
              onPress={() => {
                onClose();
                onOpenSettings();
              }}
              style={[menuBtn, { backgroundColor: 'rgba(37,99,235,0.2)', borderColor: 'rgba(59,130,246,0.4)' }]}
            >
              <Text style={[menuBtnText, { color: '#60A5FA' }]}>Clinical Settings</Text>
            </Pressable>
          ) : null}
          {extraControls}
          <ScrollView style={{ marginTop: s(16) }}>
            <Text style={{ color: '#9CA3AF', fontSize: fs(12), fontWeight: '700', marginBottom: s(8) }}>SESSION</Text>
            {settingsSummary.map((item) => (
              <View key={item.label} style={{ marginBottom: s(10) }}>
                <Text style={{ color: '#9CA3AF', fontSize: fs(11) }}>{item.label}</Text>
                {typeof item.value === 'string' || typeof item.value === 'number' ? (
                  <Text style={{ color: '#fff', fontSize: fs(14), fontWeight: '600' }}>{item.value}</Text>
                ) : (
                  item.value
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
      <ResetConfirmDialog
        visible={confirmReset}
        confirmLabel={resetButtonLabel}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          onClose();
          onReset();
        }}
      />
      <ResetConfirmDialog
        visible={confirmQuit}
        title="Leave this game?"
        message="This session isn't finished yet. If you leave now, the current progress will be lost."
        confirmLabel="Leave"
        onCancel={() => setConfirmQuit(false)}
        onConfirm={() => {
          setConfirmQuit(false);
          onClose();
          onQuit();
        }}
      />
    </Modal>
  );
}

const menuBtn = {
  width: '100%' as const,
  paddingVertical: 12,
  paddingHorizontal: 16,
  backgroundColor: '#222222',
  borderWidth: 1,
  borderColor: '#374151',
  borderRadius: 12,
  marginBottom: 10,
};

const menuBtnQuit = {
  backgroundColor: '#B91C1C',
  borderColor: '#991B1B',
};

const menuBtnText = { color: '#E5E7EB', fontWeight: '600' as const, textAlign: 'center' as const };
