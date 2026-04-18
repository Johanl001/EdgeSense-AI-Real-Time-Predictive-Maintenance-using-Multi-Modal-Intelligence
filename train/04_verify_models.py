"""
EdgeSense AI — Step 4: Verify ONNX Models
==========================================
Loads all exported ONNX models + Isolation Forest and runs
a quick smoke test to confirm they work exactly as the backend expects.

Run AFTER steps 01, 02, 03:
    python train/04_verify_models.py

Expected output: all checks print ✅
"""

import json
import pickle
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent.parent
MODEL_DIR = ROOT / "backend" / "app" / "models"

FAULT_CLASSES = ["Normal", "Bearing Fault", "Unbalance", "Misalignment"]

print("=" * 60)
print("EdgeSense AI — ONNX Model Verification")
print("=" * 60)


def load_onnx(name: str):
    try:
        import onnxruntime as ort
        path = MODEL_DIR / name
        if not path.exists():
            print(f"  ✗ {name} NOT FOUND — run training scripts first")
            return None
        sess = ort.InferenceSession(str(path))
        print(f"  ✓ {name} loaded")
        return sess
    except ImportError:
        print("  ✗ onnxruntime not installed. Run: pip install onnxruntime")
        return None


def check_cnn(sess):
    print("\n[CNN Audio] Smoke test…")
    dummy = np.zeros((1, 1, 128, 63), dtype=np.float32)
    out = sess.run(None, {"spectrogram": dummy})[0]
    assert out.shape == (1, 4), f"Expected (1,4), got {out.shape}"
    probs = np.exp(out) / np.exp(out).sum(axis=1, keepdims=True)
    pred = int(np.argmax(probs))
    print(f"  Input : (1, 1, 128, 63) — log-mel spectrogram")
    print(f"  Output: {out.shape} — logits")
    print(f"  Probs : {np.round(probs[0], 3)}")
    print(f"  Pred  : {FAULT_CLASSES[pred]}")
    print("  ✅ CNN OK")


def check_lstm(sess):
    print("\n[LSTM Vibration] Smoke test…")
    dummy = np.zeros((1, 10, 6), dtype=np.float32)
    out = sess.run(None, {"vibration_seq": dummy})[0]
    assert out.shape == (1, 4), f"Expected (1,4), got {out.shape}"
    probs = np.exp(out) / np.exp(out).sum(axis=1, keepdims=True)
    pred = int(np.argmax(probs))
    print(f"  Input : (1, 10, 6) — vibration feature sequence")
    print(f"  Output: {out.shape} — logits")
    print(f"  Probs : {np.round(probs[0], 3)}")
    print(f"  Pred  : {FAULT_CLASSES[pred]}")
    print("  ✅ LSTM OK")


def check_isolation_forest():
    print("\n[Isolation Forest] Smoke test…")
    iso_path = MODEL_DIR / "isolation_forest.pkl"
    if not iso_path.exists():
        print("  ✗ isolation_forest.pkl NOT FOUND")
        return
    with open(iso_path, "rb") as f:
        iso = pickle.load(f)
    # Normal-ish features: rms=0.3, peak=0.6, kurtosis=3.0, skew=0.0, crest=2.0, freq=60.0
    normal_feat = np.array([[0.3, 0.6, 3.0, 0.0, 2.0, 60.0]], dtype=np.float32)
    # Faulty features: high kurtosis
    fault_feat  = np.array([[0.8, 2.5, 11.0, 1.8, 5.0, 120.0]], dtype=np.float32)
    normal_score = float(iso.score_samples(normal_feat)[0])
    fault_score  = float(iso.score_samples(fault_feat)[0])
    print(f"  Normal feature score : {normal_score:.4f}  (higher = more normal)")
    print(f"  Fault  feature score : {fault_score:.4f}  (lower = more anomalous)")
    print("  ✅ Isolation Forest OK")


def check_scaler():
    print("\n[LSTM Scaler] Checking…")
    path = MODEL_DIR / "lstm_scaler.json"
    if not path.exists():
        print("  ✗ lstm_scaler.json NOT FOUND")
        return
    with open(path) as f:
        sc = json.load(f)
    assert len(sc["mean"]) == 6, "Expected 6 feature means"
    assert len(sc["scale"]) == 6
    print(f"  Feature names : {sc['feature_names']}")
    print(f"  Means         : {[round(m, 4) for m in sc['mean']]}")
    print(f"  Scales        : {[round(s, 4) for s in sc['scale']]}")
    print("  ✅ Scaler JSON OK")


def check_cnn_norm():
    print("\n[CNN Norm Stats] Checking…")
    path = MODEL_DIR / "cnn_norm_stats.json"
    if not path.exists():
        print("  ✗ cnn_norm_stats.json NOT FOUND")
        return
    with open(path) as f:
        ns = json.load(f)
    print(f"  Mean (scalar): {ns['mean']}")
    print(f"  Std  (scalar): {ns['std']}")
    print("  ✅ CNN norm stats OK")


def list_model_files():
    print("\n[Model Directory Listing]")
    if not MODEL_DIR.exists():
        print(f"  ✗ {MODEL_DIR} does not exist — run training scripts first")
        return
    files = sorted(MODEL_DIR.iterdir())
    if not files:
        print("  ✗ Directory is empty")
        return
    for f in files:
        size_kb = f.stat().st_size / 1024
        print(f"  {f.name:<35}  {size_kb:>8.1f} KB")


def main():
    list_model_files()

    print("\n[Loading ONNX sessions…]")
    cnn_sess  = load_onnx("cnn_audio.onnx")
    lstm_sess = load_onnx("lstm_vibration.onnx")

    if cnn_sess:
        check_cnn(cnn_sess)
    if lstm_sess:
        check_lstm(lstm_sess)

    check_isolation_forest()
    check_scaler()
    check_cnn_norm()

    print("\n" + "=" * 60)
    print("Verification complete.")
    print("If all checks show ✅, the backend will load models automatically.")
    print(f"Models are in: {MODEL_DIR}")
    print("=" * 60)


if __name__ == "__main__":
    main()
