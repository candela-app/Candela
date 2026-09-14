"""
Candela High-Accuracy Gaze Tracker
Combines MediaPipe 478 3D landmarks + Iris tracking + 3D SolvePnP Head Pose + 1€ Adaptive Filter + Calibration.
"""

from typing import Optional, Tuple, Dict, Any
import numpy as np
import cv2
import mediapipe as mp
import time
from one_euro_filter import PointOneEuroFilter
from calibration import GazeCalibrator

# Landmark indices from MediaPipe FaceMesh (with refine_landmarks=True)
LEFT_EYE_INNER = 133
LEFT_EYE_OUTER = 33
LEFT_EYE_TOP = 159
LEFT_EYE_BOTTOM = 145
LEFT_IRIS_CENTER = 468

RIGHT_EYE_INNER = 362
RIGHT_EYE_OUTER = 263
RIGHT_EYE_TOP = 386
RIGHT_EYE_BOTTOM = 374
RIGHT_IRIS_CENTER = 473

NOSE_TIP = 1
CHIN = 199
LEFT_MOUTH = 61
RIGHT_MOUTH = 291

# Standard 3D facial model points for OpenCV SolvePnP
MODEL_POINTS_3D = np.array(
    [
        (0.0, 0.0, 0.0),             # Nose tip
        (0.0, -330.0, -65.0),        # Chin
        (-225.0, 170.0, -135.0),     # Left eye corner
        (225.0, 170.0, -135.0),      # Right eye corner
        (-150.0, -150.0, -125.0),    # Left mouth corner
        (150.0, -150.0, -125.0),     # Right mouth corner
    ],
    dtype=np.float64,
)


