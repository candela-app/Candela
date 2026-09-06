import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { moduleCta, type TherapyModuleId } from '@candela/shared/rn';
import { useLayout } from '../lib/layout';
import { SlidersIcon } from './icons';

export function ClickToStartOverlay({
  title,
  hint,
  onStart,
  onOpenSettings,
  onExit,
  startLabel = 'Click to Start',
  accentModuleId,
}: {
  title: string;
  hint?: string;
  onStart: () => void;
  onOpenSettings?: () => void;
  onExit?: () => void;
  startLabel?: string;
  accentModuleId?: TherapyModuleId;
}) {
  const insets = useSafeAreaInsets();
  const { fs, s } = useLayout();
  const cta = moduleCta(accentModuleId ?? 'mobile_target');

  return (
    <View
      style={{
        ...absoluteFill,
        zIndex: 30,
        backgroundColor: '#06070D',
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
          backgroundColor: cta.bar,
          borderRadius: 999,
          paddingHorizontal: s(28),
          paddingVertical: s(16),
        }}
      >
        <Text style={{ fontWeight: '900', fontSize: fs(20), color: cta.ink }}>{startLabel}</Text>
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
