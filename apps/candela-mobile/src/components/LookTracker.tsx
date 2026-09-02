import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  LOOK_FACE_HOLD_MS,
  LOOK_SMOOTH_ALPHA,
  lookNormFromMlKitEulerDeg,
  smoothLookNorm,
  type LookPoint,
  type LookSample,
} from '@candela/shared/rn';

function isExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

type LookTrackerProps = {
  sampleRef: { current: LookSample };
  onReady: () => void;
  onError: (message: string) => void;
  onFaceLost: (lost: boolean) => void;
  active?: boolean;
};

export function LookTracker({
  sampleRef,
  onReady,
  onError,
  onFaceLost,
  active = true,
}: LookTrackerProps) {
  if (isExpoGo()) {
    return <ExpoLookPreview onReady={onReady} onError={onError} />;
  }
  return (
    <NativeLookTracker
      sampleRef={sampleRef}
      onReady={onReady}
      onError={onError}
      onFaceLost={onFaceLost}
      active={active}
    />
  );
}

function ExpoLookPreview({
  onReady,
  onError,
}: {
  onReady: () => void;
  onError: (message: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current || !permission) {
      return;
    }
    asked.current = true;
    if (!permission.granted) {
      void requestPermission().then((next) => {
        if (!next.granted) {
          onError('Camera permission denied');
        }
      });
    }
  }, [permission, requestPermission, onError]);

  useEffect(() => {
    if (!permission?.granted) {
      return;
    }
    onReady();
    onError('Look tracking needs the Kandela APK (Expo Go cannot run ML Kit).');
  }, [onReady, onError, permission?.granted]);

  if (!permission?.granted) {
    return null;
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        width: 112,
        height: 84,
        borderRadius: 12,
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      <CameraView facing="front" style={{ width: 112, height: 84 }} />
    </View>
  );
}

function NativeLookTracker({
  sampleRef,
  onReady,
  onError,
  onFaceLost,
  active = true,
}: LookTrackerProps) {
  const vision = require('react-native-vision-camera') as typeof import('react-native-vision-camera');
  const detector = require('react-native-vision-camera-face-detector') as typeof import('react-native-vision-camera-face-detector');
  const { Camera: VisionCamera, useCameraDevice } = vision;
  const { Camera } = detector;
  const device = useCameraDevice('front');
  const [permission, setPermission] = useState(() => VisionCamera.getCameraPermissionStatus());
  const readySent = useRef(false);
  const cameraRef = useRef(null);
  const onFaceLostRef = useRef(onFaceLost);
  const lastFaceAt = useRef(0);
  const lastLook = useRef<LookPoint | null>(null);
  onFaceLostRef.current = onFaceLost;

  const faceDetectionOptions = useRef({
    performanceMode: 'fast' as const,
    landmarkMode: 'none' as const,
    contourMode: 'none' as const,
    classificationMode: 'none' as const,
    minFaceSize: 0.08,
    trackingEnabled: true,
    cameraFacing: 'front' as const,
    autoMode: false,
  }).current;

  useEffect(() => {
    if (permission === 'granted') {
      return;
    }
    let cancelled = false;
    void VisionCamera.requestCameraPermission()
      .then((status) => {
        if (cancelled) return;
        setPermission(status);
        if (status !== 'granted') {
          onError('Camera permission denied');
        }
      })
      .catch(() => {
        if (!cancelled) {
          onError('Camera permission denied');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [VisionCamera, onError, permission]);

  useEffect(() => {
    if (permission !== 'granted') {
      return;
    }
    if (device) {
      return;
    }
    const timer = setTimeout(() => {
      onError('No front camera found');
    }, 2500);
    return () => clearTimeout(timer);
  }, [device, onError, permission]);

  useEffect(() => {
    if (permission !== 'granted' || !device || readySent.current) {
      return;
    }
    readySent.current = true;
    onReady();
  }, [device, onReady, permission]);

  const onFaces = useCallback(
    (faces: { yawAngle: number; pitchAngle: number }[]) => {
      const now = performance.now();
      const face = faces[0];
      if (!face) {
        if (!lastLook.current || now - lastFaceAt.current > LOOK_FACE_HOLD_MS) {
          sampleRef.current = { ...sampleRef.current, faceLost: true };
          onFaceLostRef.current(true);
        }
        return;
      }
      lastFaceAt.current = now;
      const raw = lookNormFromMlKitEulerDeg(face.yawAngle, face.pitchAngle);
      const norm = smoothLookNorm(lastLook.current, raw, LOOK_SMOOTH_ALPHA);
      lastLook.current = norm;
      sampleRef.current = { x: norm.x, y: norm.y, faceLost: false };
      onFaceLostRef.current(false);
    },
    [sampleRef],
  );

  if (permission !== 'granted') {
    return null;
  }

  if (!device) {
    return null;
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        width: 112,
        height: 84,
        borderRadius: 12,
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      <Camera
        ref={cameraRef}
        device={device}
        isActive={active}
        pixelFormat="yuv"
        style={{ width: 112, height: 84 }}
        faceDetectionOptions={faceDetectionOptions}
        faceDetectionCallback={onFaces}
        onError={(err) => onError(err.message || 'Camera failed')}
      />
    </View>
  );
}
