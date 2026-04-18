"""
EdgeSense AI — Step 3: Train Vibration LSTM
=============================================
Trains a 2-layer LSTM on vibration feature sequences.
Input shape: (batch, 10, 6) — 10 timesteps, 6 features per step.
Also trains the sklearn Isolation Forest on normal-only data.

Exports:
  backend/app/models/lstm_vibration.onnx
  backend/app/models/isolation_forest.pkl
  backend/app/models/lstm_scaler.json

Run: python train/03_train_lstm.py
"""

import json
import pickle
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from torch.utils.data import DataLoader, TensorDataset, random_split

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "train" / "data"
MODEL_OUT = ROOT / "backend" / "app" / "models"
MODEL_OUT.mkdir(parents=True, exist_ok=True)

NUM_CLASSES = 4
SEQ_LEN = 10
N_FEATURES = 6     # rms, peak, kurtosis, skewness, crest_factor, dominant_freq
EPOCHS = 60
BATCH = 64
LR = 1e-3
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print("=" * 60)
print(f"EdgeSense AI — Vibration LSTM Training  ({DEVICE})")
print("=" * 60)


# ──────────────────────────────────────────────
# Model Definition
# LSTM(64)→LSTM(32)→Dense(64)→Dense(32)→Dense(4)
# ──────────────────────────────────────────────
class VibrationLSTM(nn.Module):
    def __init__(self, input_size=6, num_classes=4):
        super().__init__()
        self.lstm1 = nn.LSTM(input_size, 64, batch_first=True, dropout=0.3)
        self.lstm2 = nn.LSTM(64, 32, batch_first=True)
        self.head = nn.Sequential(
            nn.Linear(32, 64),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, num_classes),
        )
        self.embedding_dim = 32   # matches fusion concat in project plan

    def forward(self, x):
        # x: (batch, seq_len, features)
        out, _ = self.lstm1(x)
        out, _ = self.lstm2(out)
        last = out[:, -1, :]      # take last timestep
        return self.head(last)

    def embed(self, x):
        """Returns 32-d embedding (before final classifier head)."""
        out, _ = self.lstm1(x)
        out, _ = self.lstm2(out)
        last = out[:, -1, :]
        last = self.head[0](last)   # Linear(32→64)
        last = self.head[1](last)   # ReLU
        last = self.head[3](last)   # Linear(64→32)
        last = self.head[4](last)   # ReLU
        return last


# ──────────────────────────────────────────────
# Data helpers
# ──────────────────────────────────────────────
def load_data():
    npz = np.load(DATA_DIR / "vibration_sequences.npz")
    X = npz["X"].astype(np.float32)    # (N, 10, 6)
    y = npz["y"].astype(np.int64)
    print(f"  Loaded vibration_sequences: X={X.shape}, y={y.shape}")
    print(f"  Class dist: { {i: int((y==i).sum()) for i in range(NUM_CLASSES)} }")
    return X, y


def fit_scaler(X: np.ndarray):
    """Fit StandardScaler over the feature axis (last dim)."""
    flat = X.reshape(-1, N_FEATURES)
    sc = StandardScaler()
    sc.fit(flat)
    return sc


def apply_scaler(X: np.ndarray, sc: StandardScaler) -> np.ndarray:
    flat = X.reshape(-1, N_FEATURES)
    scaled = sc.transform(flat)
    return scaled.reshape(X.shape)


def train_one_epoch(model, loader, optimizer, criterion):
    model.train()
    total_loss, correct, n = 0, 0, 0
    for X_batch, y_batch in loader:
        X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
        optimizer.zero_grad()
        logits = model(X_batch)
        loss = criterion(logits, y_batch)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        total_loss += loss.item() * len(y_batch)
        correct += (logits.argmax(1) == y_batch).sum().item()
        n += len(y_batch)
    return total_loss / n, correct / n


@torch.no_grad()
def evaluate(model, loader, criterion):
    model.eval()
    total_loss, correct, n = 0, 0, 0
    for X_batch, y_batch in loader:
        X_batch, y_batch = X_batch.to(DEVICE), y_batch.to(DEVICE)
        logits = model(X_batch)
        loss = criterion(logits, y_batch)
        total_loss += loss.item() * len(y_batch)
        correct += (logits.argmax(1) == y_batch).sum().item()
        n += len(y_batch)
    return total_loss / n, correct / n


