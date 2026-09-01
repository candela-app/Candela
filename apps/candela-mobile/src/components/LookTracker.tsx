import { useEffect, useRef } from 'react';
import { NativeModules, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { lookNormFromFaceBounds, type LookSample } from '@candela/shared/rn';
import { useLayout } from '../lib/layout';

function visionNativeAvailable(): boolean {
  const names = Object.keys(NativeModules);
  return names.some((name) => /visioncamera/i.test(name));
}

export function LookTracker({
  sampleRef,
  onReady,
  onError,
  onFaceLost,
}: {
  sampleRef: { current: LookSample };
  onReady: () => void;
  onError: (message: string) => void;
  onFaceLost: (lost: boolean) => void;
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

  if (!permission?.granted) {
    return null;
  }

  if (visionNativeAvailable()) {
    return (
      <NativeLookTracker sampleRef={sampleRef} onReady={onReady} onFaceLost={onFaceLost} />
    );
  }

  return <ExpoLookPreview onReady={onReady} onError={onError} />;
}

function ExpoLookPreview({
  onReady,
  onError,
}: {
  onReady: () => void;
  onError: (message: string) => void;
}) {
  useEffect(() => {
    onReady();
    onError('Look tracking needs the Kandela APK (Expo Go cannot run ML Kit).');
  }, [onReady, onError]);

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
  onFaceLost,
}: {
  sampleRef: { current: LookSample };
  onReady: () => void;
  onFaceLost: (lost: boolean) => void;
}) {
  const { width, height } = useLayout();
  const readySent = useRef(false);
  const cameraRef = useRef(null);
  const { useCameraDevice } = require('react-native-vision-camera') as typeof import('react-native-vision-camera');
  const { Camera } = require('react-native-vision-camera-face-detector') as typeof import('react-native-vision-camera-face-detector');
  const device = useCameraDevice('front');

  useEffect(() => {
    if (!readySent.current) {
      readySent.current = true;
      onReady();
    }
  }, [onReady]);

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
        isActive
        style={{ width: 112, height: 84 }}
        faceDetectionOptions={{
          performanceMode: 'fast',
          landmarkMode: 'all',
          cameraFacing: 'front',
          autoMode: true,
          windowWidth: width,
          windowHeight: height,
        }}
        faceDetectionCallback={(faces, frame) => {
          if (!faces[0]) {
            sampleRef.current = { ...sampleRef.current, faceLost: true };
            onFaceLost(true);
            return;
          }
          const bounds = faces[0].bounds;
          const norm = lookNormFromFaceBounds(
            bounds.x,
            bounds.y,
            bounds.width,
            bounds.height,
            frame.width,
            frame.height,
          );
          sampleRef.current = { x: norm.x, y: norm.y, faceLost: false };
          onFaceLost(false);
        }}
      />
    </View>
  );
}
