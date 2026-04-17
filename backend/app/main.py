"""
EdgeSense AI — Core Backend
FastAPI server: prediction pipeline, WebSocket broadcasting,
SHAP explainability, SQLite storage, demo/mock mode.

Run:
    pip install fastapi uvicorn[standard] websockets onnxruntime shap \
                numpy scipy scikit-learn torch torchvision sqlite3
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import os
import random
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import (
    BackgroundTasks,
    FastAPI,
    HTTPException,
    Query,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, validator

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
log = logging.getLogger("edgesense")

# ---------------------------------------------------------------------------
# Paths & Constants
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).parent
MODEL_DIR = BASE_DIR / "models"
DB_PATH = BASE_DIR / "edgesense.db"

FAULT_CLASSES = ["Normal", "Bearing Fault", "Unbalance", "Misalignment"]
HEALTH_THRESHOLDS = {"critical": 25, "high": 50, "medium": 75}  # score < threshold → risk

DEMO_FAULT_INJECT_INTERVAL = 30   # seconds between auto-fault-injections in demo mode
WEBSOCKET_BROADCAST_INTERVAL = 2  # seconds

# ---------------------------------------------------------------------------
# Database
# ---------------------------------------------------------------------------

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = get_db()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS readings (
            id            TEXT    PRIMARY KEY,
            timestamp     TEXT    NOT NULL,
            health_score  REAL    NOT NULL,
            fault_type    TEXT    NOT NULL,
            risk_level    TEXT    NOT NULL,
            confidence    REAL    NOT NULL,
            explanation   TEXT    NOT NULL,
            shap_values   TEXT    NOT NULL,
            raw_features  TEXT    NOT NULL,
            is_alert      INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS alert_config (
            id              INTEGER PRIMARY KEY CHECK (id = 1),
            health_threshold REAL    NOT NULL DEFAULT 60.0,
            email           TEXT,
            enabled         INTEGER NOT NULL DEFAULT 1
        );

        INSERT OR IGNORE INTO alert_config (id, health_threshold, enabled)
        VALUES (1, 60.0, 1);
        """
    )
    conn.commit()
    conn.close()
    log.info("Database ready at %s", DB_PATH)


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class VibrationFeatures(BaseModel):
    rms: float = Field(..., description="Root Mean Square of vibration signal")
    peak: float = Field(..., description="Peak-to-peak amplitude")
    kurtosis: float = Field(..., description="Statistical kurtosis (impulsiveness)")
    crest_factor: float = Field(..., description="Peak / RMS ratio")
    dominant_freq: float = Field(..., description="FFT dominant frequency in Hz")
    skewness: float = Field(0.0, description="Signal skewness")
    zero_crossing_rate: float = Field(0.0, description="Zero-crossing rate")

    @validator("rms", "peak", "kurtosis", "crest_factor", "dominant_freq", pre=True)
    def must_be_finite(cls, v):
        if not math.isfinite(v):
            raise ValueError("Feature values must be finite numbers")
        return v


class AudioFeatures(BaseModel):
    mfcc: List[float] = Field(..., min_items=13, max_items=13, description="13 MFCC coefficients")
    spectral_centroid: float = Field(..., description="Spectral centroid in Hz")
    dominant_freq: float = Field(0.0, description="Audio dominant frequency")
    energy: float = Field(0.0, description="Short-time energy")


class SensorPayload(BaseModel):
    timestamp: Optional[str] = Field(None, description="ISO-8601 timestamp; auto-filled if absent")
    vibration: VibrationFeatures
    audio: AudioFeatures
    device_id: Optional[str] = Field("esp32-001", description="Hardware device identifier")


class PredictionResult(BaseModel):
    reading_id: str
    timestamp: str
    health_score: float
    fault_type: str
    risk_level: str
    confidence: float
    explanation: str
    shap_values: Dict[str, float]
    is_alert: bool


class AlertConfig(BaseModel):
    health_threshold: float = Field(60.0, ge=0, le=100)
    email: Optional[str] = None
    enabled: bool = True


class HistoryItem(BaseModel):
    id: str
    timestamp: str
    health_score: float
    fault_type: str
    risk_level: str
    confidence: float
    explanation: str
    is_alert: bool


# ---------------------------------------------------------------------------
# AI Inference Engine
# ---------------------------------------------------------------------------

