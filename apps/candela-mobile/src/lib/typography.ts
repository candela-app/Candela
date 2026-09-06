import { StyleSheet, Text, TextInput, type TextStyle } from 'react-native';
import {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
} from '@expo-google-fonts/poppins';

/** Same weights as the website, plus 900 for mobile `fontWeight: '900'`. */
export const POPPINS_FONTS = {
  Poppins_300Light,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
  Poppins_800ExtraBold,
  Poppins_900Black,
};

const WEIGHT_TO_FAMILY: Record<string, string> = {
  '100': 'Poppins_300Light',
  '200': 'Poppins_300Light',
  '300': 'Poppins_300Light',
  '400': 'Poppins_400Regular',
  normal: 'Poppins_400Regular',
  '500': 'Poppins_500Medium',
  '600': 'Poppins_600SemiBold',
  '700': 'Poppins_700Bold',
  bold: 'Poppins_700Bold',
  '800': 'Poppins_800ExtraBold',
  '900': 'Poppins_900Black',
};

function keepOriginalFamily(family?: string) {
  if (!family) return false;
  const lower = family.toLowerCase();
  return (
    lower === 'monospace' ||
    lower === 'system' ||
    lower.startsWith('poppins_') ||
    lower.includes('sfpro') ||
    lower.includes('courier')
  );
}

function remapStyle(style: unknown) {
  const flat = (StyleSheet.flatten(style as TextStyle) || {}) as TextStyle;
  if (keepOriginalFamily(typeof flat.fontFamily === 'string' ? flat.fontFamily : undefined)) {
    return style;
  }
  const weight = flat.fontWeight != null ? String(flat.fontWeight) : '400';
  const fontFamily = WEIGHT_TO_FAMILY[weight] ?? 'Poppins_400Regular';
  return [style, { fontFamily, fontWeight: '400' as const }];
}

type HostComponent = {
  render?: (props: { style?: unknown } & Record<string, unknown>, ref: unknown) => unknown;
  __candelaPoppins?: boolean;
};

function patchHost(Component: HostComponent) {
  const original = Component.render;
  if (!original || Component.__candelaPoppins) return;
  Component.__candelaPoppins = true;
  Component.render = (props, ref) =>
    original.call(Component, { ...props, style: remapStyle(props?.style) }, ref);
}

/** Maps fontWeight → Poppins file. If fonts failed to load, skip this and keep system (SF on iOS, Roboto on Android). */
export function enablePoppinsText() {
  patchHost(Text as unknown as HostComponent);
  patchHost(TextInput as unknown as HostComponent);
}
