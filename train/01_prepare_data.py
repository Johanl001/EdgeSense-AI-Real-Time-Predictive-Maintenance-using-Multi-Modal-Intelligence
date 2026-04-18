"""
EdgeSense AI — Step 1: Data Preparation
========================================
Downloads CWRU Bearing Dataset and generates synthetic vibration + audio data.
Outputs:
  - data/vibration_sequences.npz   → for LSTM training
  - data/spectrograms.npz          → for CNN training
  - data/isolation_normal.npz      → for Isolation Forest training

Run: python train/01_prepare_data.py
"""

import os
import urllib.request
import numpy as np
from pathlib import Path
from scipy import signal
from scipy.io import loadmat

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
ROOT = Path(__file__).parent.parent          # repo root  (edgesense-ai/)
DATA_DIR = ROOT / "train" / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# ──────────────────────────────────────────────
# CWRU .mat download URLs (DE channel, 1797RPM)
# 0HP load, drive-end bearing, 12kHz
# ──────────────────────────────────────────────
CWRU_FILES = {
    "normal":        ("97.mat",  "https://engineering.case.edu/sites/default/files/97.mat"),
    "inner_race":    ("105.mat", "https://engineering.case.edu/sites/default/files/105.mat"),
    "outer_race":    ("130.mat", "https://engineering.case.edu/sites/default/files/130.mat"),
    "ball":          ("118.mat", "https://engineering.case.edu/sites/default/files/118.mat"),
}

# Map CWRU classes → our 4 project classes
CLASS_MAP = {
    "normal":     0,   # Normal
    "inner_race": 1,   # Bearing Fault
    "outer_race": 1,   # Bearing Fault (merged)
    "ball":       1,   # Bearing Fault (merged)
}

FS = 12_000        # CWRU sample rate
WINDOW = 512       # samples per feature window
OVERLAP = 256      # 50% overlap
SEQ_LEN = 10       # LSTM timesteps
N_MELS = 128
N_FFT = 512
HOP = 128

print("=" * 60)
print("EdgeSense AI — Data Preparation")
print("=" * 60)


# ──────────────────────────────────────────────
# 1. Download CWRU
# ──────────────────────────────────────────────
def download_cwru():
    raw_dir = DATA_DIR / "cwru_raw"
    raw_dir.mkdir(exist_ok=True)
    signals = {}
    for name, (fname, url) in CWRU_FILES.items():
        fpath = raw_dir / fname
        if not fpath.exists():
            print(f"  Downloading {name} ({fname})…")
            try:
                urllib.request.urlretrieve(url, fpath)
                print(f"  ✓ {fname}")
            except Exception as e:
                print(f"  ✗ {fname} failed: {e} — generating synthetic instead")
                fpath = None
        else:
            print(f"  ✓ {fname} (cached)")

        if fpath and fpath.exists():
            mat = loadmat(str(fpath))
            de_key = [k for k in mat if "DE_time" in k][0]
            signals[name] = mat[de_key].flatten().astype(np.float32)
        else:
            signals[name] = None
    return signals


# ──────────────────────────────────────────────
# 2. Synthetic vibration generator
#    Physics-informed, matches CWRU stats
# ──────────────────────────────────────────────
def synthetic_vibration(fault_class: int, n_samples: int = 60_000) -> np.ndarray:
    """
    fault_class:
      0 = Normal       → low kurtosis (~3), dominant 60Hz
      1 = Bearing Fault → high kurtosis (6-12), 120Hz impulses
      2 = Unbalance    → strong 1x RPM, low kurtosis
      3 = Misalignment → strong 2x RPM, moderate kurtosis
    """
    t = np.linspace(0, n_samples / FS, n_samples)
    rng = np.random.default_rng(fault_class * 42)
    noise = rng.normal(0, 0.05, n_samples).astype(np.float32)

    if fault_class == 0:   # Normal
        sig = 0.3 * np.sin(2 * np.pi * 60 * t) + noise

    elif fault_class == 1:  # Bearing Fault — periodic impulses at BPFO≈120Hz
        sig = 0.3 * np.sin(2 * np.pi * 60 * t) + noise
        impulse_period = int(FS / 120)
        for i in range(0, n_samples, impulse_period):
            width = min(20, n_samples - i)
            sig[i:i + width] += rng.exponential(1.5) * np.hamming(width)

    elif fault_class == 2:  # Unbalance — strong 1x (25 Hz at 1500 RPM)
        sig = 1.2 * np.sin(2 * np.pi * 25 * t) + \
              0.4 * np.sin(2 * np.pi * 50 * t) + noise

    else:                   # Misalignment — strong 1x + 2x
        sig = 0.8 * np.sin(2 * np.pi * 25 * t) + \
              0.9 * np.sin(2 * np.pi * 50 * t) + \
              0.3 * np.sin(2 * np.pi * 75 * t) + noise

    return sig.astype(np.float32)