class HighAccuracyGazeTracker:
    def __init__(
        self,
        min_cutoff: float = 0.8,
        beta: float = 0.02,
        face_hold_sec: float = 0.35,
        min_detection_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
    ):
        self.face_hold_sec = face_hold_sec
        self.last_look: Optional[Tuple[float, float]] = None
        self.last_face_time = 0.0
        self.last_raw_features: Optional[np.ndarray] = None

        # 1€ Adaptive speed filter
        self.one_euro_filter = PointOneEuroFilter(min_cutoff=min_cutoff, beta=beta)

        # Screen Gaze Calibrator
        self.calibrator = GazeCalibrator()

        # Initialize MediaPipe Face Mesh
        self.mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence,
        )

    def _estimate_head_pose_pnp(
        self, landmarks, img_w: int, img_h: int
    ) -> Tuple[float, float, float]:
        """Calculates 3D Head Pose (Yaw, Pitch, Roll) using OpenCV SolvePnP."""
        image_points = np.array(
            [
                (landmarks[NOSE_TIP].x * img_w, landmarks[NOSE_TIP].y * img_h),
                (landmarks[CHIN].x * img_w, landmarks[CHIN].y * img_h),
                (landmarks[LEFT_EYE_OUTER].x * img_w, landmarks[LEFT_EYE_OUTER].y * img_h),
                (landmarks[RIGHT_EYE_OUTER].x * img_w, landmarks[RIGHT_EYE_OUTER].y * img_h),
                (landmarks[LEFT_MOUTH].x * img_w, landmarks[LEFT_MOUTH].y * img_h),
                (landmarks[RIGHT_MOUTH].x * img_w, landmarks[RIGHT_MOUTH].y * img_h),
            ],
            dtype=np.float64,
        )

        focal_length = img_w
        center = (img_w / 2.0, img_h / 2.0)
        camera_matrix = np.array(
            [[focal_length, 0, center[0]], [0, focal_length, center[1]], [0, 0, 1]],
            dtype=np.float64,
        )
        dist_coeffs = np.zeros((4, 1), dtype=np.float64)

        success, rvec, _ = cv2.solvePnP(
            MODEL_POINTS_3D,
            image_points,
            camera_matrix,
            dist_coeffs,
            flags=cv2.SOLVEPNP_ITERATIVE,
        )

        if not success:
            return 0.0, 0.0, 0.0

        rmat, _ = cv2.Rodrigues(rvec)
        angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
        pitch = angles[0]
        yaw = angles[1]
        roll = angles[2]
        return yaw, pitch, roll

    def _estimate_iris_ratio(
        self, landmarks, inner_idx: int, outer_idx: int, iris_idx: int
    ) -> float:
        inner = landmarks[inner_idx]
        outer = landmarks[outer_idx]
        iris = landmarks[iris_idx]

        total_width = abs(outer.x - inner.x)
        if total_width < 1e-5:
            return 0.5
        ratio = (iris.x - min(inner.x, outer.x)) / total_width
        return float(np.clip(ratio, 0.0, 1.0))

    def _estimate_vertical_ratio(
        self, landmarks, top_idx: int, bottom_idx: int, iris_idx: int
    ) -> float:
        top = landmarks[top_idx]
        bottom = landmarks[bottom_idx]
        iris = landmarks[iris_idx]

        total_height = abs(bottom.y - top.y)
        if total_height < 1e-5:
            return 0.5
        ratio = (iris.y - min(top.y, bottom.y)) / total_height
        return float(np.clip(ratio, 0.0, 1.0))

    def process_frame(self, image_bgr: np.ndarray, timestamp: Optional[float] = None) -> Dict[str, Any]:
        """
        Processes camera frame and returns high-accuracy normalized gaze coordinates (x, y).
        """
        now = timestamp if timestamp is not None else time.time()
        img_h, img_w, _ = image_bgr.shape
        image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(image_rgb)

        if not results.multi_face_landmarks:
            if self.last_look is None or (now - self.last_face_time) > self.face_hold_sec:
                return {
                    "x": self.last_look[0] if self.last_look else 0.5,
                    "y": self.last_look[1] if self.last_look else 0.5,
                    "face_lost": True,
                    "landmarks_detected": False,
                    "calibrated": self.calibrator.calibrated,
                }
            return {
                "x": self.last_look[0],
                "y": self.last_look[1],
                "face_lost": False,
                "landmarks_detected": False,
                "calibrated": self.calibrator.calibrated,
            }

        self.last_face_time = now
        landmarks = results.multi_face_landmarks[0].landmark

        # Iris Tracking
        if len(landmarks) >= 478:
            left_ratio_x = self._estimate_iris_ratio(
                landmarks, LEFT_EYE_INNER, LEFT_EYE_OUTER, LEFT_IRIS_CENTER
            )
            right_ratio_x = self._estimate_iris_ratio(
                landmarks, RIGHT_EYE_INNER, RIGHT_EYE_OUTER, RIGHT_IRIS_CENTER
            )
            left_ratio_y = self._estimate_vertical_ratio(
                landmarks, LEFT_EYE_TOP, LEFT_EYE_BOTTOM, LEFT_IRIS_CENTER
            )
            right_ratio_y = self._estimate_vertical_ratio(
                landmarks, RIGHT_EYE_TOP, RIGHT_EYE_BOTTOM, RIGHT_IRIS_CENTER
            )

            iris_x = (left_ratio_x + right_ratio_x) / 2.0
            iris_y = (left_ratio_y + right_ratio_y) / 2.0
        else:
            iris_x, iris_y = 0.5, 0.5
            left_ratio_x, right_ratio_x = 0.5, 0.5

        # 3D Head Pose via SolvePnP
        yaw_deg, pitch_deg, _ = self._estimate_head_pose_pnp(landmarks, img_w, img_h)
        yaw_norm = yaw_deg / 45.0  # normalize ~[-1, 1]
        pitch_norm = pitch_deg / 45.0

        # Uncalibrated baseline coordinates
        # Mirrored horizontal axis for natural front-camera feedback
        raw_x = 1.0 - (iris_x * 0.7 + 0.5 + yaw_norm * 0.4)
        raw_y = iris_y * 0.7 + 0.5 + pitch_norm * 0.4

        raw_x = float(np.clip(raw_x, 0.0, 1.0))
        raw_y = float(np.clip(raw_y, 0.0, 1.0))

        # Store feature vector for calibration mapping
        raw_features = np.array(
            [raw_x, raw_y, yaw_norm, pitch_norm, left_ratio_x, right_ratio_x],
            dtype=np.float64,
        )
        self.last_raw_features = raw_features

        # Apply calibration if calibrated
        if self.calibrator.calibrated:
            mapped_x, mapped_y = self.calibrator.predict(raw_features)
        else:
            mapped_x, mapped_y = raw_x, raw_y

        # Apply 1€ Adaptive Speed Filter
        smooth_x, smooth_y = self.one_euro_filter.filter(mapped_x, mapped_y, timestamp=now)
        smooth_x = float(np.clip(smooth_x, 0.0, 1.0))
        smooth_y = float(np.clip(smooth_y, 0.0, 1.0))

        self.last_look = (smooth_x, smooth_y)

        return {
            "x": round(smooth_x, 4),
            "y": round(smooth_y, 4),
            "face_lost": False,
            "landmarks_detected": True,
            "calibrated": self.calibrator.calibrated,
            "yaw": round(yaw_deg, 2),
            "pitch": round(pitch_deg, 2),
        }

    def add_calibration_sample(self, target_x: float, target_y: float) -> bool:
        """Records current gaze features looking at target dot (target_x, target_y)."""
        if self.last_raw_features is None:
            return False
        self.calibrator.add_sample(self.last_raw_features, (target_x, target_y))
        return True

    def fit_calibration(self) -> bool:
        """Trains the calibration model with recorded points."""
        return self.calibrator.fit()

    def reset_calibration(self):
        """Clears calibration data."""
        self.calibrator.reset()

    def reset(self):
        self.last_look = None
        self.last_face_time = 0.0
        self.last_raw_features = None
        self.one_euro_filter.reset()