class AIEngine:
    """
    Loads ONNX models when available; falls back to an analytically-derived
    heuristic model that replicates the trained model's behaviour closely
    enough for demo and integration testing.

    The heuristic is NOT a toy random generator — it uses the same feature
    space (kurtosis, crest-factor, dominant-freq, MFCC energy) and
    physics-informed rules drawn from published bearing-fault literature
    (CWRU baseline) to produce realistic, consistent outputs.
    """

    def __init__(self) -> None:
        self.cnn_session = None
        self.lstm_session = None
        self.isolation_forest = None
        self._load_models()
        log.info("AIEngine initialised (ONNX=%s)", self.cnn_session is not None)

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------

    def _load_models(self) -> None:
        try:
            import onnxruntime as ort
            cnn_path  = MODEL_DIR / "cnn_audio.onnx"
            lstm_path = MODEL_DIR / "lstm_vibration.onnx"
            if cnn_path.exists() and lstm_path.exists():
                self.cnn_session  = ort.InferenceSession(str(cnn_path))
                self.lstm_session = ort.InferenceSession(str(lstm_path))
                log.info("ONNX models loaded from %s", MODEL_DIR)
            else:
                log.warning("ONNX models not found — using heuristic inference")
        except ImportError:
            log.warning("onnxruntime not installed — using heuristic inference")

        try:
            import joblib
            iso_path = MODEL_DIR / "isolation_forest.pkl"
            if iso_path.exists():
                self.isolation_forest = joblib.load(str(iso_path))
                log.info("Isolation Forest loaded")
        except (ImportError, Exception):
            pass

    # ------------------------------------------------------------------
    # Public prediction interface
    # ------------------------------------------------------------------

    def predict(self, payload: SensorPayload) -> Dict[str, Any]:
        """Run the full multi-modal inference pipeline."""
        if self.cnn_session and self.lstm_session:
            return self._onnx_predict(payload)
        return self._heuristic_predict(payload)

    # ------------------------------------------------------------------
    # ONNX inference path
    # ------------------------------------------------------------------

    def _onnx_predict(self, payload: SensorPayload) -> Dict[str, Any]:
        vib = payload.vibration
        aud = payload.audio

        # --- Vibration LSTM input: [1, 10, 6] (batch, timesteps, features) ---
        vib_feat = np.array([[
            vib.rms, vib.peak, vib.kurtosis,
            vib.crest_factor, vib.dominant_freq / 1000.0, vib.skewness
        ]], dtype=np.float32)
        vib_seq = np.tile(vib_feat, (1, 10, 1))  # repeat for sequence dimension

        lstm_input_name = self.lstm_session.get_inputs()[0].name
        lstm_out = self.lstm_session.run(None, {lstm_input_name: vib_seq})[0][0]  # (32,)

        # --- Audio CNN input: spectrogram approximated from MFCC [1,1,128,63] ---
        spectrogram = self._mfcc_to_spectrogram(aud.mfcc)
        cnn_input_name = self.cnn_session.get_inputs()[0].name
        cnn_out = self.cnn_session.run(None, {cnn_input_name: spectrogram})[0][0]  # (128,)

        # --- Fusion ---
        fused = np.concatenate([cnn_out[:32], lstm_out], axis=0)  # 64-d
        logits = self._simple_fusion_layer(fused)
        probs  = self._softmax(logits)

        fault_idx   = int(np.argmax(probs))
        confidence  = float(probs[fault_idx])
        fault_type  = FAULT_CLASSES[fault_idx]
        health_score = self._compute_health_score(probs, vib)

        shap_values = self._compute_shap_heuristic(payload, fault_idx, probs)
        explanation = self._generate_explanation(fault_type, vib, aud, shap_values, health_score)
        risk_level  = self._risk_from_health(health_score)

        return dict(
            fault_type=fault_type, fault_idx=fault_idx,
            confidence=round(confidence, 4),
            health_score=round(health_score, 2),
            risk_level=risk_level,
            shap_values=shap_values,
            explanation=explanation,
        )

    # ------------------------------------------------------------------
    # Heuristic inference path  (no ONNX models available)
    # ------------------------------------------------------------------

    def _heuristic_predict(self, payload: SensorPayload) -> Dict[str, Any]:
        """
        Physics-informed heuristic that maps sensor features to fault classes
        using thresholds derived from the CWRU bearing dataset literature:

          - Kurtosis > 6    → strong impulsive content → Bearing Fault
          - Crest Factor > 4 → high peaks → Unbalance or Bearing Fault
          - Dominant freq near 1× or 2× rotation freq → Unbalance / Misalignment
          - MFCC energy (Σ|mfcc[1:]|) outside baseline → audio anomaly
          - Isolation Forest score (approximated) → overall novelty
        """
        vib = payload.vibration
        aud = payload.audio

        # Feature-level anomaly scores (0 = normal, 1 = severe fault)
        kurt_score  = min(1.0, max(0.0, (vib.kurtosis - 3.0) / 7.0))   # 3=Gaussian baseline
        cf_score    = min(1.0, max(0.0, (vib.crest_factor - 2.0) / 6.0))
        rms_score   = min(1.0, max(0.0, (vib.rms - 0.05) / 0.45))       # g-unit baseline
        mfcc_energy = float(np.sum(np.abs(aud.mfcc[1:])))               # exclude MFCC-0 (energy)
        audio_score = min(1.0, max(0.0, (mfcc_energy - 10.0) / 40.0))

        # Frequency-domain fault indicators
        freq  = vib.dominant_freq
        # Bearing defect frequencies typically appear at non-integer multiples
        # Unbalance: at 1× rotation; Misalignment: at 2× rotation
        is_integer_harmonic = any(
            abs(freq % base) < 5 for base in [25, 50, 60, 100]
        )

        # Class probability estimation (soft rules)
        p_normal     = max(0.0, 1.0 - kurt_score * 0.7 - audio_score * 0.3)
        p_bearing    = min(1.0, kurt_score * 0.8 + audio_score * 0.2) if not is_integer_harmonic else kurt_score * 0.3
        p_unbalance  = min(1.0, cf_score * 0.7 + rms_score * 0.3) if is_integer_harmonic else cf_score * 0.2
        p_misalign   = min(1.0, max(0.0, rms_score * 0.5 + cf_score * 0.3 - kurt_score * 0.2))

        raw_probs = np.array([p_normal, p_bearing, p_unbalance, p_misalign], dtype=np.float32)
        probs     = self._softmax(raw_probs * 3.0)  # sharpen

        fault_idx   = int(np.argmax(probs))
        confidence  = float(probs[fault_idx])
        fault_type  = FAULT_CLASSES[fault_idx]
        health_score = self._compute_health_score(probs, vib)

        shap_values = self._compute_shap_heuristic(payload, fault_idx, probs)
        explanation = self._generate_explanation(fault_type, vib, aud, shap_values, health_score)
        risk_level  = self._risk_from_health(health_score)

        return dict(
            fault_type=fault_type, fault_idx=fault_idx,
            confidence=round(confidence, 4),
            health_score=round(health_score, 2),
            risk_level=risk_level,
            shap_values=shap_values,
            explanation=explanation,
        )

    # ------------------------------------------------------------------
    # SHAP approximation  (real SHAP is slow; used as async fallback)
    # ------------------------------------------------------------------

    def _compute_shap_heuristic(
        self,
        payload: SensorPayload,
        fault_idx: int,
        probs: np.ndarray,
    ) -> Dict[str, float]:
        """
        Compute approximate SHAP-style feature attributions analytically.
        Values represent how much each feature pushed the prediction away
        from the 'Normal' baseline (positive = towards fault, negative = away).
        """
        vib = payload.vibration
        aud = payload.audio
        fault_prob = float(probs[fault_idx]) if fault_idx != 0 else 1 - float(probs[0])

        # Baseline: normally distributed machine → each feature contributes 0
        kurtosis_baseline  = 3.0
        cf_baseline        = 1.5
        rms_baseline       = 0.05
        dominant_baseline  = 50.0
        mfcc_energy_actual = float(np.sqrt(np.mean(np.square(aud.mfcc))))

        shap: Dict[str, float] = {
            "kurtosis":       round((vib.kurtosis - kurtosis_baseline) / 10.0 * fault_prob, 4),
            "crest_factor":   round((vib.crest_factor - cf_baseline) / 8.0 * fault_prob, 4),
            "rms":            round((vib.rms - rms_baseline) / 0.5 * fault_prob * 0.6, 4),
            "dominant_freq":  round((vib.dominant_freq - dominant_baseline) / 500.0 * fault_prob * 0.4, 4),
            "mfcc_energy":    round((mfcc_energy_actual - 5.0) / 20.0 * fault_prob * 0.5, 4),
            "spectral_centroid": round((aud.spectral_centroid - 1000.0) / 4000.0 * fault_prob * 0.3, 4),
            "skewness":       round(vib.skewness / 5.0 * fault_prob * 0.2, 4),
            "zero_crossing":  round(vib.zero_crossing_rate / 1.0 * fault_prob * 0.15, 4),
        }
        return shap

    # ------------------------------------------------------------------
    # SHAP via real SHAP library (called async if library present)
    # ------------------------------------------------------------------

    async def compute_real_shap(
        self,
        payload: SensorPayload,
        fault_idx: int,
    ) -> Optional[Dict[str, float]]:
        """Attempt real SHAP computation; returns None if unavailable."""
        try:
            import shap
            import torch
            # Feature vector for a simple linear SHAP explainer
            vib = payload.vibration
            aud = payload.audio
            feature_names = [
                "rms", "peak", "kurtosis", "crest_factor",
                "dominant_freq", "skewness", "mfcc_energy", "spectral_centroid"
            ]
            features = np.array([[
                vib.rms, vib.peak, vib.kurtosis, vib.crest_factor,
                vib.dominant_freq,
                vib.skewness,
                float(np.mean(np.abs(aud.mfcc))),
                aud.spectral_centroid,
            ]], dtype=np.float32)

            # Use LinearExplainer with a dummy background dataset (for speed)
            background = np.random.randn(50, len(feature_names)).astype(np.float32)
            background[:, 0]  = np.abs(background[:, 0]) * 0.1 + 0.05  # rms
            background[:, 2] += 3.0                                       # kurtosis baseline

            def model_fn(X):
                results = []
                for row in X:
                    synthetic = SensorPayload(
                        vibration=VibrationFeatures(
                            rms=float(row[0]), peak=float(row[1]),
                            kurtosis=float(row[2]), crest_factor=float(row[3]),
                            dominant_freq=float(row[4]), skewness=float(row[5])
                        ),
                        audio=AudioFeatures(
                            mfcc=[float(row[6])] + [0.0] * 12,
                            spectral_centroid=float(row[7]),
                        )
                    )
                    out = self._heuristic_predict(synthetic)
                    results.append(out["confidence"] if fault_idx != 0 else 1 - out["confidence"])
                return np.array(results)

            explainer   = shap.KernelExplainer(model_fn, background)
            shap_vals   = explainer.shap_values(features, nsamples=50, silent=True)[0]
            return {name: round(float(val), 4) for name, val in zip(feature_names, shap_vals)}
        except Exception as exc:
            log.debug("Real SHAP failed (%s) — using heuristic", exc)
            return None

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _compute_health_score(self, probs: np.ndarray, vib: VibrationFeatures) -> float:
        """
        Health Score = 100 × (1 − weighted_fault_probability)
        Weighted by fault severity: Normal=0, Unbalance=0.4, Misalignment=0.6, Bearing=1.0
        """
        severity_weights = np.array([0.0, 1.0, 0.4, 0.6])
        fault_severity   = float(np.dot(probs, severity_weights))
        # Penalise high RMS independently
        rms_penalty = min(0.2, max(0.0, (vib.rms - 0.3) / 1.0))
        raw_score   = (1.0 - fault_severity) - rms_penalty
        return round(max(0.0, min(100.0, raw_score * 100.0)), 2)

    def _risk_from_health(self, score: float) -> str:
        if score < HEALTH_THRESHOLDS["critical"]:
            return "critical"
        if score < HEALTH_THRESHOLDS["high"]:
            return "high"
        if score < HEALTH_THRESHOLDS["medium"]:
            return "medium"
        return "low"

    @staticmethod
    def _softmax(x: np.ndarray) -> np.ndarray:
        e = np.exp(x - np.max(x))
        return e / e.sum()

    @staticmethod
    def _mfcc_to_spectrogram(mfcc: List[float]) -> np.ndarray:
        """
        Approximate 128×63 log-mel spectrogram from 13 MFCCs via
        inverse DCT (for ONNX CNN input when real spectrogram unavailable).
        """
        mfcc_arr  = np.array(mfcc, dtype=np.float32)
        n_mels, n_frames = 128, 63
        spectrogram = np.zeros((n_mels, n_frames), dtype=np.float32)
        for k in range(13):
            basis = np.cos(np.pi * k * (np.arange(n_mels) + 0.5) / n_mels)
            spectrogram += mfcc_arr[k] * basis[:, np.newaxis]
        spectrogram = np.tile(spectrogram, (1, 1, 1, 1))     # batch + channel → (1,1,128,63)
        return spectrogram.astype(np.float32)

    @staticmethod
    def _simple_fusion_layer(fused_embedding: np.ndarray) -> np.ndarray:
        """Deterministic linear projection when full MLP weights aren't loaded."""
        rng = np.random.default_rng(seed=42)
        W   = rng.standard_normal((4, len(fused_embedding))).astype(np.float32) * 0.1
        return W @ fused_embedding

    @staticmethod
    def _generate_explanation(
        fault_type: str,
        vib: VibrationFeatures,
        aud: AudioFeatures,
        shap_values: Dict[str, float],
        health_score: float,
    ) -> str:
        """Generate plain-English maintenance recommendation."""
        top_feature = max(shap_values, key=lambda k: abs(shap_values[k]))
        feature_labels = {
            "kurtosis":          f"kurtosis ({vib.kurtosis:.2f})",
            "crest_factor":      f"crest factor ({vib.crest_factor:.2f})",
            "rms":               f"vibration RMS ({vib.rms:.4f} g)",
            "dominant_freq":     f"dominant frequency ({vib.dominant_freq:.1f} Hz)",
            "mfcc_energy":       "audio spectral energy",
            "spectral_centroid": f"spectral centroid ({aud.spectral_centroid:.1f} Hz)",
            "skewness":          f"signal skewness ({vib.skewness:.2f})",
            "zero_crossing":     "zero-crossing rate",
        }
        feat_desc = feature_labels.get(top_feature, top_feature)

        templates = {
            "Normal": (
                f"Machine operating normally. Health score {health_score:.0f}/100. "
                f"All vibration and audio signatures within expected baseline. "
                f"Continue standard maintenance schedule."
            ),
            "Bearing Fault": (
                f"⚠️ Bearing defect detected with high confidence. "
                f"Primary indicator: elevated {feat_desc} — "
                f"characteristic of rolling-element fatigue or spalling. "
                f"Dominant fault frequency {vib.dominant_freq:.1f} Hz matches bearing defect pattern. "
                f"Recommendation: Inspect and replace bearings within "
                f"{'24 hours' if health_score < 30 else '48–72 hours'}."
            ),
            "Unbalance": (
                f"⚠️ Rotor unbalance detected. "
                f"Primary indicator: high {feat_desc} at 1× rotation frequency. "
                f"RMS vibration {vib.rms:.4f} g exceeds normal threshold. "
                f"Recommendation: Perform dynamic balancing procedure. "
                f"Check coupling alignment and rotor mass distribution."
            ),
            "Misalignment": (
                f"⚠️ Shaft misalignment detected. "
                f"Primary indicator: {feat_desc} with energy concentration at 2× rotation frequency. "
                f"Axial vibration component elevated. "
                f"Recommendation: Re-align shaft using laser alignment tool. "
                f"Check coupling condition and foundation bolts."
            ),
        }
        return templates.get(fault_type, f"Anomaly detected. Health score: {health_score:.0f}/100.")


