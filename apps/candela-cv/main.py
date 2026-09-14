"""
Candela High-Accuracy Computer Vision & Gaze Tracking Service
FastAPI + WebSockets + Calibration + 1€ Filter
"""

import base64
import json
import time
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from gaze_tracker import HighAccuracyGazeTracker

app = FastAPI(
    title="Candela High-Accuracy CV Service",
    description="Real-time High Accuracy Gaze Tracking microservice with 3D SolvePnP, 1€ Filter, and Calibration.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "candela-cv", "version": "2.0.0", "timestamp": time.time()}


def decode_image_bytes(data: bytes) -> np.ndarray:
    """Decodes raw binary bytes or base64 into a BGR OpenCV image."""
    if data.startswith(b"data:image") or b";base64," in data:
        _, base64_str = data.split(b";base64,")
        raw_bytes = base64.b64decode(base64_str)
    else:
        try:
            raw_bytes = base64.b64decode(data, validate=True)
        except Exception:
            raw_bytes = data

    np_arr = np.frombuffer(raw_bytes, np.uint8)
    image = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image from provided data")
    return image


@app.websocket("/ws/gaze")
async def websocket_gaze_endpoint(websocket: WebSocket):
    await websocket.accept()
    tracker = HighAccuracyGazeTracker()
    try:
        while True:
            message = await websocket.receive()

            # Handle JSON command packets (e.g. calibration control)
            if "text" in message and message["text"]:
                text_content = message["text"].strip()
                if text_content.startswith("{") and text_content.endswith("}"):
                    try:
                        cmd = json.loads(text_content)
                        msg_type = cmd.get("type")

                        if msg_type == "calibrate_sample":
                            tx = float(cmd.get("target_x", 0.5))
                            ty = float(cmd.get("target_y", 0.5))
                            success = tracker.add_calibration_sample(tx, ty)
                            await websocket.send_json({"type": "calibration_sample_added", "success": success})
                            continue

                        elif msg_type == "calibrate_finish":
                            success = tracker.fit_calibration()
                            await websocket.send_json({"type": "calibration_finished", "calibrated": success})
                            continue

                        elif msg_type == "calibrate_reset":
                            tracker.reset_calibration()
                            await websocket.send_json({"type": "calibration_reset", "calibrated": False})
                            continue

                        elif "image" in cmd or "frame" in cmd:
                            # Base64 image wrapped in JSON
                            raw_img_b64 = cmd.get("image") or cmd.get("frame")
                            data = raw_img_b64.encode("utf-8")
                        else:
                            data = text_content.encode("utf-8")
                    except Exception:
                        data = text_content.encode("utf-8")
                else:
                    data = text_content.encode("utf-8")
            elif "bytes" in message and message["bytes"]:
                data = message["bytes"]
            else:
                continue

            try:
                img = decode_image_bytes(data)
                result = tracker.process_frame(img)
                response = {
                    "type": "gaze",
                    "x": result["x"],
                    "y": result["y"],
                    "faceLost": result["face_lost"],
                    "landmarksDetected": result["landmarks_detected"],
                    "calibrated": result["calibrated"],
                    "yaw": result.get("yaw", 0.0),
                    "pitch": result.get("pitch", 0.0),
                    "timestamp": int(time.time() * 1000),
                }
                await websocket.send_json(response)
            except Exception as ex:
                await websocket.send_json(
                    {
                        "type": "gaze",
                        "error": str(ex),
                        "x": 0.5,
                        "y": 0.5,
                        "faceLost": True,
                        "timestamp": int(time.time() * 1000),
                    }
                )
    except WebSocketDisconnect:
        tracker.reset()
    except Exception:
        tracker.reset()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
