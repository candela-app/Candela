import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Rect } from 'react-native-svg';
import { CELEBRATION_CONFETTI_COLORS } from '@candela/shared/rn';

type Fetti = {
  x: number;
  y: number;
  velocity: number;
  angle2D: number;
  tiltAngle: number;
  wobble: number;
  wobbleSpeed: number;
  gravity: number;
  decay: number;
  tick: number;
  totalTicks: number;
  color: string;
  kind: 'rect' | 'circle';
  scalar: number;
  alive: boolean;
};

function fireCannon(originX: number, originY: number, angle: number, width: number, height: number): Fetti {
  const radAngle = (angle * Math.PI) / 180;
  const radSpread = (55 * Math.PI) / 180;
  return {
    x: originX * width,
    y: originY * height,
    velocity: 60 * 0.5 + Math.random() * 60,
    angle2D: -radAngle + (0.5 * radSpread - Math.random() * radSpread),
    tiltAngle: Math.random() * Math.PI,
    wobble: Math.random() * 10,
    wobbleSpeed: Math.min(0.11, Math.random() * 0.1 + 0.05),
    gravity: 3,
    decay: 0.9,
    tick: 0,
    totalTicks: 200,
    color: CELEBRATION_CONFETTI_COLORS[Math.floor(Math.random() * CELEBRATION_CONFETTI_COLORS.length)]!,
    kind: Math.random() > 0.5 ? 'circle' : 'rect',
    scalar: 0.85 + Math.random() * 0.4,
    alive: true,
  };
}

function step(p: Fetti) {
  p.x += Math.cos(p.angle2D) * p.velocity;
  p.y += Math.sin(p.angle2D) * p.velocity + p.gravity;
  p.velocity *= p.decay;
  p.wobble += p.wobbleSpeed;
  p.tiltAngle += 0.1;
  p.tick += 1;
  if (p.tick >= p.totalTicks) p.alive = false;
}

export function ResultsConfetti() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [, setTick] = useState(0);
  const piecesRef = useRef<Fetti[]>([]);

  useEffect(() => {
    if (size.width < 2 || size.height < 2) return;
    piecesRef.current = [];
    const end = Date.now() + 3 * 1000;
    let raf = 0;
    const maxLive = 160;

    const frame = () => {
      const now = Date.now();
      const live = piecesRef.current.filter((p) => p.alive);
      if (now <= end) {
        const room = Math.max(0, maxLive - live.length);
        const n = Math.min(2, Math.floor(room / 2));
        for (let i = 0; i < n; i += 1) {
          live.push(fireCannon(0, 0.5, 60, size.width, size.height));
          live.push(fireCannon(1, 0.5, 120, size.width, size.height));
        }
      }
      for (const p of live) step(p);
      piecesRef.current = live.filter((p) => p.alive);
      setTick((n) => n + 1);
      if (now <= end || piecesRef.current.length > 0) {
        raf = requestAnimationFrame(frame);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [size.width, size.height]);

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
      {size.width > 0 ? (
        <Svg width={size.width} height={size.height}>
          {piecesRef.current.map((p, i) => {
            const progress = p.tick / p.totalTicks;
            const wobbleX = 8 * p.scalar * Math.cos(p.wobble);
            const wobbleY = 8 * p.scalar * Math.sin(p.wobble);
            const w = Math.max(4, Math.abs(wobbleX));
            const h = Math.max(4, Math.abs(wobbleY));
            return (
              <G
                key={i}
                opacity={Math.max(0, 1 - progress)}
                transform={`translate(${p.x}, ${p.y}) rotate(${(p.tiltAngle * 180) / Math.PI})`}
              >
                {p.kind === 'circle' ? (
                  <Circle r={4.5 * p.scalar} fill={p.color} />
                ) : (
                  <Rect x={-w / 2} y={-h / 2} width={w} height={h} fill={p.color} />
                )}
              </G>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