# ──────────────────────────────────────────────
# 3. Extract vibration features from a window
# ──────────────────────────────────────────────
def extract_features(window: np.ndarray) -> np.ndarray:
    """Returns [rms, peak, kurtosis, skewness, crest_factor, dominant_freq]"""
    rms = float(np.sqrt(np.mean(window ** 2)))
    peak = float(np.ptp(window))
    eps = 1e-9
    mu = np.mean(window)
    std = np.std(window) + eps
    kurtosis = float(np.mean(((window - mu) / std) ** 4))
    skewness = float(np.mean(((window - mu) / std) ** 3))
    crest = peak / (rms + eps)
    freqs = np.fft.rfftfreq(len(window), 1 / FS)
    fft_mag = np.abs(np.fft.rfft(window))
    dominant_freq = float(freqs[np.argmax(fft_mag)])
    return np.array([rms, peak, kurtosis, skewness, crest, dominant_freq], dtype=np.float32)


# ──────────────────────────────────────────────
# 4. Sliding-window feature extraction → LSTM sequences
# ──────────────────────────────────────────────
def signal_to_sequences(sig: np.ndarray, label: int):
    frames, labels = [], []
    for start in range(0, len(sig) - WINDOW, OVERLAP):
        w = sig[start: start + WINDOW]
        frames.append(extract_features(w))
    # Build SEQ_LEN-step sequences
    sequences, seq_labels = [], []
    for i in range(len(frames) - SEQ_LEN):
        sequences.append(frames[i: i + SEQ_LEN])
        seq_labels.append(label)
    return np.array(sequences, dtype=np.float32), np.array(seq_labels, dtype=np.int64)