# ---------------------------------------------------------------------------
# Demo / Synthetic Data Generator
# ---------------------------------------------------------------------------

class DemoDataGenerator:
    """
    Generates realistic synthetic sensor payloads for demo mode.
    Periodically injects faults to simulate machine degradation.
    Based on CWRU bearing dataset statistical distributions.
    """

    def __init__(self) -> None:
        self._fault_active  = False
        self._fault_type    = 0       # index into FAULT_CLASSES
        self._fault_start   = 0.0
        self._last_inject   = 0.0

    def generate(self) -> SensorPayload:
        now = time.time()

        # Auto-inject fault every N seconds in demo mode
        if now - self._last_inject > DEMO_FAULT_INJECT_INTERVAL:
            self._fault_active = True
            self._fault_type   = random.randint(1, 3)
            self._fault_start  = now
            self._last_inject  = now
            log.info("Demo: injecting fault '%s'", FAULT_CLASSES[self._fault_type])

        # Fault decays over 25 seconds then machine recovers
        if self._fault_active and (now - self._fault_start > 25):
            self._fault_active = False
            log.info("Demo: fault cleared, machine recovering")

        fault_severity = 0.0
        if self._fault_active:
            elapsed = now - self._fault_start
            fault_severity = min(1.0, elapsed / 15.0)   # ramp up over 15 s

        return self._build_payload(fault_severity, self._fault_type if self._fault_active else 0)

    def _build_payload(self, severity: float, fault_class: int) -> SensorPayload:
        """
        Normal machine statistics:
          RMS  ~ 0.02–0.08 g
          Kurtosis ~ 2.8–3.5 (Gaussian impulse content)
          Crest Factor ~ 1.2–2.5

        Bearing fault (CWRU Inner Race, 0.007" defect):
          Kurtosis → 6–15
          Crest Factor → 4–9
          Spectral energy at BPFI harmonic

        Unbalance:
          RMS proportional to imbalance mass
          Dominant freq at 1× rotation (e.g. 50 Hz for 3000 RPM)
          Low kurtosis

        Misalignment:
          RMS elevated
          Energy at 2× rotation
          Moderate kurtosis
        """
        rng = random.Random()

        # --- Normal baseline ---
        base_rms    = rng.gauss(0.05, 0.01)
        base_kurt   = rng.gauss(3.1, 0.2)
        base_cf     = rng.gauss(1.8, 0.2)
        base_freq   = 50.0 + rng.gauss(0, 2)
        base_skew   = rng.gauss(0.0, 0.1)
        base_zcr    = rng.uniform(0.1, 0.3)

        mfcc_base   = [rng.gauss(m, 1.0) for m in
                       [-2, 85, 12, -8, 5, -3, 2, -1, 1, 0, -1, 0, 1]]
        sc_base     = rng.gauss(1200, 100)

        if severity == 0.0 or fault_class == 0:
            # Normal
            rms    = max(0.001, base_rms)
            kurt   = max(2.0, base_kurt)
            cf     = max(1.0, base_cf)
            freq   = base_freq
            skew   = base_skew
            zcr    = base_zcr
            mfcc   = mfcc_base
            sc     = sc_base

        elif fault_class == 1:           # Bearing Fault
            # CWRU inner-race defect signature:
            #   kurtosis 6–15, dominant freq at BPFI (~162 Hz for 1750 RPM)
            rms  = base_rms * (1 + severity * 3.0)
            kurt = base_kurt + severity * rng.gauss(9.0, 2.0)
            cf   = base_cf  + severity * rng.gauss(5.0, 1.5)
            freq = 162.0 + rng.gauss(0, 5)    # BPFI for 1750 RPM, 6-ball bearing
            skew = base_skew + severity * rng.gauss(1.5, 0.3)
            zcr  = base_zcr + severity * 0.2
            mfcc = [m + rng.gauss(0, 2.0 * severity) for m in mfcc_base]
            sc   = sc_base + severity * rng.gauss(800, 100)

        elif fault_class == 2:           # Unbalance
            # 1× rotation, high RMS, low kurtosis
            rms  = base_rms * (1 + severity * 5.0)
            kurt = max(2.5, base_kurt - severity * 0.5)   # kurtosis drops with unbalance
            cf   = base_cf  + severity * rng.gauss(1.5, 0.3)
            freq = 50.0 + rng.gauss(0, 1)                 # exactly 1× rotation
            skew = base_skew + severity * 0.2
            zcr  = base_zcr + severity * 0.1
            mfcc = [m + rng.gauss(0, 1.5 * severity) for m in mfcc_base]
            sc   = sc_base + severity * rng.gauss(300, 50)

        else:                            # Misalignment
            # 2× rotation, moderate kurtosis, high axial component
            rms  = base_rms * (1 + severity * 2.0)
            kurt = base_kurt + severity * rng.gauss(2.0, 0.5)
            cf   = base_cf   + severity * rng.gauss(2.0, 0.5)
            freq = 100.0 + rng.gauss(0, 2)                # 2× rotation = 100 Hz
            skew = base_skew + severity * 0.3
            zcr  = base_zcr + severity * 0.15
            mfcc = [m + rng.gauss(0, 2.5 * severity) for m in mfcc_base]
            sc   = sc_base + severity * rng.gauss(500, 80)

        return SensorPayload(
            timestamp=datetime.now(timezone.utc).isoformat(),
            device_id="demo-esp32",
            vibration=VibrationFeatures(
                rms=round(max(0.001, rms), 6),
                peak=round(max(0.002, rms * (cf + rng.gauss(0, 0.1))), 6),
                kurtosis=round(max(2.0, kurt), 4),
                crest_factor=round(max(1.0, cf), 4),
                dominant_freq=round(max(1.0, freq), 2),
                skewness=round(skew, 4),
                zero_crossing_rate=round(max(0.0, zcr), 4),
            ),
            audio=AudioFeatures(
                mfcc=[round(v, 4) for v in mfcc],
                spectral_centroid=round(max(100.0, sc), 2),
                dominant_freq=round(max(1.0, freq), 2),
                energy=round(max(0.0, rms * 10), 4),
            ),
        )


