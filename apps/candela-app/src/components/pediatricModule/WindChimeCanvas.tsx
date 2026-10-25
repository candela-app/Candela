'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import {
  WindChimeSettings,
  ChimeStrikeEvent,
  playSynthesizedChimeStrike,
  CHIME_SCALE_DEFINITIONS,
} from '@candela/shared';

interface Ripple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  color: string;
  wobble: number;
}

interface TubeState {
  length: number;
  angle: number;       // sway angle in radians
  angularVel: number;  // angular velocity
  hitTimer: number;    // flash intensity when struck
}

export interface WindChimeCanvasProps {
  settings: WindChimeSettings;
  onStrikeEvent: (event: ChimeStrikeEvent) => void;
  isPaused?: boolean;
}

export const WindChimeCanvas: React.FC<WindChimeCanvasProps> = ({
  settings,
  onStrikeEvent,
  isPaused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Sound & physics state
  const lastStrikeTimesRef = useRef<number[]>([0, 0, 0, 0, 0, 0]);
  const ripplesRef = useRef<Ripple[]>([]);
  const particlesRef = useRef<Particle[]>([]);

  // 6 Chime Tubes (graduated lengths)
  const tubesRef = useRef<TubeState[]>([
    { length: 180, angle: 0, angularVel: 0, hitTimer: 0 },
    { length: 210, angle: 0, angularVel: 0, hitTimer: 0 },
    { length: 240, angle: 0, angularVel: 0, hitTimer: 0 },
    { length: 270, angle: 0, angularVel: 0, hitTimer: 0 },
    { length: 300, angle: 0, angularVel: 0, hitTimer: 0 },
    { length: 335, angle: 0, angularVel: 0, hitTimer: 0 },
  ]);

  // Center compound pendulum: Clapper & Sail
  const clapperRef = useRef({
    x: 0,
    y: 0,
    angle: 0,
    angularVel: 0,
    isDragging: false,
  });

  const sailRef = useRef({
    x: 0,
    y: 0,
    angle: 0,
    angularVel: 0,
    isDragging: false,
  });

  // Touch tracking
  const activePointerRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    prevX: number;
    prevY: number;
    lastTime: number;
    target: 'none' | 'sail' | 'clapper' | number; // tube index or element
  } | null>(null);

  // Initialize ambient background particles
  useEffect(() => {
    const count = settings.sensoryTheme === 'twilight' ? 35 : 22;
    const parts: Particle[] = [];
    for (let i = 0; i < count; i++) {
      parts.push({
        x: Math.random() * 1000,
        y: Math.random() * 1000,
        vx: 0.2 + Math.random() * 0.5,
        vy: -0.1 + Math.random() * 0.4,
        size: 2 + Math.random() * 4,
        alpha: 0.2 + Math.random() * 0.6,
        color:
          settings.sensoryTheme === 'twilight'
            ? 'rgba(254, 240, 138, ' // gentle yellow-green firefly
            : settings.sensoryTheme === 'warm_sunset'
            ? 'rgba(253, 186, 116, ' // golden sunset mote
            : 'rgba(187, 247, 208, ', // soft garden petal
        wobble: Math.random() * Math.PI * 2,
      });
    }
    particlesRef.current = parts;
  }, [settings.sensoryTheme]);

  // Sound trigger helper
  const triggerTubeSound = useCallback(
    (
      tubeIndex: number,
      velocity: number,
      source: 'direct_touch' | 'clapper_strike' | 'ambient_wind',
      impactX: number,
      impactY: number
    ) => {
      const now = performance.now();
      // Debounce minimum 90ms per individual tube to avoid clipping
      if (now - lastStrikeTimesRef.current[tubeIndex] < 95) return;
      lastStrikeTimesRef.current[tubeIndex] = now;

      // Flash hit indicator on tube
      if (tubesRef.current[tubeIndex]) {
        tubesRef.current[tubeIndex].hitTimer = 1.0;
      }

      // Calculate pan: left chimes pan left, right chimes pan right
      const pan = (tubeIndex - 2.5) / 3.0;

      // Play synthesized audio
      const played = playSynthesizedChimeStrike({
        tubeIndex,
        scalePreset: settings.scalePreset,
        velocityPxPerSec: velocity,
        pan,
        decaySec: settings.decayDurationSec,
        enableStereo: settings.stereoPanning,
      });

      // Force category
      let forceCat: 'gentle' | 'moderate' | 'heavy' = 'moderate';
      if (velocity < 180) forceCat = 'gentle';
      else if (velocity > 420) forceCat = 'heavy';

      // Lateral classification
      let lateralPos: 'left' | 'center' | 'right' = 'center';
      if (tubeIndex < 2) lateralPos = 'left';
      else if (tubeIndex > 3) lateralPos = 'right';

      // Visual sensory ripple
      if (settings.visualRipple) {
        ripplesRef.current.push({
          x: impactX,
          y: impactY,
          radius: 8,
          maxRadius: 65 * settings.chimeScale,
          alpha: 0.75,
          color:
            settings.sensoryTheme === 'twilight'
              ? 'rgba(147, 197, 253, '
              : settings.sensoryTheme === 'warm_sunset'
              ? 'rgba(251, 191, 36, '
              : 'rgba(234, 179, 8, ',
        });
      }

      // Record event
      const scaleDefs = CHIME_SCALE_DEFINITIONS[settings.scalePreset] || CHIME_SCALE_DEFINITIONS.koshi_aria;
      const note = scaleDefs[tubeIndex % scaleDefs.length];
      onStrikeEvent({
        timestampMs: Date.now(),
        tubeIndex,
        frequencyHz: played?.freq ?? note.freq,
        noteName: played?.noteName ?? note.name,
        velocityPxPerSec: Math.round(velocity),
        forceCategory: forceCat,
        lateralPosition: lateralPos,
        source,
      });
    },
    [settings, onStrikeEvent]
  );

  // Main animation and physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const dt = Math.min((time - lastTime) / 1000, 0.04);
      lastTime = time;

      const width = canvas.width;
      const height = canvas.height;

      // 1. Draw Sensory Atmosphere Background
      drawBackground(ctx, width, height, settings.sensoryTheme, time);

      // Ambient wind oscillation (soft breathing rhythm ~0.18 Hz)
      const breezeOsc = Math.sin(time * 0.0012) * settings.ambientBreeze * 0.12;
      const breezeGust = Math.sin(time * 0.00045 + 1.2) * settings.ambientBreeze * 0.08;
      const totalWindAngle = breezeOsc + breezeGust;

      // Center disc suspension anchor point
      const scale = settings.chimeScale;
      const discCenterX = width / 2;
      const discCenterY = height * 0.18;
      const discRadiusX = 85 * scale;
      const discRadiusZ = 35 * scale;

      // 2. Update Clapper & Sail Physics
      if (!isPaused) {
        updateCenterPendulums(discCenterX, discCenterY, dt, totalWindAngle, scale);
      }

      // 3. Update Chime Tube Physics
      const numTubes = tubesRef.current.length;
      const tubeVisuals: {
        index: number;
        hangX: number;
        hangY: number;
        bottomX: number;
        bottomY: number;
        z: number;
        length: number;
        angle: number;
        hitTimer: number;
      }[] = [];

      for (let i = 0; i < numTubes; i++) {
        const tube = tubesRef.current[i];
        const baseAngle = (i * (Math.PI * 2)) / numTubes;

        // Position on disc rim in 3D
        const hangX = discCenterX + Math.cos(baseAngle) * discRadiusX;
        const hangY = discCenterY + Math.sin(baseAngle) * discRadiusZ;
        const z = Math.sin(baseAngle); // -1 (back) to +1 (front)

        if (!isPaused) {
          // Natural frequency depends on length
          const naturalFreq = 9.8 / (tube.length * 0.004);
          const restorativeTorque = -naturalFreq * tube.angle;
          const damping = -2.8 * tube.angularVel;
          const windTorque = (totalWindAngle - tube.angle) * 1.5;

          const angularAcc = restorativeTorque + damping + windTorque;
          tube.angularVel += angularAcc * dt;
          tube.angle += tube.angularVel * dt;

          if (tube.hitTimer > 0) {
            tube.hitTimer = Math.max(0, tube.hitTimer - dt * 3.5);
          }
        }

        const effectiveLength = tube.length * scale;
        const bottomX = hangX + Math.sin(tube.angle) * effectiveLength;
        const bottomY = hangY + Math.cos(tube.angle) * effectiveLength;

        // Check collision between central clapper and this tube
        const clapperX = clapperRef.current.x;
        const clapperY = clapperRef.current.y;
        const clapperRadius = 32 * scale;

        // Distance from clapper to tube midpoint
        const tubeMidX = hangX + Math.sin(tube.angle) * (effectiveLength * 0.48);
        const tubeMidY = hangY + Math.cos(tube.angle) * (effectiveLength * 0.48);
        const distToClapper = Math.hypot(clapperX - tubeMidX, clapperY - tubeMidY);

        if (!isPaused && distToClapper < clapperRadius + 14 * scale) {
          // Clapper struck tube!
          const strikeVel = Math.hypot(clapperRef.current.angularVel * 180, tube.angularVel * 160) + 120;
          
          // Deflect tube away
          const deflectDir = clapperX < tubeMidX ? 0.35 : -0.35;
          tube.angularVel += deflectDir * (strikeVel / 350);
          clapperRef.current.angularVel -= deflectDir * 0.25;

          triggerTubeSound(i, strikeVel, 'clapper_strike', tubeMidX, tubeMidY);
        }

        tubeVisuals.push({
          index: i,
          hangX,
          hangY,
          bottomX,
          bottomY,
          z,
          length: effectiveLength,
          angle: tube.angle,
          hitTimer: tube.hitTimer,
        });
      }

      // Sort tubes by Z-depth: Back tubes drawn first, front tubes drawn last!
      tubeVisuals.sort((a, b) => a.z - b.z);

      // 4. Draw Hanging Strings & Top Suspension
      drawTopSuspension(ctx, width, discCenterX, discCenterY, discRadiusX, discRadiusZ);

      // 5. Draw Back Tubes (Z < -0.1)
      tubeVisuals.forEach((t) => {
        if (t.z < -0.1) {
          drawChimeTube(ctx, t, scale, settings.sensoryTheme);
        }
      });

      // 6. Draw Central Clapper & Sail
      drawCenterAssembly(
        ctx,
        discCenterX,
        discCenterY,
        clapperRef.current,
        sailRef.current,
        scale,
        settings.sensoryTheme
      );

      // 7. Draw Front Tubes (Z >= -0.1)
      tubeVisuals.forEach((t) => {
        if (t.z >= -0.1) {
          drawChimeTube(ctx, t, scale, settings.sensoryTheme);
        }
      });

      // 8. Draw Top Wooden Disc on top of tube strings
      drawTopDisc(ctx, discCenterX, discCenterY, discRadiusX, discRadiusZ, settings.sensoryTheme);

      // 9. Draw Visual Ripples
      drawRipples(ctx, ripplesRef.current, dt);

      // 10. Draw Ambient Particles
      drawParticles(ctx, particlesRef.current, width, height, dt);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [settings, isPaused, triggerTubeSound]);

  // Center pendulums physics update
  const updateCenterPendulums = (
    anchorX: number,
    anchorY: number,
    dt: number,
    windAngle: number,
    scale: number
  ) => {
    const clapper = clapperRef.current;
    const sail = sailRef.current;

    const clapperStringLength = 145 * scale;
    const sailStringLength = 295 * scale;

    // Clapper pendulum dynamics
    if (!clapper.isDragging) {
      const g = 9.8 / (clapperStringLength * 0.0035);
      const torque = -g * clapper.angle + (windAngle - clapper.angle) * 1.8 + (sail.angle - clapper.angle) * 0.8;
      const damping = -2.2 * clapper.angularVel;
      clapper.angularVel += (torque + damping) * dt;
      clapper.angle += clapper.angularVel * dt;
    }

    // Sail pendulum dynamics (larger wind surface area = catches more wind!)
    if (!sail.isDragging) {
      const g = 9.8 / (sailStringLength * 0.0035);
      const torque = -g * sail.angle + (windAngle * 2.2 - sail.angle) * 2.4 + (clapper.angle - sail.angle) * 0.6;
      const damping = -2.0 * sail.angularVel;
      sail.angularVel += (torque + damping) * dt;
      sail.angle += sail.angularVel * dt;
    }

    // Positions
    clapper.x = anchorX + Math.sin(clapper.angle) * clapperStringLength;
    clapper.y = anchorY + Math.cos(clapper.angle) * clapperStringLength;

    sail.x = anchorX + Math.sin(sail.angle) * sailStringLength;
    sail.y = anchorY + Math.cos(sail.angle) * sailStringLength;
  };

  // Canvas resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Pointer Interaction Handlers (Touch & Mouse)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const scale = settings.chimeScale;

    // Check hit on Sail (bottom paddle)
    const sailDist = Math.hypot(x - sailRef.current.x, y - sailRef.current.y);
    if (sailDist < 48 * scale) {
      sailRef.current.isDragging = true;
      activePointerRef.current = {
        id: e.pointerId,
        startX: x,
        startY: y,
        prevX: x,
        prevY: y,
        lastTime: performance.now(),
        target: 'sail',
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Check hit on Clapper
    const clapperDist = Math.hypot(x - clapperRef.current.x, y - clapperRef.current.y);
    if (clapperDist < 38 * scale) {
      clapperRef.current.isDragging = true;
      activePointerRef.current = {
        id: e.pointerId,
        startX: x,
        startY: y,
        prevX: x,
        prevY: y,
        lastTime: performance.now(),
        target: 'clapper',
      };
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    // Check hit on individual Chime Tubes
    const discCenterX = rect.width / 2;
    const discCenterY = rect.height * 0.18;
    const discRadiusX = 85 * scale;
    const discRadiusZ = 35 * scale;

    for (let i = 0; i < tubesRef.current.length; i++) {
      const tube = tubesRef.current[i];
      const baseAngle = (i * (Math.PI * 2)) / tubesRef.current.length;
      const hangX = discCenterX + Math.cos(baseAngle) * discRadiusX;
      const hangY = discCenterY + Math.sin(baseAngle) * discRadiusZ;
      const effLen = tube.length * scale;

      // Bounding box approximation around tube cylinder
      const minX = Math.min(hangX, hangX + Math.sin(tube.angle) * effLen) - 22 * scale;
      const maxX = Math.max(hangX, hangX + Math.sin(tube.angle) * effLen) + 22 * scale;
      const minY = hangY;
      const maxY = hangY + effLen;

      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        // Direct strike on this tube!
        const hitVelocity = 280;
        tube.angularVel += (x > hangX ? 0.4 : -0.4);
        triggerTubeSound(i, hitVelocity, 'direct_touch', x, y);

        activePointerRef.current = {
          id: e.pointerId,
          startX: x,
          startY: y,
          prevX: x,
          prevY: y,
          lastTime: performance.now(),
          target: i,
        };
        canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // Swiping in empty space creates an ambient wind breeze!
    activePointerRef.current = {
      id: e.pointerId,
      startX: x,
      startY: y,
      prevX: x,
      prevY: y,
      lastTime: performance.now(),
      target: 'none',
    };
    canvas.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const active = activePointerRef.current;
    if (!active || active.id !== e.pointerId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = performance.now();
    const dt = Math.max(0.001, (now - active.lastTime) / 1000);

    const vx = (x - active.prevX) / dt;
    active.prevX = x;
    active.prevY = y;
    active.lastTime = now;

    const discCenterX = rect.width / 2;
    const discCenterY = rect.height * 0.18;

    if (active.target === 'sail') {
      // Pull sail towards finger
      const dx = x - discCenterX;
      const dy = Math.max(40, y - discCenterY);
      sailRef.current.angle = Math.atan2(dx, dy);
      sailRef.current.angularVel = vx * 0.003;
    } else if (active.target === 'clapper') {
      const dx = x - discCenterX;
      const dy = Math.max(30, y - discCenterY);
      clapperRef.current.angle = Math.atan2(dx, dy);
      clapperRef.current.angularVel = vx * 0.003;
    } else if (typeof active.target === 'number') {
      // Dragging a tube
      const tube = tubesRef.current[active.target];
      if (tube) {
        tube.angularVel = vx * 0.004;
      }
    } else if (active.target === 'none') {
      // Passing finger across tubes like a wind chime sweep!
      const scale = settings.chimeScale;
      const discRadiusX = 85 * scale;
      const discRadiusZ = 35 * scale;

      for (let i = 0; i < tubesRef.current.length; i++) {
        const tube = tubesRef.current[i];
        const baseAngle = (i * (Math.PI * 2)) / tubesRef.current.length;
        const hangX = discCenterX + Math.cos(baseAngle) * discRadiusX;
        const hangY = discCenterY + Math.sin(baseAngle) * discRadiusZ;
        const effLen = tube.length * scale;

        if (Math.abs(x - hangX) < 26 * scale && y >= hangY && y <= hangY + effLen) {
          const swipeVel = Math.min(650, Math.max(120, Math.abs(vx)));
          tube.angularVel += (vx > 0 ? 0.35 : -0.35);
          triggerTubeSound(i, swipeVel, 'direct_touch', x, y);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerRef.current?.id === e.pointerId) {
      sailRef.current.isDragging = false;
      clapperRef.current.isDragging = false;
      activePointerRef.current = null;
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
  };

  return (
    <div className="relative w-full h-full select-none touch-none overflow-hidden flex items-center justify-center">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />
    </div>
  );
};

/* --- RENDER PIPELINE HELPERS --- */

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  theme: string,
  time: number
) {
  if (theme === 'twilight') {
    // Deep calming midnight to indigo gradient
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0c1527');
    grad.addColorStop(0.6, '#132142');
    grad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle moonlit soft spotlight
    const spot = ctx.createRadialGradient(width * 0.5, height * 0.25, 10, width * 0.5, height * 0.25, width * 0.7);
    spot.addColorStop(0, 'rgba(56, 189, 248, 0.08)');
    spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(0, 0, width, height);
  } else if (theme === 'warm_sunset') {
    // Golden amber horizon
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#451a03');
    grad.addColorStop(0.4, '#78350f');
    grad.addColorStop(0.85, '#b45309');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(width * 0.5, height * 0.3, 20, width * 0.5, height * 0.3, width * 0.6);
    glow.addColorStop(0, 'rgba(254, 243, 199, 0.14)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  } else if (theme === 'high_contrast') {
    // Stark pure dark for visual acuity / low-vision support
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);
  } else {
    // 'garden': Soft sunlit porch / serene green sanctuary
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.5, '#065f46');
    grad.addColorStop(1, '#047857');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Dappled sunlight through leaves
    const sun = ctx.createRadialGradient(width * 0.5, height * 0.2, 40, width * 0.5, height * 0.2, width * 0.75);
    sun.addColorStop(0, 'rgba(254, 249, 195, 0.16)');
    sun.addColorStop(0.7, 'rgba(209, 250, 229, 0.06)');
    sun.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, width, height);
  }
}

function drawTopSuspension(
  ctx: CanvasRenderingContext2D,
  width: number,
  discX: number,
  discY: number,
  rx: number,
  ry: number
) {
  const topHookY = 16;

  // Hanging Ring
  ctx.save();
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(discX, topHookY, 12, 0, Math.PI * 2);
  ctx.stroke();

  // Braided Suspension Strings from Ring to Disc Rim
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.75)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  // 3 suspension strings
  ctx.moveTo(discX, topHookY + 12);
  ctx.lineTo(discX - rx * 0.75, discY - 2);

  ctx.moveTo(discX, topHookY + 12);
  ctx.lineTo(discX + rx * 0.75, discY - 2);

  ctx.moveTo(discX, topHookY + 12);
  ctx.lineTo(discX, discY - ry * 0.6);
  ctx.stroke();
  ctx.restore();
}

function drawTopDisc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  theme: string
) {
  ctx.save();

  // Cast drop shadow below disc
  ctx.beginPath();
  ctx.ellipse(cx, cy + 12, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fill();

  // Disc Body (Rich Teak / Walnut Wood)
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  const woodGrad = ctx.createRadialGradient(cx, cy - ry * 0.4, 5, cx, cy, rx);
  woodGrad.addColorStop(0, '#b45309');
  woodGrad.addColorStop(0.5, '#78350f');
  woodGrad.addColorStop(0.9, '#451a03');
  woodGrad.addColorStop(1, '#290e02');
  ctx.fillStyle = woodGrad;
  ctx.fill();

  // Golden / Brass Outer Rim Bevel
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d97706';
  ctx.stroke();

  // Top Face Concentric Wood Rings
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(254, 215, 170, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx * 0.65, ry * 0.65, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Center Brass Grommet
  ctx.beginPath();
  ctx.ellipse(cx, cy, 7, 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#fef08a';
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

function drawChimeTube(
  ctx: CanvasRenderingContext2D,
  tube: {
    index: number;
    hangX: number;
    hangY: number;
    bottomX: number;
    bottomY: number;
    z: number;
    length: number;
    angle: number;
    hitTimer: number;
  },
  scale: number,
  theme: string
) {
  ctx.save();

  const tubeRadius = (13 + tube.z * 1.5) * scale;
  const isBack = tube.z < 0;

  // Suspension String from Top Disc to Tube Hanger Hole
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.65)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(tube.hangX, tube.hangY);
  ctx.lineTo(tube.hangX + Math.sin(tube.angle) * 22, tube.hangY + Math.cos(tube.angle) * 22);
  ctx.stroke();

  // Translate and rotate for tube body
  ctx.translate(tube.hangX, tube.hangY);
  ctx.rotate(tube.angle);

  const startY = 20;
  const tubeHeight = tube.length;

  // Ambient Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  // Metallic Cylinder Body (Brushed Anodized Bronze / Brass PBR gradient)
  const cylGrad = ctx.createLinearGradient(-tubeRadius, 0, tubeRadius, 0);
  if (theme === 'high_contrast') {
    // Silver / Chrome
    cylGrad.addColorStop(0, '#4b5563');
    cylGrad.addColorStop(0.35, '#f9fafb');
    cylGrad.addColorStop(0.7, '#9ca3af');
    cylGrad.addColorStop(1, '#374151');
  } else {
    // Warm Brushed Bronze
    const hitFlash = tube.hitTimer;
    if (hitFlash > 0.1) {
      cylGrad.addColorStop(0, '#b45309');
      cylGrad.addColorStop(0.25, '#fef08a');
      cylGrad.addColorStop(0.45, '#ffffff'); // bright highlight on strike
      cylGrad.addColorStop(0.75, '#fef08a');
      cylGrad.addColorStop(1, '#78350f');
    } else if (isBack) {
      // Darker back tubes for 3D depth
      cylGrad.addColorStop(0, '#5a2a07');
      cylGrad.addColorStop(0.35, '#a16207');
      cylGrad.addColorStop(0.7, '#713f12');
      cylGrad.addColorStop(1, '#3a1a03');
    } else {
      // Front tubes
      cylGrad.addColorStop(0, '#78350f');
      cylGrad.addColorStop(0.28, '#fef08a');
      cylGrad.addColorStop(0.45, '#ffffff'); // specular sheen
      cylGrad.addColorStop(0.72, '#ca8a04');
      cylGrad.addColorStop(1, '#451a03');
    }
  }

  // Draw Tube Rectangle
  ctx.fillStyle = cylGrad;
  ctx.beginPath();
  ctx.rect(-tubeRadius, startY, tubeRadius * 2, tubeHeight);
  ctx.fill();

  // Reset shadow for details
  ctx.shadowColor = 'transparent';

  // Drilled String Holes near top
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(-tubeRadius * 0.45, startY + 12, 2.5, 0, Math.PI * 2);
  ctx.arc(tubeRadius * 0.45, startY + 12, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Bottom Hollow Rim (3D ellipse showing tube thickness)
  ctx.beginPath();
  ctx.ellipse(0, startY + tubeHeight, tubeRadius, 4.5 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = cylGrad;
  ctx.fill();

  // Hollow Inner Cylinder Core (dark inner hole)
  ctx.beginPath();
  ctx.ellipse(0, startY + tubeHeight, tubeRadius * 0.78, 3.2 * scale, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1917';
  ctx.fill();

  ctx.restore();
}

function drawCenterAssembly(
  ctx: CanvasRenderingContext2D,
  discX: number,
  discY: number,
  clapper: { x: number; y: number; angle: number },
  sail: { x: number; y: number; angle: number },
  scale: number,
  theme: string
) {
  ctx.save();

  // 1. Central Braided String: Disc -> Clapper -> Sail
  ctx.strokeStyle = 'rgba(254, 243, 199, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(discX, discY);
  ctx.lineTo(clapper.x, clapper.y);
  ctx.lineTo(sail.x, sail.y);
  ctx.stroke();

  // 2. Draw Center Clapper (Striker Disc)
  ctx.save();
  ctx.translate(clapper.x, clapper.y);
  ctx.rotate(clapper.angle);

  const clapperR = 27 * scale;
  const clapperThickness = 12 * scale;

  // Clapper Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 3;

  // Clapper Wooden Disc
  ctx.beginPath();
  ctx.ellipse(0, 0, clapperR, clapperThickness, 0, 0, Math.PI * 2);
  const clapGrad = ctx.createRadialGradient(0, -3, 2, 0, 0, clapperR);
  clapGrad.addColorStop(0, '#b45309');
  clapGrad.addColorStop(0.6, '#78350f');
  clapGrad.addColorStop(1, '#451a03');
  ctx.fillStyle = clapGrad;
  ctx.fill();

  // Clapper Brass Edge Trim
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Center knot/hole
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 3. Draw Bottom Wind Sail (Paddle / Catcher)
  ctx.save();
  ctx.translate(sail.x, sail.y);
  ctx.rotate(sail.angle);

  const sailWidth = 34 * scale;
  const sailHeight = 65 * scale;

  // Sail Drop Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  // Sail Teardrop / Curved Wooden Blade
  ctx.beginPath();
  ctx.moveTo(0, 0); // top suspension point
  ctx.bezierCurveTo(-sailWidth * 0.8, sailHeight * 0.35, -sailWidth, sailHeight * 0.85, 0, sailHeight);
  ctx.bezierCurveTo(sailWidth, sailHeight * 0.85, sailWidth * 0.8, sailHeight * 0.35, 0, 0);
  ctx.closePath();

  const sailGrad = ctx.createLinearGradient(-sailWidth * 0.5, 0, sailWidth * 0.5, sailHeight);
  sailGrad.addColorStop(0, '#d97706');
  sailGrad.addColorStop(0.35, '#b45309');
  sailGrad.addColorStop(0.75, '#78350f');
  sailGrad.addColorStop(1, '#451a03');
  ctx.fillStyle = sailGrad;
  ctx.fill();

  // Wood Grain Carving Line
  ctx.strokeStyle = 'rgba(254, 215, 170, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(0, sailHeight - 8);
  ctx.stroke();

  // Top Knot Bead
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(0, 0, 4 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  ctx.restore();
}

function drawRipples(
  ctx: CanvasRenderingContext2D,
  ripples: Ripple[],
  dt: number
) {
  ctx.save();
  for (let i = ripples.length - 1; i >= 0; i--) {
    const r = ripples[i];
    r.radius += dt * 85;
    r.alpha -= dt * 0.9;

    if (r.alpha <= 0.01 || r.radius >= r.maxRadius) {
      ripples.splice(i, 1);
      continue;
    }

    ctx.strokeStyle = `${r.color}${Math.max(0, r.alpha)})`;
    ctx.lineWidth = 2.5 * r.alpha;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  dt: number
) {
  ctx.save();
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.wobble += dt * 1.8;
    p.x += (p.vx + Math.sin(p.wobble) * 0.5) * 60 * dt;
    p.y += (p.vy + Math.cos(p.wobble) * 0.3) * 60 * dt;

    if (p.x < -20) p.x = width + 10;
    if (p.x > width + 20) p.x = -10;
    if (p.y < -20) p.y = height + 10;
    if (p.y > height + 20) p.y = -10;

    // Glowing particle
    const partGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
    partGrad.addColorStop(0, `${p.color}${p.alpha})`);
    partGrad.addColorStop(1, `${p.color}0)`);
    ctx.fillStyle = partGrad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}