# ──────────────────────────────────────────────
# 5. Log-mel spectrogram for CNN
# ──────────────────────────────────────────────
def signal_to_spectrograms(sig: np.ndarray, label: int, n_frames: int = 63):
    """Chop signal into 1-sec audio windows → log-mel spectrogram (128×63)."""
    spectrograms, labels = [], []
    win_samples = FS  # 1 second
    mel_fb = _mel_filterbank(N_MELS, N_FFT, FS)
    for start in range(0, len(sig) - win_samples, win_samples // 2):
        chunk = sig[start: start + win_samples]
        # STFT
        _, _, Zxx = signal.stft(chunk, fs=FS, nperseg=N_FFT, noverlap=N_FFT - HOP)
        power = np.abs(Zxx) ** 2                        # (freq_bins, time_frames)
        # Mel
        mel = mel_fb @ power[:N_FFT // 2 + 1, :]       # (N_MELS, time_frames)
        log_mel = np.log1p(mel)
        # Resize to fixed (128, 63)
        if log_mel.shape[1] >= n_frames:
            log_mel = log_mel[:, :n_frames]
        else:
            pad = n_frames - log_mel.shape[1]
            log_mel = np.pad(log_mel, ((0, 0), (0, pad)))
        spectrograms.append(log_mel[np.newaxis].astype(np.float32))  # (1,128,63)
        labels.append(label)
    return np.array(spectrograms, dtype=np.float32), np.array(labels, dtype=np.int64)


def _mel_filterbank(n_mels, n_fft, sr):
    """Simple triangular mel filterbank."""
    low, high = 20.0, sr / 2.0
    mel_low = 2595 * np.log10(1 + low / 700)
    mel_high = 2595 * np.log10(1 + high / 700)
    mel_points = np.linspace(mel_low, mel_high, n_mels + 2)
    hz_points = 700 * (10 ** (mel_points / 2595) - 1)
    bin_points = np.floor((n_fft + 1) * hz_points / sr).astype(int)
    n_bins = n_fft // 2 + 1
    fb = np.zeros((n_mels, n_bins), dtype=np.float32)
    for m in range(1, n_mels + 1):
        lo, center, hi = bin_points[m - 1], bin_points[m], bin_points[m + 1]
        for k in range(lo, center):
            if center != lo:
                fb[m - 1, k] = (k - lo) / (center - lo)
        for k in range(center, hi):
            if hi != center:
                fb[m - 1, k] = (hi - k) / (hi - center)
    return fb


# ──────────────────────────────────────────────
# 6. Augmentation helpers
# ──────────────────────────────────────────────
def augment_signal(sig: np.ndarray, rng) -> np.ndarray:
    """Time-shift + additive noise + amplitude scale."""
    shift = rng.integers(-FS // 4, FS // 4)
    sig = np.roll(sig, shift)
    sig += rng.normal(0, 0.02, len(sig)).astype(np.float32)
    sig *= rng.uniform(0.85, 1.15)
    return sig.astype(np.float32)


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────
def main():
    rng = np.random.default_rng(0)

    # ── Collect signals (CWRU where possible, synthetic fallback) ──
    print("\n[1/4] Loading / downloading CWRU data…")
    cwru = download_cwru()

    all_signals = {}  # label → list of signals
    for name, label in CLASS_MAP.items():
        sig = cwru.get(name)
        if sig is None:
            print(f"  Using synthetic data for {name}")
            sig = synthetic_vibration(label)
        all_signals.setdefault(label, []).append(sig)

    # Add synthetic Unbalance (class 2) and Misalignment (class 3)
    for cls in (2, 3):
        all_signals[cls] = []
        for _ in range(3):
            s = synthetic_vibration(cls)
            all_signals[cls].append(augment_signal(s, rng))

    # ── Build LSTM sequences ──
    print("\n[2/4] Building vibration sequences for LSTM…")
    all_seqs, all_seq_labels = [], []
    normal_frames = []
    for label, sigs in all_signals.items():
        for sig in sigs:
            seqs, lbls = signal_to_sequences(sig, label)
            all_seqs.append(seqs)
            all_seq_labels.append(lbls)
            # Collect normal frames for Isolation Forest
            if label == 0:
                for start in range(0, len(sig) - WINDOW, OVERLAP):
                    w = sig[start: start + WINDOW]
                    normal_frames.append(extract_features(w))

    X_seq = np.concatenate(all_seqs)
    y_seq = np.concatenate(all_seq_labels)
    # Shuffle
    idx = rng.permutation(len(X_seq))
    X_seq, y_seq = X_seq[idx], y_seq[idx]
    np.savez_compressed(DATA_DIR / "vibration_sequences.npz", X=X_seq, y=y_seq)
    print(f"  Saved vibration_sequences.npz — X{X_seq.shape}, y{y_seq.shape}")

    # ── Build spectrograms ──
    print("\n[3/4] Building spectrograms for CNN…")
    all_specs, all_spec_labels = [], []
    for label, sigs in all_signals.items():
        for sig in sigs:
            specs, lbls = signal_to_spectrograms(sig, label)
            all_specs.append(specs)
            all_spec_labels.append(lbls)

    X_spec = np.concatenate(all_specs)
    y_spec = np.concatenate(all_spec_labels)
    idx2 = rng.permutation(len(X_spec))
    X_spec, y_spec = X_spec[idx2], y_spec[idx2]
    np.savez_compressed(DATA_DIR / "spectrograms.npz", X=X_spec, y=y_spec)
    print(f"  Saved spectrograms.npz — X{X_spec.shape}, y{y_spec.shape}")

    # ── Save normal frames for Isolation Forest ──
    print("\n[4/4] Saving normal frames for Isolation Forest…")
    X_normal = np.array(normal_frames, dtype=np.float32)
    np.savez_compressed(DATA_DIR / "isolation_normal.npz", X=X_normal)
    print(f"  Saved isolation_normal.npz — X{X_normal.shape}")

    print("\n✅ Data preparation complete.")
    print(f"   Data directory: {DATA_DIR}")


if __name__ == "__main__":
    main()
