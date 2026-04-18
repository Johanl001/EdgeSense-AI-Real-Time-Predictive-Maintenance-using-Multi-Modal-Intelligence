"""
EdgeSense AI — Step 2: Train Audio CNN
========================================
Trains a 4-layer CNN on log-mel spectrograms (128×63).
Exports the trained model to ONNX for backend inference.

Input:  train/data/spectrograms.npz
Output: backend/app/models/cnn_audio.onnx

Run: python train/02_train_cnn.py
"""

import json
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader, TensorDataset, random_split

# ──────────────────────────────────────────────
# Paths
# ──────────────────────────────────────────────
ROOT = Path(__file__).parent.parent
DATA_DIR = ROOT / "train" / "data"
MODEL_OUT = ROOT / "backend" / "app" / "models"
MODEL_OUT.mkdir(parents=True, exist_ok=True)

NUM_CLASSES = 4   # Normal, Bearing Fault, Unbalance, Misalignment
EPOCHS = 50
BATCH = 32
LR = 1e-3
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

print("=" * 60)
print(f"EdgeSense AI — Audio CNN Training  ({DEVICE})")
print("=" * 60)


# ──────────────────────────────────────────────
# Model Definition (matches project plan exactly)
# Conv2D(32)→Conv2D(64)→Conv2D(128)→Conv2D(256)→GAP→Dense(128)
# ──────────────────────────────────────────────
class AudioCNN(nn.Module):
    def __init__(self, num_classes: int = 4):
        super().__init__()
        self.features = nn.Sequential(
            # Block 1
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),           # → (32, 64, 31)

            # Block 2
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),           # → (64, 32, 15)

            # Block 3
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(),
            nn.MaxPool2d(2, 2),           # → (128, 16, 7)

            # Block 4
            nn.Conv2d(128, 256, kernel_size=3, padding=1),
            nn.BatchNorm2d(256),
            nn.ReLU(),
            # Global Average Pooling
            nn.AdaptiveAvgPool2d(1),      # → (256, 1, 1)
        )
        self.classifier = nn.Sequential(
            nn.Flatten(),                 # → (256,)
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes),
        )
        # Embedding hook — used to extract 128-d fusion vector
        self.embedding_dim = 128

    def forward(self, x):
        x = self.features(x)
        return self.classifier(x)

    def embed(self, x):
        """Returns the 128-d embedding before the final classification head."""
        x = self.features(x)
        x = torch.flatten(x, 1)
        x = self.classifier[1](x)    # Linear(256→128)
        x = self.classifier[2](x)    # ReLU
        return x


# ──────────────────────────────────────────────
# Training helpers
# ──────────────────────────────────────────────
def load_data():
    npz = np.load(DATA_DIR / "spectrograms.npz")
    X = torch.tensor(npz["X"], dtype=torch.float32)  # (N, 1, 128, 63)
    y = torch.tensor(npz["y"], dtype=torch.long)
    print(f"  Loaded spectrograms: X={tuple(X.shape)}, y={tuple(y.shape)}")
    print(f"  Class distribution: { {i: int((y==i).sum()) for i in range(NUM_CLASSES)} }")
    return X, y


def normalize(X):
    mean = X.mean(dim=(0, 2, 3), keepdim=True)
    std  = X.std(dim=(0, 2, 3), keepdim=True) + 1e-6
    return (X - mean) / std, mean, std


def spec_augment(x: torch.Tensor) -> torch.Tensor:
    """SpecAugment: random time & freq masking."""
    x = x.clone()
    # Freq mask (up to 15 bins)
    f0 = int(torch.randint(0, x.shape[2] - 15, (1,)))
    x[:, :, f0:f0 + 15, :] = 0
    # Time mask (up to 10 frames)
    t0 = int(torch.randint(0, x.shape[3] - 10, (1,)))
    x[:, :, :, t0:t0 + 10] = 0
    return x


def train_one_epoch(model, loader, optimizer, criterion):
    model.train()
    total_loss, correct, n = 0, 0, 0
    for X_batch, y_batch in loader:
        X_batch = spec_augment(X_batch).to(DEVICE)
        y_batch = y_batch.to(DEVICE)
        optimizer.zero_grad()
        logits = model(X_batch)
        loss = criterion(logits, y_batch)
        loss.backward()
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
# MAIN
# ──────────────────────────────────────────────
def main():
    print("\n[1/4] Loading data…")
    X, y = load_data()
    X, mean, std = normalize(X)

    # Save normalisation stats — backend needs them
    norm_stats = {"mean": mean.squeeze().tolist(), "std": std.squeeze().tolist()}
    with open(MODEL_OUT / "cnn_norm_stats.json", "w") as f:
        json.dump(norm_stats, f)

    dataset = TensorDataset(X, y)
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

    print("\n[2/4] Training…")
    model = AudioCNN(NUM_CLASSES).to(DEVICE)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_val_acc, best_state = 0.0, None
    for epoch in range(1, EPOCHS + 1):
        tr_loss, tr_acc = train_one_epoch(model, train_loader, optimizer, criterion)
        vl_loss, vl_acc = evaluate(model, val_loader, criterion)
        scheduler.step()
        if vl_acc > best_val_acc:
            best_val_acc = vl_acc
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}
        if epoch % 5 == 0 or epoch == 1:
            print(f"  Epoch {epoch:3d}/{EPOCHS}  "
                  f"train_loss={tr_loss:.4f} train_acc={tr_acc:.3f}  "
                  f"val_loss={vl_loss:.4f} val_acc={vl_acc:.3f}  "
                  f"best={best_val_acc:.3f}")

    # Restore best weights
    model.load_state_dict(best_state)
    _, test_acc = evaluate(model, test_loader, criterion)
    print(f"\n  Test accuracy: {test_acc:.4f}")

    print("\n[3/4] Saving PyTorch checkpoint…")
    torch.save({"state_dict": model.state_dict(), "test_acc": test_acc}, MODEL_OUT / "cnn_audio.pt")

    print("\n[4/4] Exporting to ONNX…")
    model.eval()
    dummy = torch.zeros(1, 1, 128, 63).to(DEVICE)
    onnx_path = MODEL_OUT / "cnn_audio.onnx"
    import torch.onnx.utils as onnx_utils
    onnx_utils.export(
        model, dummy, str(onnx_path),
        input_names=["spectrogram"],
        output_names=["logits"],
        dynamic_axes={"spectrogram": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=14,
    )
    print(f"  ✅ Saved → {onnx_path}")
    print(f"  Best val accuracy : {best_val_acc:.4f}")
    print(f"  Test accuracy     : {test_acc:.4f}")


if __name__ == "__main__":
    main()
