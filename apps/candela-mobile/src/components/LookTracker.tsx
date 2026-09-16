import { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';
import Constants from 'expo-constants';
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

const hostIp = Constants.expoConfig?.hostUri?.split(':')[0] || 'localhost';
const LAN_CV_WS_URL = process.env.EXPO_PUBLIC_CV_URL || `ws://${hostIp}:8000/ws/gaze`;

const EMBEDDED_EYE_TRACKER_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<style>
  body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #000; }
  video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
  canvas { display: none; }
</style>
</head>
<body>
<video id="v" playsinline muted autoplay></video>
<canvas id="c"></canvas>
<script>
(function() {
  const video = document.getElementById('v');
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  function getMediaStream(constraints) {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return navigator.mediaDevices.getUserMedia(constraints);
    }
    const legacyGUM = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (legacyGUM) {
      return new Promise((resolve, reject) => {
        legacyGUM.call(navigator, constraints, resolve, reject);
      });
    }
    return Promise.reject(new Error('getUserMedia not supported on this device'));
  }

  function startCamera() {
    const constraintsList = [
      { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false }
    ];

    function tryNext(index) {
      if (index >= constraintsList.length) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ error: 'Front camera not available', faceLost: true }));
        }
        return;
      }
      getMediaStream(constraintsList[index])
        .then(stream => {
          video.srcObject = stream;
          video.play();
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ cameraReady: true, faceLost: false }));
          }
          requestAnimationFrame(trackLoop);
        })
        .catch(err => {
          tryNext(index + 1);
        });
    }

    tryNext(0);
  }

  startCamera();

  function trackLoop() {
    if (video.readyState >= 2) {
      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(video, 0, 0, 160, 120);
      const imgData = ctx.getImageData(0, 0, 160, 120);
      const data = imgData.data;
      
      let totalMass = 0;
      let sumX = 0;
      let sumY = 0;
      
      for (let y = 16; y < 75; y += 2) {
        for (let x = 16; x < 144; x += 2) {
          const idx = (y * 160 + x) * 4;
          const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
          if (brightness < 80) {
            const weight = 80 - brightness;
            totalMass += weight;
            sumX += x * weight;
            sumY += y * weight;
          }
        }
      }

      if (totalMass > 150) {
        const rawNormX = 1.0 - (sumX / totalMass) / 160;
        const rawNormY = (sumY / totalMass) / 120;
        
        const dx = (rawNormX - 0.5) * 3.2;
        const dy = (rawNormY - 0.36) * 3.6;

        const normX = Math.max(0.02, Math.min(0.98, 0.5 + dx * (1 + 0.5 * Math.abs(dx))));
        const normY = Math.max(0.02, Math.min(0.98, 0.5 + dy * (1 + 0.5 * Math.abs(dy))));

        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            x: normX,
            y: normY,
            faceLost: false
          }));
        }
      } else {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            faceLost: true
          }));
        }
      }
    }
    setTimeout(() => requestAnimationFrame(trackLoop), 30);
  }
})();
</script>
</body>
</html>
`;

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
  const socketRef = useRef<WebSocket | null>(null);
  const onFaceLostRef = useRef(onFaceLost);
  const lastLook = useRef<LookPoint | null>(null);
  const lastFaceAt = useRef(0);
  onFaceLostRef.current = onFaceLost;

  // Request camera permissions on mount
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

  // Connect to Python CV WebSocket Service if available on LAN
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
      ws = new WebSocket(LAN_CV_WS_URL);
      socketRef.current = ws;

      ws.onopen = () => {
        console.log('[LookTracker] Connected to Python CV service:', LAN_CV_WS_URL);
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
          // Ignore parse errors
        }
      };
    } catch {
      // Ignored
    }

    return () => {
      if (ws) ws.close();
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

  const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.cameraReady) {
        if (!readySent.current) {
          readySent.current = true;
          onReady();
        }
        return;
      }
      if (data.error) {
        onError(data.error);
        return;
      }
      const now = performance.now();
      if (data.faceLost) {
        if (!lastLook.current || now - lastFaceAt.current > LOOK_FACE_HOLD_MS) {
          sampleRef.current = { ...sampleRef.current, faceLost: true };
          onFaceLostRef.current(true);
        }
      } else if (typeof data.x === 'number' && typeof data.y === 'number') {
        lastFaceAt.current = now;
        const raw: LookPoint = { x: data.x, y: data.y };
        const norm = smoothLookNorm(lastLook.current, raw, 0.4);
        lastLook.current = norm;
        sampleRef.current = { x: norm.x, y: norm.y, faceLost: false };
        onFaceLostRef.current(false);
      }
    } catch {
      // Ignore parse errors
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.permissionBox}>
        <Text style={styles.permissionText}>Camera needed for eye tracking</Text>
        <Pressable
          style={styles.permissionButton}
          onPress={() => {
            void requestPermission();
          }}
        >
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.previewContainer}>
      <WebView
        source={{
          html: EMBEDDED_EYE_TRACKER_HTML,
          baseUrl: 'https://localhost',
        }}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaCapturePermissionGrantType="grant"
        onPermissionRequest={(request) => {
          request.grant(request.resources);
        }}
        onMessage={handleWebViewMessage}
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
    backgroundColor: '#000',
  },
  camera: {
    width: 112,
    height: 84,
    backgroundColor: '#000',
  },
  permissionBox: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 50,
    alignItems: 'center',
    gap: 6,
  },
  permissionText: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '600',
  },
  permissionButton: {
    backgroundColor: '#00e5ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  permissionButtonText: {
    color: '#090d16',
    fontSize: 11,
    fontWeight: '700',
  },
});
