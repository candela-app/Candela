import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, View } from 'react-native';
import { CELEBRATION_CONFETTI_COLORS } from '@candela/shared/rn';
import { useLayout } from '../lib/layout';

type Kind = 'rect' | 'strip' | 'circle';

function hash(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function ConfettiPiece({ index }: { index: number }) {
  const { width, height } = Dimensions.get('window');
  const a = hash(index + 1);
  const b = hash(index + 17);
  const c = hash(index + 41);
  const d = hash(index + 73);

  const fromLeft = index % 2 === 0;
  const startX = fromLeft ? -14 : width + 6;
  const startY = height * (0.16 + b * 0.5);

  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const flutter = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const color = CELEBRATION_CONFETTI_COLORS[Math.floor(c * CELEBRATION_CONFETTI_COLORS.length)]!;
  const kinds: Kind[] = ['rect', 'strip', 'circle'];
  const kind = kinds[Math.floor(d * kinds.length)]!;
  const w = kind === 'strip' ? 3.5 + a * 2.5 : 6 + a * 7;
  const h = kind === 'circle' ? w : kind === 'strip' ? 12 + b * 18 : 7 + c * 11;
  const delay = Math.round(a * 220);
  const burstMs = 380 + Math.round(b * 220);
  const fallMs = 2200 + Math.round(c * 1100);
  const inward = (fromLeft ? 1 : -1) * (width * (0.28 + a * 0.42));
  const lift = -(height * (0.18 + c * 0.2));
  const fall = height - startY + 90;
  const spinDeg = `${Math.round((540 + a * 900) * (fromLeft ? 1 : -1))}deg`;

  useEffect(() => {
    const gravity = Easing.bezier(0.18, 0.02, 0.58, 1);
    const run = Animated.parallel([
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dx, {
          toValue: inward,
          duration: burstMs + fallMs,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(dy, {
          toValue: lift,
          duration: burstMs,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(dy, {
          toValue: fall,
          duration: fallMs,
          easing: gravity,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(rot, {
          toValue: 1,
          duration: burstMs + fallMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
      Animated.loop(
        Animated.sequence([
          Animated.timing(flutter, {
            toValue: 1,
            duration: 240 + a * 180,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(flutter, {
            toValue: 0,
            duration: 240 + d * 180,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ),
      Animated.sequence([
        Animated.delay(delay + (burstMs + fallMs) * 0.62),
        Animated.timing(opacity, {
          toValue: 0,
          duration: (burstMs + fallMs) * 0.38,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    run.start();
    return () => run.stop();
  }, [dx, dy, rot, flutter, opacity, delay, burstMs, fallMs, inward, lift, fall, a, d]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: w,
        height: h,
        borderRadius: kind === 'circle' ? 99 : kind === 'strip' ? 1 : 2,
        backgroundColor: color,
        opacity,
        transform: [
          { translateX: dx },
          { translateY: dy },
          {
            translateX: flutter.interpolate({
              inputRange: [0, 1],
              outputRange: [-8 - a * 10, 8 + a * 10],
            }),
          },
          {
            rotate: rot.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', spinDeg],
            }),
          },
          {
            scaleX: flutter.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.18],
            }),
          },
        ],
      }}
    />
  );
}

export function ResultsConfetti() {
  const { isTablet } = useLayout();
  const count = isTablet ? 220 : 160;
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => i), [count]);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}>
      {pieces.map((i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </View>
  );
}