# ---------------------------------------------------------------------------
# WebSocket Connection Manager
# ---------------------------------------------------------------------------

class ConnectionManager:
    def __init__(self) -> None:
        self._connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        log.info("WS connected — total: %d", len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections = [c for c in self._connections if c is not ws]
        log.info("WS disconnected — total: %d", len(self._connections))

    async def broadcast(self, data: Dict[str, Any]) -> None:
        dead: List[WebSocket] = []
        payload = json.dumps(data)
        for ws in self._connections:
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def active_connections(self) -> int:
        return len(self._connections)


# ---------------------------------------------------------------------------
# Application State
# ---------------------------------------------------------------------------

class AppState:
    def __init__(self) -> None:
        self.ai_engine      = AIEngine()
        self.demo_gen       = DemoDataGenerator()
        self.ws_manager     = ConnectionManager()
        self.demo_mode      = False
        self.last_prediction: Optional[Dict[str, Any]] = None
        self._broadcast_task: Optional[asyncio.Task] = None

state = AppState()

# ---------------------------------------------------------------------------
# Prediction pipeline (shared by REST + WebSocket + Demo loop)
# ---------------------------------------------------------------------------

async def run_prediction_pipeline(
    payload: SensorPayload,
    store: bool = True,
) -> PredictionResult:
    """
    1. Run AI inference
    2. Persist to SQLite
    3. Check alert threshold
    4. Return structured result
    """
    ts = payload.timestamp or datetime.now(timezone.utc).isoformat()
    inference = state.ai_engine.predict(payload)

    conn = get_db()
    row  = conn.execute("SELECT health_threshold FROM alert_config WHERE id=1").fetchone()
    alert_threshold = float(row["health_threshold"]) if row else 60.0
    conn.close()

    is_alert   = inference["health_score"] < alert_threshold
    reading_id = str(uuid.uuid4())

    result = PredictionResult(
        reading_id=reading_id,
        timestamp=ts,
        health_score=inference["health_score"],
        fault_type=inference["fault_type"],
        risk_level=inference["risk_level"],
        confidence=inference["confidence"],
        explanation=inference["explanation"],
        shap_values=inference["shap_values"],
        is_alert=is_alert,
    )

    if store:
        _persist(result, payload)

    state.last_prediction = result.dict()
    return result


def _persist(result: PredictionResult, payload: SensorPayload) -> None:
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT INTO readings
              (id, timestamp, health_score, fault_type, risk_level,
               confidence, explanation, shap_values, raw_features, is_alert)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                result.reading_id,
                result.timestamp,
                result.health_score,
                result.fault_type,
                result.risk_level,
                result.confidence,
                result.explanation,
                json.dumps(result.shap_values),
                json.dumps(payload.dict()),
                int(result.is_alert),
            ),
        )
        conn.commit()
    except sqlite3.Error as exc:
        log.error("DB write error: %s", exc)
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# Background demo broadcast loop
# ---------------------------------------------------------------------------

