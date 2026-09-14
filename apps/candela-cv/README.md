# Candela Computer Vision & Gaze Tracking Service

High-performance Python microservice powered by **OpenCV** and **Google MediaPipe Face Mesh & Iris Tracking** to provide real-time gaze estimation across Candela applications (Mobile, Web, TV).

## Features
- **Accurate Iris & Gaze Tracking**: Uses 478 MediaPipe face & iris landmarks to calculate normalized `(x, y)` screen coordinates.
- **WebSocket Streaming**: Low-latency bidirectional `/ws/gaze` endpoint accepting frame snapshots and emitting instant gaze coordinates.
- **Exponential Moving Average (EMA) Smoothing**: Eliminates jitter while preserving responsive pursuit interactions.
- **Zero Native C++ Dependencies on Frontend**: Eliminates Expo/React Native Gradle NDK compile issues.

## Setup & Running

### 1. Local Setup with Virtual Environment
```bash
cd apps/candela-cv
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Docker
```bash
docker build -t candela-cv .
docker run -p 8000:8000 candela-cv
```

## API Endpoints
- `GET /health` — Service health check.
- `WS /ws/gaze` — Real-time frame streaming (sends JPEG/PNG bytes or base64 string, receives `{ "x": float, "y": float, "faceLost": bool, "timestamp": int }`).
