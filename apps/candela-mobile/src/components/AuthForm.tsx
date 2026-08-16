import { useState, type ReactNode } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EyeIcon, EyeOffIcon } from './icons';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { fs, s, pad, contentMax, width } = useLayout();

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <View
        style={{
          paddingTop: insets.top + s(8),
          paddingHorizontal: pad,
          paddingBottom: s(12),
          backgroundColor: 'rgba(255,255,255,0.96)',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.replace('/')}>
          <Text style={{ fontSize: fs(24), fontWeight: '800', color: colors.ink }}>Kandela</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, justifyContent: 'center', padding: pad, alignItems: 'center' }}>
        <View
          style={{
            width: Math.min(contentMax, width - pad * 2),
            maxWidth: 420,
            backgroundColor: colors.white,
            borderRadius: s(24),
            padding: s(24),
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: fs(22), fontWeight: '800', color: colors.text, marginBottom: s(20) }}>{title}</Text>
          {children}
        </View>
      </View>
    </View>
  );
}

export function Field({
  label,
  value,
  onChange,
  keyboardType = 'default',
  autoComplete,
  secureTextEntry,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoComplete?: TextInput['props']['autoComplete'];
  secureTextEntry?: boolean;
}) {
  const { fs, s } = useLayout();
  return (
    <View style={{ marginBottom: s(14) }}>
      <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151', marginBottom: s(6) }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoComplete={autoComplete}
        secureTextEntry={secureTextEntry}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: s(12),
          paddingHorizontal: s(14),
          paddingVertical: s(12),
          fontSize: fs(14),
          fontWeight: '500',
          color: colors.text,
          backgroundColor: colors.white,
        }}
      />
    </View>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: TextInput['props']['autoComplete'];
}) {
  const [visible, setVisible] = useState(false);
  const { fs, s } = useLayout();
  return (
    <View style={{ marginBottom: s(14) }}>
      <Text style={{ fontSize: fs(13), fontWeight: '600', color: '#374151', marginBottom: s(6) }}>{label}</Text>
      <View>
        <TextInput
          value={value}
          onChangeText={onChange}
          autoComplete={autoComplete}
          autoCapitalize="none"
          secureTextEntry={!visible}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: s(12),
            paddingHorizontal: s(14),
            paddingVertical: s(12),
            paddingRight: s(44),
            fontSize: fs(14),
            fontWeight: '500',
            color: colors.text,
            backgroundColor: colors.white,
          }}
        />
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          style={{ position: 'absolute', right: s(10), top: 0, bottom: 0, justifyContent: 'center' }}
        >
          {visible ? <EyeOffIcon size={s(20)} color="#6B7280" /> : <EyeIcon size={s(20)} color="#6B7280" />}
        </Pressable>
      </View>
    </View>
  );
}

export function PrimaryButton({
  children,
  disabled,
  onPress,
}: {
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { fs, s } = useLayout();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        marginTop: s(8),
        backgroundColor: colors.blue,
        borderRadius: s(12),
        paddingVertical: s(14),
        alignItems: 'center',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Text style={{ color: colors.white, fontWeight: '700', fontSize: fs(14) }}>{children}</Text>
    </Pressable>
  );
}
