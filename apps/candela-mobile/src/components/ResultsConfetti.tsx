import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, View } from 'react-native';
import { CELEBRATION_CONFETTI_COLORS } from '@candela/shared/rn';

type Side = 'left' | 'right';

function ConfettiPiece({ side, index }: { side: Side; index: number }) {
  const { width, height } = Dimensions.get('window');
  const startX = side === 'left' ? -14 : width + 6;
  const startY = height * (0.18 + ((index * 17) % 50) / 100);
  const dx = useRef(new Animated.Value(0)).current;
  const dy = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const color = CELEBRATION_CONFETTI_COLORS[index % CELEBRATION_CONFETTI_COLORS.length]!;
  const w = 6 + (index % 5);
  const h = 9 + (index % 7);
  const round = index % 3 === 0;

  useEffect(() => {
    const destX = (side === 'left' ? 1 : -1) * (width * (0.28 + (index % 8) * 0.04));
    const lift = -(70 + (index % 9) * 10);
    const fall = height - startY + 40;
    Animated.parallel([
      Animated.timing(dx, { toValue: destX, duration: 2400, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(dy, { toValue: lift, duration: 520, useNativeDriver: true }),
        Animated.timing(dy, { toValue: fall, duration: 1880, useNativeDriver: true }),
      ]),
      Animated.timing(rot, { toValue: 1, duration: 2400, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 2200, delay: 500, useNativeDriver: true }),
    ]).start();
  }, [dx, dy, rot, opacity, side, index, width, height, startY]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: startX,
        top: startY,
        width: w,
        height: h,
        borderRadius: round ? 99 : 2,
        backgroundColor: color,
        opacity,
        transform: [
          { translateX: dx },
          { translateY: dy },
          {
            rotate: rot.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${720 + (index % 5) * 90}deg`],
            }),
          },
        ],
      }}
    />
  );
}

export function ResultsConfetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 48 }, (_, i) => ({
        id: i,
        side: (i % 2 === 0 ? 'left' : 'right') as Side,
      })),
    [],
  );

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 40 }}>
      {pieces.map((p) => (
        <ConfettiPiece key={p.id} side={p.side} index={p.id} />
      ))}
    </View>
  );
}
