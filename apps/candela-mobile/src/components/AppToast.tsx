import type { Dispatch, SetStateAction } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckIcon, XIcon } from './icons';

export type AppToastType = 'success' | 'error';

export type AppToastItem = {
  id: string;
  type: AppToastType;
  message: string;
};

const PALETTE = {
  success: {
    bg: '#ECFDF5',
    border: '#A7F3D0',
    text: '#064E3B',
    iconBg: '#D1FAE5',
    icon: '#059669',
  },
  error: {
    bg: '#FEF2F2',
    border: '#FECACA',
    text: '#7F1D1D',
    iconBg: '#FEE2E2',
    icon: '#DC2626',
  },
} as const;

export function AppToastHost({
  toasts,
  onDismiss,
}: {
  toasts: AppToastItem[];
  onDismiss: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const visible = [...toasts].reverse().slice(0, 3);
  if (!visible.length) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + 12,
        right: 16,
        width: 300,
        maxWidth: '88%',
        zIndex: 9999,
        minHeight: 220,
        overflow: 'visible',
      }}
    >
      {visible.map((toast, index) => {
        const palette = PALETTE[toast.type];
        return (
          <View
            key={toast.id}
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '100%',
              transform: [{ translateY: index * 14 }, { scale: 1 - index * 0.05 }],
              zIndex: 100 - index,
              opacity: 1 - Math.min(index * 0.08, 0.35),
            }}
          >
            <Pressable
              onPress={() => onDismiss(toast.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 10,
                padding: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: palette.border,
                backgroundColor: palette.bg,
                shadowColor: '#0F172A',
                shadowOpacity: 0.12,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 8,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 10,
                  backgroundColor: palette.iconBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {toast.type === 'success' ? (
                  <CheckIcon size={16} color={palette.icon} />
                ) : (
                  <XIcon size={16} color={palette.icon} />
                )}
              </View>
              <Text
                style={{
                  flex: 1,
                  color: palette.text,
                  fontSize: 13,
                  fontWeight: '700',
                  lineHeight: 18,
                  paddingTop: 4,
                }}
              >
                {toast.message}
              </Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

export function pushAppToast(
  setToasts: Dispatch<SetStateAction<AppToastItem[]>>,
  type: AppToastType,
  message: string,
  duration = 4000,
) {
  const id = Math.random().toString(36).slice(2, 9);
  setToasts((prev) => [...prev, { id, type, message }]);
  setTimeout(() => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, duration);
}