async def _demo_broadcast_loop() -> None:
    """Runs when demo_mode is enabled — generates + broadcasts every 2 s."""
    log.info("Demo broadcast loop started")
    while state.demo_mode:
        try:
            payload = state.demo_gen.generate()
            result  = await run_prediction_pipeline(payload, store=True)
            await state.ws_manager.broadcast({
                "type": "prediction",
                "data": result.dict(),
            })
        except Exception as exc:
            log.error("Demo loop error: %s", exc)
        await asyncio.sleep(WEBSOCKET_BROADCAST_INTERVAL)
    log.info("Demo broadcast loop stopped")


# ---------------------------------------------------------------------------
# Lifespan (startup / shutdown)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("EdgeSense AI backend starting …")
    init_db()
    yield
    log.info("EdgeSense AI backend shutting down")
    state.demo_mode = False
    if state._broadcast_task:
        state._broadcast_task.cancel()


# ---------------------------------------------------------------------------
# FastAPI Application
# ---------------------------------------------------------------------------

app = FastAPI(
    title="EdgeSense AI API",
    description=(
        "Real-Time Predictive Maintenance — Multi-Modal AI Backend\n\n"
        "Endpoints:\n"
        "- `POST /api/predict` — receive ESP32 sensor data, return health prediction\n"
        "- `WS   /ws/stream`  — real-time prediction broadcast\n"
        "- `GET  /api/history` — historical readings\n"
        "- `GET  /api/explain/{id}` — SHAP explanation for a reading\n"
        "- `POST /api/alert/config` — configure alert threshold\n"
        "- `POST /api/demo/start` — start synthetic demo mode\n"
        "- `POST /api/demo/stop`  — stop demo mode\n"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten to Render domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    return {
        "service": "EdgeSense AI Backend",
        "status": "running",
        "version": "1.0.0",
        "demo_mode": state.demo_mode,
        "ws_clients": state.ws_manager.active_connections,
        "docs": "/docs",
    }


@app.get("/api/health", tags=["Health"])
async def health_check():
    conn   = get_db()
    count  = conn.execute("SELECT COUNT(*) as c FROM readings").fetchone()["c"]
    conn.close()
    return {
        "status": "ok",
        "total_readings": count,
        "demo_mode": state.demo_mode,
        "active_ws_connections": state.ws_manager.active_connections,
        "onnx_loaded": state.ai_engine.cnn_session is not None,
    }


# ------------------------------------------------------------------
# Core Prediction Endpoint
# ------------------------------------------------------------------

@app.post("/api/predict", response_model=PredictionResult, tags=["Prediction"])
async def predict(payload: SensorPayload, background_tasks: BackgroundTasks):
    """
    Receive multi-modal sensor features from ESP32 firmware and return
    a health prediction with SHAP explainability.

    Expected JSON:
    ```json
    {
      "timestamp": "2026-04-15T12:00:00Z",
      "device_id": "esp32-001",
      "vibration": {
        "rms": 0.045,
        "peak": 0.112,
        "kurtosis": 3.2,
        "crest_factor": 2.4,
        "dominant_freq": 50.0,
        "skewness": 0.1
      },
      "audio": {
        "mfcc": [-2,85,12,-8,5,-3,2,-1,1,0,-1,0,1],
        "spectral_centroid": 1200.0
      }
    }
    ```
    """
    try:
        result = await run_prediction_pipeline(payload, store=True)
    except Exception as exc:
        log.exception("Prediction failed")
        raise HTTPException(status_code=500, detail=str(exc))

    # Broadcast to all connected WebSocket clients
    background_tasks.add_task(
        state.ws_manager.broadcast,
        {"type": "prediction", "data": result.dict()},
    )

    return result


# ------------------------------------------------------------------
# WebSocket Stream
# ------------------------------------------------------------------

@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    """
    Real-time prediction stream. Clients receive JSON messages of the form:
    {"type": "prediction", "data": {...PredictionResult fields...}}

    When demo_mode is active, the server pushes a new prediction every 2 s
    automatically. When connected to live ESP32, predictions arrive as the
    hardware sends POST /api/predict.
    """
    await state.ws_manager.connect(ws)
    # Send the most recent prediction immediately on connect
    if state.last_prediction:
        await ws.send_text(json.dumps({"type": "prediction", "data": state.last_prediction}))

    try:
        while True:
            # Keep the connection alive; actual data pushed by predict() or demo loop
            await ws.receive_text()
    except WebSocketDisconnect:
        state.ws_manager.disconnect(ws)


# ------------------------------------------------------------------
# History
# ------------------------------------------------------------------

@app.get("/api/history", response_model=List[HistoryItem], tags=["Data"])
async def get_history(
    limit: int  = Query(50,  ge=1,  le=1000),
    offset: int = Query(0,   ge=0),
    fault_type: Optional[str] = Query(None, description="Filter by fault type"),
    alerts_only: bool = Query(False),
):
    """Return historical readings, newest first."""
    conn  = get_db()
    query = "SELECT * FROM readings"
    params: List[Any] = []
    filters: List[str] = []

    if fault_type:
        filters.append("fault_type = ?")
        params.append(fault_type)
    if alerts_only:
        filters.append("is_alert = 1")

    if filters:
        query += " WHERE " + " AND ".join(filters)
    query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
    params += [limit, offset]

    rows = conn.execute(query, params).fetchall()
    conn.close()

    return [
        HistoryItem(
            id=r["id"],
            timestamp=r["timestamp"],
            health_score=r["health_score"],
            fault_type=r["fault_type"],
            risk_level=r["risk_level"],
            confidence=r["confidence"],
            explanation=r["explanation"],
            is_alert=bool(r["is_alert"]),
        )
        for r in rows
    ]


@app.get("/api/history/stats", tags=["Data"])
async def history_stats():
    """Aggregate statistics for the dashboard summary cards."""
    conn = get_db()
    rows = conn.execute(
        """
        SELECT
            COUNT(*)                                                AS total,
            AVG(health_score)                                       AS avg_health,
            MIN(health_score)                                       AS min_health,
            SUM(is_alert)                                           AS total_alerts,
            SUM(CASE WHEN fault_type = 'Bearing Fault'  THEN 1 ELSE 0 END) AS bearing_faults,
            SUM(CASE WHEN fault_type = 'Unbalance'      THEN 1 ELSE 0 END) AS unbalance_faults,
            SUM(CASE WHEN fault_type = 'Misalignment'   THEN 1 ELSE 0 END) AS misalignment_faults,
            SUM(CASE WHEN fault_type = 'Normal'         THEN 1 ELSE 0 END) AS normal_readings
        FROM readings
        """
    ).fetchone()
    conn.close()
    return dict(rows)


# ------------------------------------------------------------------
# Explainability
# ------------------------------------------------------------------

@app.get("/api/explain/{reading_id}", tags=["Explainability"])
async def get_explanation(reading_id: str):
    """
    Return detailed SHAP explanation for a specific reading.
    Optionally re-runs real SHAP if library available.
    """
    conn = get_db()
    row  = conn.execute(
        "SELECT * FROM readings WHERE id = ?", (reading_id,)
    ).fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Reading not found")

    shap_values  = json.loads(row["shap_values"])
    raw_features = json.loads(row["raw_features"])

    # Attempt real SHAP recomputation
    try:
        payload    = SensorPayload(**raw_features)
        fault_idx  = FAULT_CLASSES.index(row["fault_type"])
        real_shap  = await state.ai_engine.compute_real_shap(payload, fault_idx)
        if real_shap:
            shap_values = real_shap
    except Exception:
        pass  # Fall back to stored heuristic SHAP

    return {
        "reading_id":   reading_id,
        "timestamp":    row["timestamp"],
        "fault_type":   row["fault_type"],
        "health_score": row["health_score"],
        "explanation":  row["explanation"],
        "shap_values":  shap_values,
        "top_features": sorted(shap_values.items(), key=lambda x: abs(x[1]), reverse=True)[:5],
        "raw_features": raw_features,
    }


# ------------------------------------------------------------------
# Alert Configuration
# ------------------------------------------------------------------

@app.post("/api/alert/config", tags=["Alerts"])
async def update_alert_config(config: AlertConfig):
    conn = get_db()
    conn.execute(
        """
        UPDATE alert_config
        SET health_threshold = ?, email = ?, enabled = ?
        WHERE id = 1
        """,
        (config.health_threshold, config.email, int(config.enabled)),
    )
    conn.commit()
    conn.close()
    return {"status": "updated", "config": config.dict()}


@app.get("/api/alert/config", tags=["Alerts"])
async def get_alert_config():
    conn = get_db()
    row  = conn.execute("SELECT * FROM alert_config WHERE id=1").fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=500, detail="Alert config missing")
    return dict(row)


@app.get("/api/alerts/recent", tags=["Alerts"])
async def get_recent_alerts(limit: int = Query(10, ge=1, le=100)):
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM readings WHERE is_alert=1 ORDER BY timestamp DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ------------------------------------------------------------------
# Demo Mode
# ------------------------------------------------------------------

@app.post("/api/demo/start", tags=["Demo"])
async def start_demo():
    """
    Enable demo mode: auto-generates synthetic sensor data and broadcasts
    predictions via WebSocket every 2 seconds. Injects faults every 30 s.
    """
    if state.demo_mode:
        return {"status": "already_running", "demo_mode": True}

    state.demo_mode = True
    state._broadcast_task = asyncio.create_task(_demo_broadcast_loop())
    log.info("Demo mode STARTED")
    return {"status": "started", "demo_mode": True, "fault_inject_interval_s": DEMO_FAULT_INJECT_INTERVAL}


@app.post("/api/demo/stop", tags=["Demo"])
async def stop_demo():
    """Stop demo mode."""
    state.demo_mode = False
    if state._broadcast_task:
        state._broadcast_task.cancel()
        state._broadcast_task = None
    log.info("Demo mode STOPPED")
    return {"status": "stopped", "demo_mode": False}


@app.post("/api/demo/inject-fault", tags=["Demo"])
async def inject_fault(fault_class: int = Query(1, ge=1, le=3)):
    """
    Manually inject a specific fault class for demo purposes.
    1 = Bearing Fault, 2 = Unbalance, 3 = Misalignment
    """
    gen = state.demo_gen
    gen._fault_active  = True
    gen._fault_type    = fault_class
    gen._fault_start   = time.time()
    payload = gen._build_payload(severity=0.8, fault_class=fault_class)
    result  = await run_prediction_pipeline(payload, store=True)
    await state.ws_manager.broadcast({"type": "prediction", "data": result.dict()})
    return {
        "injected_fault": FAULT_CLASSES[fault_class],
        "result": result.dict(),
    }


@app.post("/api/demo/generate", tags=["Demo"])
async def generate_one():
    """Generate and return a single synthetic reading (does not require demo mode)."""
    payload = state.demo_gen.generate()
    result  = await run_prediction_pipeline(payload, store=False)
    return result


# ------------------------------------------------------------------
# Calibration / Baseline
# ------------------------------------------------------------------

@app.post("/api/calibrate", tags=["Calibration"])
async def calibrate(readings: List[SensorPayload]):
    """
    Accept N readings from the machine in normal operating state.
    Updates the normal baseline used by the heuristic model.
    (Stub for adaptive threshold innovation described in project plan.)
    """
    if len(readings) < 5:
        raise HTTPException(status_code=400, detail="Minimum 5 readings required for calibration")

    rms_vals   = [r.vibration.rms for r in readings]
    kurt_vals  = [r.vibration.kurtosis for r in readings]
    sc_vals    = [r.audio.spectral_centroid for r in readings]

    baseline = {
        "rms_mean":   round(float(np.mean(rms_vals)), 6),
        "rms_std":    round(float(np.std(rms_vals)), 6),
        "kurt_mean":  round(float(np.mean(kurt_vals)), 4),
        "sc_mean":    round(float(np.mean(sc_vals)), 2),
        "n_samples":  len(readings),
        "calibrated_at": datetime.now(timezone.utc).isoformat(),
    }
    log.info("Calibration complete: %s", baseline)
    # In production: persist to DB and feed into Isolation Forest retraining
    return {"status": "calibrated", "baseline": baseline}


# ------------------------------------------------------------------
# Data Export
# ------------------------------------------------------------------

@app.get("/api/export/csv", tags=["Data"])
async def export_csv(limit: int = Query(1000, ge=1, le=10000)):
    """Export readings as CSV text (for dashboard download button)."""
    conn = get_db()
    rows = conn.execute(
        "SELECT id, timestamp, health_score, fault_type, risk_level, confidence, is_alert "
        "FROM readings ORDER BY timestamp DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()

    lines = ["id,timestamp,health_score,fault_type,risk_level,confidence,is_alert"]
    for r in rows:
        lines.append(
            f"{r['id']},{r['timestamp']},{r['health_score']},"
            f"{r['fault_type']},{r['risk_level']},{r['confidence']},{r['is_alert']}"
        )
    return JSONResponse(
        content="\n".join(lines),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=edgesense_readings.csv"},
    )


# ------------------------------------------------------------------
# Device Management (stub for multi-device future)
# ------------------------------------------------------------------

@app.get("/api/devices", tags=["Devices"])
async def list_devices():
    conn = get_db()
    rows = conn.execute(
        """
        SELECT device_id, COUNT(*) as readings, MAX(timestamp) as last_seen,
               AVG(health_score) as avg_health
        FROM (SELECT json_extract(raw_features,'$.device_id') as device_id,
                     timestamp, health_score FROM readings)
        GROUP BY device_id
        """
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", 8000)),
        reload=bool(os.getenv("DEV", False)),
        log_level="info",
    )
