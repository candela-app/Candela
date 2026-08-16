import Svg, { Circle, Line, Path, Polygon, Polyline, Rect } from 'react-native-svg';

type IconProps = { size?: number; color?: string };

export function EyeIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function EyeOffIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <Path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <Path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <Line x1="2" x2="22" y1="2" y2="22" />
    </Svg>
  );
}

export function RotatoryIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="2" />
      <Path d="M12 2v4" />
      <Path d="m6.8 15-3.5 2" />
      <Path d="m20.7 7-3.5 2" />
      <Path d="M6.8 9 3.3 7" />
      <Path d="m20.7 17-3.5-2" />
      <Path d="m9 22 3-8 3 8" />
      <Path d="M8 22h8" />
      <Path d="M18 18.7a9 9 0 1 0-12 0" />
    </Svg>
  );
}

export function PuzzleIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.234-.706 1.704l-1.611 1.611a.923.923 0 0 1-.653.27c-.493 0-.905-.386-.928-.88a2.986 2.986 0 0 0-2.98-2.854c-1.537 0-2.815 1.158-2.97 2.684a.972.972 0 0 1-.967.876h-.062c-.496-.026-.893-.43-.893-.928 0-1.65-1.35-3-3-3s-3 1.35-3 3c0 .498-.397.902-.893.928h-.062a.972.972 0 0 1-.967-.876A2.986 2.986 0 0 0 2.25 12.25a2.986 2.986 0 0 0 2.854-2.98c.023-.494.435-.88.928-.88.243 0 .487.093.653.27l1.611 1.611c.939.939 2.469.939 3.408 0l1.568-1.568c.23-.23.338-.556.289-.878A3.001 3.001 0 0 1 16.5 5c1.65 0 3 1.35 3 3a.923.923 0 0 1-.061.85z" />
    </Svg>
  );
}

export function BeePathIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 20v-9" />
      <Path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z" />
      <Path d="M14.12 3.88 16 2" />
      <Path d="M21 21a4 4 0 0 0-3.81-4" />
      <Path d="M21 5a4 4 0 0 1-3.55 3.97" />
      <Path d="M22 13h-4" />
      <Path d="M3 21a4 4 0 0 1 3.81-4" />
      <Path d="M3 5a4 4 0 0 0 3.55 3.97" />
      <Path d="M6 13H2" />
      <Path d="m8 2 1.88 1.88" />
      <Path d="M9 7.13V6a3 3 0 1 1 6 0v1.13" />
    </Svg>
  );
}

export function TargetIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Circle cx="12" cy="12" r="6" />
      <Circle cx="12" cy="12" r="2" />
      <Path d="M12 2v4" />
      <Path d="M12 18v4" />
      <Path d="M2 12h4" />
      <Path d="M18 12h4" />
    </Svg>
  );
}

export function SlidersIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Line x1="4" x2="4" y1="21" y2="14" />
      <Line x1="4" x2="4" y1="10" y2="3" />
      <Line x1="12" x2="12" y1="21" y2="12" />
      <Line x1="12" x2="12" y1="8" y2="3" />
      <Line x1="20" x2="20" y1="21" y2="16" />
      <Line x1="20" x2="20" y1="12" y2="3" />
      <Line x1="2" x2="6" y1="14" y2="14" />
      <Line x1="10" x2="14" y1="8" y2="8" />
      <Line x1="18" x2="22" y1="16" y2="16" />
    </Svg>
  );
}

export function AnalyticsIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 3v18h18" />
      <Path d="m19 9-5 5-4-4-3 3" />
    </Svg>
  );
}

export function MonitorIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect width="20" height="14" x="2" y="3" rx="2" />
      <Line x1="8" x2="16" y1="21" y2="21" />
      <Line x1="12" x2="12" y1="17" y2="21" />
    </Svg>
  );
}

export function SparklesIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <Path d="M20 3v4" />
      <Path d="M22 5h-4" />
      <Path d="M4 17v2" />
      <Path d="M5 18H3" />
    </Svg>
  );
}

export function RocketIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.71.79-1.81.2-2.55L4.5 16.5z" />
      <Path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-3.05 11a22.35 22.35 0 0 1-3.95 2z" />
      <Path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <Path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </Svg>
  );
}

export function ArrowRightIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 12h14" />
      <Path d="m12 5 7 7-7 7" />
    </Svg>
  );
}

export function ArrowDownIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14" />
      <Path d="m19 12-7 7-7-7" />
    </Svg>
  );
}

export function ZapIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </Svg>
  );
}

export function MobileTargetIcon({ size = 24, color = 'currentColor' }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect width="14" height="20" x="5" y="2" rx="3" />
      <Circle cx="9" cy="8" r="2" />
      <Circle cx="15" cy="14" r="2" />
      <Path d="m11 10 2 2" />
    </Svg>
  );
}