# ──────────────────────────────────────────────
# Isolation Forest
# ──────────────────────────────────────────────
def train_isolation_forest():
    print("\n[IF] Training Isolation Forest on normal-only frames…")
    npz = np.load(DATA_DIR / "isolation_normal.npz")
    X_normal = npz["X"]                       # (N, 6)
    iso = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )
    iso.fit(X_normal)
    # Quick self-eval
    scores = iso.score_samples(X_normal)
    print(f"  Normal score — mean={scores.mean():.3f}  min={scores.min():.3f}")
    out = MODEL_OUT / "isolation_forest.pkl"
    with open(out, "wb") as f:
        pickle.dump(iso, f, protocol=4)
    print(f"  ✅ Saved → {out}")
    return iso


# ──────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────
def main():
    print("\n[1/5] Loading data…")
    X_raw, y = load_data()

    print("\n[2/5] Fitting scaler…")
    scaler = fit_scaler(X_raw)
    X = apply_scaler(X_raw, scaler)
    # Persist scaler as JSON (mean + scale)
    scaler_stats = {
        "mean": scaler.mean_.tolist(),
        "scale": scaler.scale_.tolist(),
        "feature_names": ["rms", "peak", "kurtosis", "skewness", "crest_factor", "dominant_freq"],
    }
    with open(MODEL_OUT / "lstm_scaler.json", "w") as f:
        json.dump(scaler_stats, f, indent=2)
    print("  Scaler saved → lstm_scaler.json")

    X_t = torch.tensor(X, dtype=torch.float32)
    y_t = torch.tensor(y, dtype=torch.long)
    dataset = TensorDataset(X_t, y_t)
    n_train = int(0.8 * len(dataset))
    n_val   = int(0.1 * len(dataset))
    n_test  = len(dataset) - n_train - n_val
    train_ds, val_ds, test_ds = random_split(
        dataset, [n_train, n_val, n_test],
        generator=torch.Generator().manual_seed(42)
    )
    train_loader = DataLoader(train_ds, batch_size=BATCH, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH, shuffle=False, num_workers=0)
    test_loader  = DataLoader(test_ds,  batch_size=BATCH, shuffle=False, num_workers=0)

    print("\n[3/5] Training LSTM…")
    model = VibrationLSTM(N_FEATURES, NUM_CLASSES).to(DEVICE)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)

    best_val_acc, best_state = 0.0, None
    for epoch in range(1, EPOCHS + 1):
        tr_loss, tr_acc = train_one_epoch(model, train_loader, optimizer, criterion)
        vl_loss, vl_acc = evaluate(model, val_loader, criterion)
        scheduler.step(vl_loss)
        if vl_acc > best_val_acc:
            best_val_acc = vl_acc
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        if epoch % 10 == 0 or epoch == 1:
            print(f"  Epoch {epoch:3d}/{EPOCHS}  "
                  f"train_acc={tr_acc:.3f}  val_acc={vl_acc:.3f}  "
                  f"best={best_val_acc:.3f}  lr={optimizer.param_groups[0]['lr']:.2e}")

    model.load_state_dict(best_state)
    _, test_acc = evaluate(model, test_loader, criterion)
    print(f"\n  Test accuracy: {test_acc:.4f}")

    print("\n[4/5] Exporting LSTM to ONNX…")
    model.eval()
    dummy = torch.zeros(1, SEQ_LEN, N_FEATURES).to(DEVICE)
    onnx_path = MODEL_OUT / "lstm_vibration.onnx"
    import torch.onnx.utils as onnx_utils
    onnx_utils.export(
        model, dummy, str(onnx_path),
        input_names=["vibration_seq"],
        output_names=["logits"],
        dynamic_axes={"vibration_seq": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=14,
    )
    print(f"  ✅ Saved → {onnx_path}")

    print("\n[5/5] Training Isolation Forest…")
    train_isolation_forest()

    print(f"\n✅ All models saved to: {MODEL_OUT}")
    print(f"   Best val accuracy : {best_val_acc:.4f}")
    print(f"   Test accuracy     : {test_acc:.4f}")


if __name__ == "__main__":
    main()
