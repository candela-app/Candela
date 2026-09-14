import { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  LOOK_FACE_HOLD_MS,
  LOOK_SMOOTH_ALPHA,
  smoothLookNorm,
  type LookPoint,
  type LookSample,
} from '@candela/shared/rn';

type LookTrackerProps = {
  sampleRef: { current: LookSample };
  onReady: () => void;
  onError: (message: string) => void;
  onFaceLost: (lost: boolean) => void;
  active?: boolean;
};

const DEFAULT_CV_WS_URL = process.env.EXPO_PUBLIC_CV_URL || 'ws://localhost:8000/ws/gaze';

export function LookTracker({
  sampleRef,
  onReady,
  onError,
  onFaceLost,
  active = true,
}: LookTrackerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const asked = useRef(false);
  const readySent = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const onFaceLostRef = useRef(onFaceLost);
  const lastLook = useRef<LookPoint | null>(null);
  const lastFaceAt = useRef(0);
  onFaceLostRef.current = onFaceLost;

  // Request camera permissions
  useEffect(() => {
    if (asked.current || !permission) return;
    asked.current = true;
    if (!permission.granted) {
      void requestPermission().then((next) => {
        if (!next.granted) {
          onError('Camera permission denied');
        }
      });
    }
  }, [permission, requestPermission, onError]);

  // Connect to Python CV WebSocket Service
  useEffect(() => {
    if (!active) {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      return;
    }

    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(DEFAULT_CV_WS_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[LookTracker] Connected to Python CV service:', DEFAULT_CV_WS_URL);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now = performance.now();
          if (data.faceLost) {
            if (!lastLook.current || now - lastFaceAt.current > LOOK_FACE_HOLD_MS) {
              sampleRef.current = { ...sampleRef.current, faceLost: true };
              onFaceLostRef.current(true);
            }
          } else if (typeof data.x === 'number' && typeof data.y === 'number') {
            lastFaceAt.current = now;
            const raw: LookPoint = { x: data.x, y: data.y };
            const norm = smoothLookNorm(lastLook.current, raw, LOOK_SMOOTH_ALPHA);
            lastLook.current = norm;
            sampleRef.current = { x: norm.x, y: norm.y, faceLost: false };
            onFaceLostRef.current(false);
          }
        } catch {
          // Ignore JSON parse errors
        }
      };

      ws.onerror = () => {
        // Fallback gracefully if CV service is not running locally during development
        console.warn('[LookTracker] Python CV service not reachable at', DEFAULT_CV_WS_URL);
      };
    } catch {
      // Ignored
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [active, sampleRef]);

  // Trigger onReady once permission is granted
  useEffect(() => {
    if (!permission?.granted || readySent.current) {
      return;
    }
    readySent.current = true;
    onReady();
  }, [permission?.granted, onReady]);

  if (!permission?.granted) {
    return null;
  }

  return (
    <View style={styles.previewContainer}>
      <CameraView
        ref={cameraRef}
        facing="front"
        style={styles.camera}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  previewContainer: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    width: 112,
    height: 84,
    borderRadius: 12,
    overflow: 'hidden',
    zIndex: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  camera: {
    width: 112,
    height: 84,
  },
});
