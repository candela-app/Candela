"""
Screen Gaze Calibration Module
Fits a Ridge-regularized Polynomial Regression model to map raw gaze & head features to exact screen pixels.
"""

from typing import List, Tuple, Optional
import numpy as np


class GazeCalibrator:
    def __init__(self, ridge_lambda: float = 1e-3):
        self.ridge_lambda = ridge_lambda
        self.calibrated = False
        self.model_x: Optional[np.ndarray] = None
        self.model_y: Optional[np.ndarray] = None
        self.samples: List[Tuple[np.ndarray, Tuple[float, float]]] = []

    def _extract_polynomial_features(self, feat: np.ndarray) -> np.ndarray:
        """
        Input feature vector: [raw_x, raw_y, yaw, pitch, left_iris_ratio, right_iris_ratio]
        Output: polynomial expansion [1, x, y, x^2, y^2, xy, yaw, pitch, ...]
        """
        gx, gy = feat[0], feat[1]
        yaw = feat[2] if len(feat) > 2 else 0.0
        pitch = feat[3] if len(feat) > 3 else 0.0

        return np.array(
            [
                1.0,
                gx,
                gy,
                gx * gx,
                gy * gy,
                gx * gy,
                yaw,
                pitch,
                gx * yaw,
                gy * pitch,
            ],
            dtype=np.float64,
        )

    def add_sample(self, raw_features: np.ndarray, target_screen_point: Tuple[float, float]):
        """Adds a calibration observation point (e.g. user looking at target dot [target_x, target_y])."""
        poly_feat = self._extract_polynomial_features(raw_features)
        self.samples.append((poly_feat, target_screen_point))

    def fit(self) -> bool:
        """Computes the regression weights using closed-form Ridge Regression."""
        if len(self.samples) < 4:
            self.calibrated = False
            return False

        X = np.array([s[0] for s in self.samples], dtype=np.float64)  # (N, D)
        y_x = np.array([s[1][0] for s in self.samples], dtype=np.float64)  # (N,)
        y_y = np.array([s[1][1] for s in self.samples], dtype=np.float64)  # (N,)

        D = X.shape[1]
        # (X^T * X + lambda * I)^(-1) * X^T * y
        reg = self.ridge_lambda * np.eye(D)
        XtX = X.T @ X + reg
        Xt = X.T

        try:
            self.model_x = np.linalg.solve(XtX, Xt @ y_x)
            self.model_y = np.linalg.solve(XtX, Xt @ y_y)
            self.calibrated = True
            return True
        except np.linalg.LinAlgError:
            self.calibrated = False
            return False

    def predict(self, raw_features: np.ndarray) -> Tuple[float, float]:
        """Maps raw gaze features to calibrated screen (x, y) coordinates."""
        if not self.calibrated or self.model_x is None or self.model_y is None:
            # Fallback to uncalibrated normalized coordinates
            return float(raw_features[0]), float(raw_features[1])

        poly_feat = self._extract_polynomial_features(raw_features)
        pred_x = float(np.dot(poly_feat, self.model_x))
        pred_y = float(np.dot(poly_feat, self.model_y))

        # Clamp to screen boundaries
        pred_x = float(np.clip(pred_x, 0.0, 1.0))
        pred_y = float(np.clip(pred_y, 0.0, 1.0))
        return pred_x, pred_y

    def reset(self):
        self.samples.clear()
        self.model_x = None
        self.model_y = None
        self.calibrated = False
