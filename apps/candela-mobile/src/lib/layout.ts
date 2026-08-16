import { PixelRatio, useWindowDimensions } from 'react-native';

const BASE_SHORT_EDGE = 390;

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const shortest = Math.min(width, height);
  const longest = Math.max(width, height);
  const scale = Math.min(Math.max(shortest / BASE_SHORT_EDGE, 0.72), 1.75);
  const s = (n: number) => Math.round(n * scale);
  const fs = (n: number) => Math.round(PixelRatio.roundToNearestPixel(n * scale));
  const isTablet = shortest >= 600;
  const isLandscape = width > height;
  const columns = width >= 1100 ? 4 : width >= 820 ? 3 : width >= 560 ? 2 : 1;
  const pad = s(16);
  const contentMax = Math.min(width - pad * 2, isTablet ? 720 : width - pad * 2);

  return {
    width,
    height,
    shortest,
    longest,
    scale,
    s,
    fs,
    isTablet,
    isLandscape,
    columns,
    pad,
    contentMax,
  };
}
