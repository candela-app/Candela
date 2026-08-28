'use client';

import { useEffect, useRef } from 'react';
import { CELEBRATION_CONFETTI_COLORS } from '@candela/shared';

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  kind: 'rect' | 'strip' | 'circle';
};

function spawn(width: number, height: number): Piece[] {
  const pieces: Piece[] = [];
  const colors = CELEBRATION_CONFETTI_COLORS;
  const kinds: Piece['kind'][] = ['rect', 'strip', 'circle'];
  const make = (side: 'left' | 'right') => {
    for (let i = 0; i < 70; i += 1) {
      const fromLeft = side === 'left';
      pieces.push({
        x: fromLeft ? -8 : width + 8,
        y: height * (0.18 + Math.random() * 0.52),
        vx: (fromLeft ? 1 : -1) * (7.5 + Math.random() * 11),
        vy: -10 - Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.28,
        w: 6 + Math.random() * 8,
        h: 8 + Math.random() * 14,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        kind: kinds[Math.floor(Math.random() * kinds.length)]!,
      });
    }
  };
  make('left');
  make('right');
  return pieces;
}

export function ResultsConfetti() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const pieces = spawn(canvas.width, canvas.height);
    const gravity = 0.22;
    const drag = 0.992;
    let frame = 0;
    let raf = 0;
    const maxFrames = 240;

    const tick = () => {
      frame += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.vy += gravity;
        p.vx *= drag;
        p.vy *= 0.998;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, 1 - frame / maxFrames);
        ctx.fillStyle = p.color;
        if (p.kind === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.kind === 'strip') {
          ctx.fillRect(-p.w * 0.2, -p.h / 2, p.w * 0.4, p.h);
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      if (frame < maxFrames) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[80]"
    />
  );
}
