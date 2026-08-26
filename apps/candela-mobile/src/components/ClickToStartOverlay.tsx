import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLayout } from '../lib/layout';
import { SlidersIcon } from './icons';

export function ClickToStartOverlay({
  title,
  hint,
  onStart,
  onOpenSettings,
  onExit,
}: {
  title: string;
  hint?: string;
  onStart: () => void;
  onOpenSettings?: () => void;
  onExit?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();

  return (
    <View
      style={{
        ...absoluteFill,
        zIndex: 30,
        backgroundColor: 'rgba(6,7,13,0.98)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: s(24),
      }}
      pointerEvents="box-none"
    >
      {onExit ? (
        <Pressable
          onPress={onExit}
          accessibilityRole="button"
          accessibilityLabel="Exit module"
          style={{
            position: 'absolute',
            top: insets.top + s(12),
            left: s(16),
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: '#1F2937',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 31,
          }}
        >
          <Text style={{ color: '#E5E7EB', fontSize: fs(16), fontWeight: '700' }}>✕</Text>
        </Pressable>
      ) : null}

      {onOpenSettings ? (
        <Pressable
          onPress={onOpenSettings}
          accessibilityRole="button"
          accessibilityLabel="Open clinical settings"
          style={{
            position: 'absolute',
            top: insets.top + s(12),
            right: s(16),
            width: s(40),
            height: s(40),
            borderRadius: s(20),
            backgroundColor: '#1F2937',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 31,
          }}
        >
          <SlidersIcon size={20} color="#94A3B8" />
        </Pressable>
      ) : null}

      <Text style={{ color: '#fff', fontSize: fs(26), fontWeight: '900', marginBottom: s(10), textAlign: 'center' }}>
        {title}
      </Text>
      {hint ? (
        <Text
          style={{
            color: '#9CA3AF',
            fontSize: fs(14),
            lineHeight: fs(20),
            textAlign: 'center',
            marginBottom: s(20),
            maxWidth: 420,
          }}
        >
          {hint}
        </Text>
      ) : null}
      <Pressable
        onPress={onStart}
        style={{
          backgroundColor: '#34D399',
          borderRadius: 999,
          paddingHorizontal: s(28),
          paddingVertical: s(16),
        }}
      >
        <Text style={{ fontWeight: '900', fontSize: fs(20), color: '#052e1c' }}>Click to Start</Text>
      </Pressable>
    </View>
  );
}

const absoluteFill = {
  position: 'absolute' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};
