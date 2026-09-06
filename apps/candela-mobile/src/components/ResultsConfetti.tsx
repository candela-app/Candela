import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, InteractionManager, View } from 'react-native';
import { CELEBRATION_CONFETTI_COLORS } from '@candela/shared/rn';

const PIECE_COUNT = 48;
const BURST_MS = 1800;

type PieceDef = {
  color: string;
  round: boolean;
  size: number;
  startXFrac: number;
  drift: number;
  duration: number;
  delay: number;
  spin: number;
};

function makeDefs(): PieceDef[] {
  return Array.from({ length: PIECE_COUNT }, (_, i) => ({
    color: CELEBRATION_CONFETTI_COLORS[i % CELEBRATION_CONFETTI_COLORS.length]!,
    round: i % 2 === 0,
    size: 6 + (i % 5),
    startXFrac: i % 2 === 0 ? 0.18 + Math.random() * 0.18 : 0.62 + Math.random() * 0.18,
    drift: (Math.random() - 0.5) * 160,
    duration: 1400 + Math.random() * 800,
    delay: Math.random() * BURST_MS,
    spin: (Math.random() > 0.5 ? 1 : -1) * (200 + Math.random() * 260),
  }));
}

type PieceAnim = {
  def: PieceDef;
  ty: Animated.Value;
  tx: Animated.Value;
  rot: Animated.Value;
  op: Animated.Value;
};

export function ResultsConfetti() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const piecesRef = useRef<PieceAnim[] | null>(null);
  if (!piecesRef.current) {
    piecesRef.current = makeDefs().map((def) => ({
      def,
      ty: new Animated.Value(-24),
      tx: new Animated.Value(0),
      rot: new Animated.Value(0),
      op: new Animated.Value(0),
    }));
  }
  const pieces = piecesRef.current;

  useEffect(() => {
    if (size.width < 2 || size.height < 2) return;
    const { height } = size;
    const runners: Animated.CompositeAnimation[] = [];

    const task = InteractionManager.runAfterInteractions(() => {
      for (const piece of pieces) {
        piece.ty.setValue(-24);
        piece.tx.setValue(0);
        piece.rot.setValue(0);
        piece.op.setValue(0);
        const run = Animated.parallel([
          Animated.sequence([
            Animated.delay(piece.def.delay),
            Animated.timing(piece.op, { toValue: 1, duration: 60, useNativeDriver: true }),
            Animated.delay(piece.def.duration * 0.5),
            Animated.timing(piece.op, {
              toValue: 0,
              duration: piece.def.duration * 0.4,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(piece.def.delay),
            Animated.timing(piece.ty, {
              toValue: height + 36,
              duration: piece.def.duration,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(piece.def.delay),
            Animated.timing(piece.tx, {
              toValue: piece.def.drift,
              duration: piece.def.duration,
              easing: Easing.out(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.delay(piece.def.delay),
            Animated.timing(piece.rot, {
              toValue: 1,
              duration: piece.def.duration,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
          ]),
        ]);
        runners.push(run);
        run.start();
      }
    });

    return () => {
      task.cancel();
      for (const run of runners) run.stop();
    };
  }, [pieces, size]);

  return (
    <View
      pointerEvents="none"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) {
          setSize({ width, height });
        }
      }}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 40,
      }}
    >
      {size.width > 0
        ? pieces.map((piece, i) => (
            <Animated.View
              key={i}
              style={{
                position: 'absolute',
                left: piece.def.startXFrac * size.width,
                top: 0,
                width: piece.def.size,
                height: piece.def.round ? piece.def.size : piece.def.size * 1.35,
                borderRadius: piece.def.round ? piece.def.size / 2 : 2,
                backgroundColor: piece.def.color,
                opacity: piece.op,
                transform: [
                  { translateX: piece.tx },
                  { translateY: piece.ty },
                  {
                    rotate: piece.rot.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${piece.def.spin}deg`],
                    }),
                  },
                ],
              }}
            />
          ))
        : null}
    </View>
  );
}
