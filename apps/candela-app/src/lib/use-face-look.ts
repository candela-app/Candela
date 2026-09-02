'use client';

import { useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import {
  LOOK_FACE_HOLD_MS,
  LOOK_SMOOTH_ALPHA,
  lookNormFromWebEyePog,
  smoothLookNorm,
  type LookSample,
} from '@candela/shared';

const LOOK_TRACKER_MAX_POINTS = 9;
const LOOK_TRACKER_CLICK_TTL_SEC = 600;
const LOOK_CAM_VIDEO_ID = 'look-pursuit-cam';
const LOOK_SMOOTH = Math.min(0.22, LOOK_SMOOTH_ALPHA);

function stopCameraStream(video: HTMLVideoElement | null, stream: MediaStream | null): void {
  const fromVideo = video?.srcObject instanceof MediaStream ? video.srcObject : null;
  [stream, fromVideo].forEach((media) => {
    media?.getTracks().forEach((track) => track.stop());
  });
  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): ImageData | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (width < 2 || height < 2) {
    return null;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.drawImage(video, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

export function useFaceLook(active: boolean): {
  sampleRef: MutableRefObject<LookSample>;
  videoRef: RefObject<HTMLVideoElement>;
  ready: boolean;
  error: string | null;
  cursor: { x: number; y: number } | null;
  faceLost: boolean;
} {
  const sampleRef = useRef<LookSample>({ x: 0.5, y: 0.5, faceLost: true });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [faceLost, setFaceLost] = useState(true);

  useEffect(() => {
    if (!active) {
      return;
    }
    let cancelled = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let busy = false;
    let lastFaceAt = 0;
    let lastLook: { x: number; y: number } | null = null;

    async function start(): Promise<void> {
      try {
        const { WebEyeTrack } = await import('webeyetrack');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stopCameraStream(videoRef.current, stream);
          return;
        }
        const video = videoRef.current;
        if (!video) {
          throw new Error('Camera view missing');
        }
        if (!video.id) {
          video.id = LOOK_CAM_VIDEO_ID;
        }
        video.srcObject = stream;
        await video.play();
        const tracker = new WebEyeTrack(LOOK_TRACKER_MAX_POINTS, LOOK_TRACKER_CLICK_TTL_SEC);
        await (tracker as { initialize: (baseUrl?: string) => Promise<void> }).initialize(
          window.location.origin,
        );
        if (cancelled) {
          stopCameraStream(video, stream);
          return;
        }
        const canvas = document.createElement('canvas');
        setReady(true);
        const loop = (): void => {
          if (cancelled || !videoRef.current) {
            return;
          }
          const videoEl = videoRef.current;
          if (!busy && videoEl.readyState >= 2) {
            const frame = grabFrame(videoEl, canvas);
            if (frame) {
              busy = true;
              void tracker
                .step(frame, performance.now())
                .then((result) => {
                  if (cancelled) {
                    return;
                  }
                  const now = performance.now();
                  const hasFace = result.facialLandmarks.length > 0;
                  if (!hasFace) {
                    if (!lastLook || now - lastFaceAt > LOOK_FACE_HOLD_MS) {
                      sampleRef.current = { x: sampleRef.current.x, y: sampleRef.current.y, faceLost: true };
                      setFaceLost(true);
                      setCursor(null);
                    }
                    return;
                  }
                  lastFaceAt = now;
                  const raw = lookNormFromWebEyePog(result.normPog[0], result.normPog[1]);
                  const norm = smoothLookNorm(lastLook, raw, LOOK_SMOOTH);
                  lastLook = norm;
                  sampleRef.current = { x: norm.x, y: norm.y, faceLost: false };
                  setFaceLost(false);
                  setCursor(norm);
                })
                .catch(() => {
                  if (!cancelled) {
                    sampleRef.current = { ...sampleRef.current, faceLost: true };
                    setFaceLost(true);
                    setCursor(null);
                    lastLook = null;
                  }
                })
                .finally(() => {
                  busy = false;
                });
            }
          }
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gaze tracker unavailable');
        }
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stopCameraStream(videoRef.current, stream);
    };
  }, [active]);

  return { sampleRef, videoRef, ready, error, cursor, faceLost };
}
