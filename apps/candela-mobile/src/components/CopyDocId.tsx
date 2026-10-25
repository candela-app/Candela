import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ExpoClipboard from 'expo-clipboard/build/ExpoClipboard';
import { CheckIcon, CopyIcon } from './icons';
import { useLayout } from '../lib/layout';

const clipboard = ExpoClipboard as {
  setStringAsync: (value: string) => Promise<boolean>;
};

export function CopyDocId({ code, plain = false }: { code: string; plain?: boolean }) {
  const { fs, s, pad } = useLayout();
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await clipboard.setStringAsync(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <View style={{ alignSelf: plain ? 'flex-start' : 'center', justifyContent: 'center' }}>
      <Modal visible={copied} transparent animationType="fade" statusBarTranslucent>
        <View pointerEvents="none" style={{ flex: 1 }}>
          <View
            style={{
              position: 'absolute',
              top: insets.top + s(64),
              right: pad,
              backgroundColor: '#111827',
              paddingHorizontal: s(12),
              paddingVertical: s(8),
              borderRadius: s(10),
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: fs(13), fontWeight: '700' }}>Copied!</Text>
          </View>
        </View>
      </Modal>
      <Pressable
        onPress={() => void onCopy()}
        accessibilityRole="button"
        accessibilityLabel={copied ? 'Copied!' : 'Copy DocID'}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(6),
          marginTop: plain ? s(4) : 0,
          backgroundColor: copied ? '#ECFDF5' : plain ? 'transparent' : '#EFF6FF',
          paddingHorizontal: plain && !copied ? 0 : s(10),
          paddingVertical: plain ? s(2) : s(6),
          borderRadius: s(8),
          borderWidth: plain && !copied ? 0 : 1,
          borderColor: copied ? '#A7F3D0' : '#BFDBFE',
        }}
      >
        <Text
          style={{
            fontFamily: copied ? undefined : 'monospace',
            fontSize: fs(plain ? 14 : 12),
            fontWeight: '700',
            color: copied ? '#059669' : '#1D4ED8',
            lineHeight: fs(plain ? 18 : 16),
          }}
        >
          {copied ? 'Copied!' : code}
        </Text>
        {copied ? <CheckIcon size={s(14)} color="#059669" /> : <CopyIcon size={s(14)} color="#6B7280" />}
      </Pressable>
    </View>
  );
}
