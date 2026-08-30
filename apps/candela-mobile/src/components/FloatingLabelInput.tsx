import { useState, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { EyeIcon, EyeOffIcon } from './icons';
import { useLayout } from '../lib/layout';
import { colors } from '../lib/theme';

export type FloatingLabelVariant = 'light' | 'dark';

type FloatingLabelInputProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  variant?: FloatingLabelVariant;
  error?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  secureTextEntry?: boolean;
  editable?: boolean;
  maxLength?: number;
  style?: StyleProp<ViewStyle>;
  endAdornment?: ReactNode;
  autoFocus?: boolean;
};

export function FloatingLabelInput({
  label,
  value,
  onChangeText,
  variant = 'light',
  error,
  keyboardType = 'default',
  autoComplete,
  autoCapitalize,
  secureTextEntry,
  editable = true,
  maxLength,
  style,
  endAdornment,
  autoFocus,
}: FloatingLabelInputProps) {
  const { fs, s } = useLayout();
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;
  const dark = variant === 'dark';

  const borderColor = error
    ? '#F43F5E'
    : focused
      ? dark
        ? '#F59E0B'
        : colors.blue
      : dark
        ? '#374151'
        : colors.border;
  const bg = dark ? '#141414' : colors.white;
  const textColor = dark ? '#F8FAFC' : colors.text;
  const labelColor = floated
    ? dark
      ? '#FBBF24'
      : colors.blue
    : dark
      ? '#9CA3AF'
      : '#6B7280';

  return (
    <View style={[{ marginBottom: s(14), marginTop: floated ? s(8) : 0 }, style]}>
      <View style={{ position: 'relative' }}>
        <View
          style={{
            borderWidth: 1,
            borderColor,
            borderRadius: s(12),
            backgroundColor: bg,
            opacity: editable ? 1 : 0.6,
            minHeight: s(52),
            justifyContent: 'center',
          }}
        >
          <TextInput
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            autoComplete={autoComplete}
            autoCapitalize={
              autoCapitalize ??
              (keyboardType === 'email-address' || secureTextEntry ? 'none' : 'sentences')
            }
            secureTextEntry={secureTextEntry}
            editable={editable}
            maxLength={maxLength}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus={autoFocus}
            placeholder=""
            placeholderTextColor="transparent"
            style={{
              paddingHorizontal: s(14),
              paddingVertical: s(14),
              paddingRight: endAdornment ? s(44) : s(14),
              fontSize: fs(14),
              fontWeight: '500',
              color: textColor,
            }}
          />
          {endAdornment ? (
            <View
              style={{
                position: 'absolute',
                right: s(10),
                top: 0,
                bottom: 0,
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              {endAdornment}
            </View>
          ) : null}
        </View>
        <Text
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: s(12),
            top: floated ? -fs(7) : '50%',
            marginTop: floated ? 0 : -fs(9),
            fontSize: floated ? fs(11) : fs(14),
            fontWeight: '600',
            color: labelColor,
            zIndex: 10,
            backgroundColor: floated ? bg : 'transparent',
            paddingHorizontal: floated ? s(6) : s(2),
            overflow: 'hidden',
            includeFontPadding: false,
          }}
        >
          {label}
        </Text>
      </View>
      {error ? (
        <Text style={{ marginTop: s(6), fontSize: fs(12), fontWeight: '600', color: '#F43F5E' }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function FloatingLabelPasswordInput({
  label,
  value,
  onChangeText,
  variant = 'light',
  error,
  autoComplete,
  editable,
  style,
}: Omit<FloatingLabelInputProps, 'secureTextEntry' | 'endAdornment' | 'keyboardType'>) {
  const [visible, setVisible] = useState(false);
  const { s } = useLayout();
  const iconColor = variant === 'dark' ? '#9CA3AF' : '#6B7280';

  return (
    <FloatingLabelInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      variant={variant}
      error={error}
      autoComplete={autoComplete}
      autoCapitalize="none"
      secureTextEntry={!visible}
      editable={editable}
      style={style}
      endAdornment={
        <Pressable
          onPress={() => setVisible((v) => !v)}
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          hitSlop={8}
        >
          {visible ? (
            <EyeOffIcon size={s(20)} color={iconColor} />
          ) : (
            <EyeIcon size={s(20)} color={iconColor} />
          )}
        </Pressable>
      }
    />
  );
}
