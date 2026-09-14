"""
1€ (One Euro) Filter for Real-time Signal Smoothing
Paper: Casiez et al., "1 € Filter: A Simple Speed-based Low-pass Filter for Noisy Input in Human-Computer Interaction" (CHI 2012)
Eliminates jitter at low speeds (fixation) and provides zero-lag at high speeds (pursuit).
"""

import math
import time


class LowPassFilter:
    def __init__(self, alpha: float = 0.5):
        self.alpha = alpha
        self.last_val = None

    def filter(self, val: float, alpha: float = None) -> float:
        if alpha is not None:
            self.alpha = alpha
        if self.last_val is None:
            self.last_val = val
            return val
        filtered = self.alpha * val + (1.0 - self.alpha) * self.last_val
        self.last_val = filtered
        return filtered

    def reset(self):
        self.last_val = None


class OneEuroFilter:
    def __init__(
        self,
        min_cutoff: float = 1.0,
        beta: float = 0.007,
        d_cutoff: float = 1.0,
    ):
        """
        :param min_cutoff: Minimum cutoff frequency in Hz (higher = less lag, lower = smoother during slow movement)
        :param beta: Speed coefficient (higher = faster response to quick eye movements)
        :param d_cutoff: Derivative cutoff frequency in Hz
        """
        self.min_cutoff = min_cutoff
        self.beta = beta
        self.d_cutoff = d_cutoff

        self.x_filter = LowPassFilter()
        self.dx_filter = LowPassFilter()
        self.last_time = None

    def _alpha(self, rate: float, cutoff: float) -> float:
        tau = 1.0 / (2.0 * math.pi * cutoff)
        te = 1.0 / rate
        return 1.0 / (1.0 + tau / te)

    def filter(self, val: float, timestamp: float = None) -> float:
        if timestamp is None:
            timestamp = time.time()

        if self.last_time is None:
            self.last_time = timestamp
            return self.x_filter.filter(val)

        dt = timestamp - self.last_time
        self.last_time = timestamp

        if dt <= 0.0:
            return self.x_filter.last_val if self.x_filter.last_val is not None else val

        rate = 1.0 / dt

        # Estimate derivative of the signal
        prev_val = self.x_filter.last_val if self.x_filter.last_val is not None else val
        dx = (val - prev_val) * rate
        edx = self.dx_filter.filter(dx, self._alpha(rate, self.d_cutoff))

        # Dynamic cutoff frequency based on movement speed
        cutoff = self.min_cutoff + self.beta * abs(edx)
        return self.x_filter.filter(val, self._alpha(rate, cutoff))

    def reset(self):
        self.x_filter.reset()
        self.dx_filter.reset()
        self.last_time = None


class PointOneEuroFilter:
    """Applies 1€ filter to 2D (x, y) gaze coordinates."""

    def __init__(
        self,
        min_cutoff: float = 0.8,
        beta: float = 0.02,
        d_cutoff: float = 1.0,
    ):
        self.filter_x = OneEuroFilter(min_cutoff=min_cutoff, beta=beta, d_cutoff=d_cutoff)
        self.filter_y = OneEuroFilter(min_cutoff=min_cutoff, beta=beta, d_cutoff=d_cutoff)

    def filter(self, x: float, y: float, timestamp: float = None) -> tuple[float, float]:
        fx = self.filter_x.filter(x, timestamp)
        fy = self.filter_y.filter(y, timestamp)
        return fx, fy

    def reset(self):
        self.filter_x.reset()
        self.filter_y.reset()
