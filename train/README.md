# EdgeSense AI — Model Training Guide

## Do You Need to Train Models?

**YES.** Your `main.py` backend tries to load ONNX models at startup:

```python
cnn_path  = MODEL_DIR / "cnn_audio.onnx"
lstm_path = MODEL_DIR / "lstm_vibration.onnx"
```

Without them, it falls back to the heuristic mode (which still works for demo),
but for real accuracy (>90% F1 as stated in the project plan) you need trained models.

---

## Exact Folder Structure Required

```
edgesense-ai/                        ← repo root
├── backend/
│   └── app/
│       ├── main.py
│       └── models/                  ← ✅ BACKEND READS FROM HERE
│           ├── cnn_audio.onnx
│           ├── lstm_vibration.onnx
│           ├── isolation_forest.pkl
│           ├── lstm_scaler.json
│           └── cnn_norm_stats.json
├── train/                           ← run scripts from here
│   ├── requirements_train.txt
│   ├── 01_prepare_data.py
│   ├── 02_train_cnn.py
│   ├── 03_train_lstm.py
│   ├── 04_verify_models.py
│   └── data/                        ← auto-created, gitignore this
│       ├── cwru_raw/
│       ├── vibration_sequences.npz
│       ├── spectrograms.npz
│       └── isolation_normal.npz
└── docker-compose.yml
```

---

## Step-by-Step Training

### 1. Install training dependencies
```bash
cd edgesense-ai/
pip install -r train/requirements_train.txt
```

### 2. Prepare data (downloads CWRU + generates synthetic)
```bash
python train/01_prepare_data.py
```
- Downloads CWRU bearing dataset (~50MB, 4 .mat files) automatically
- If CWRU download fails (network issues), synthetic data is generated as fallback
- Generates `data/vibration_sequences.npz`, `data/spectrograms.npz`, `data/isolation_normal.npz`

### 3. Train the CNN (audio spectrogram model)
```bash
python train/02_train_cnn.py
```
- Trains 4-layer CNN for 50 epochs
- Exports `backend/app/models/cnn_audio.onnx`
- Saves `backend/app/models/cnn_norm_stats.json`
- Expected accuracy: >88% on validation set

### 4. Train the LSTM + Isolation Forest (vibration model)
```bash
python train/03_train_lstm.py
```
- Trains 2-layer LSTM for 60 epochs
- Trains Isolation Forest (unsupervised anomaly detector)
- Exports `backend/app/models/lstm_vibration.onnx`
- Saves `backend/app/models/isolation_forest.pkl`
- Saves `backend/app/models/lstm_scaler.json`
- Expected accuracy: >90% on validation set

### 5. Verify everything works
```bash
python train/04_verify_models.py
```
All checks should show ✅. If they do, your backend will automatically
switch from heuristic mode to real ONNX inference.

---

## Training Time Estimates

| Script | CPU (no GPU) | GPU (RTX 3060+) |
|--------|-------------|-----------------|
| 01_prepare_data.py | ~2–5 min | same |
| 02_train_cnn.py | ~15–40 min | ~3–8 min |
| 03_train_lstm.py | ~5–15 min | ~2–4 min |
| 04_verify_models.py | <30 sec | same |

---

## Model Descriptions

### cnn_audio.onnx
- **Input**: `spectrogram` — shape `(batch, 1, 128, 63)` — log-mel spectrogram
- **Output**: `logits` — shape `(batch, 4)` — class logits
- **Classes**: `[Normal, Bearing Fault, Unbalance, Misalignment]`
- **Architecture**: Conv2D(32)→Conv2D(64)→Conv2D(128)→Conv2D(256)→GAP→Dense(128)→Dense(4)

### lstm_vibration.onnx
- **Input**: `vibration_seq` — shape `(batch, 10, 6)` — 10 timesteps of 6 vibration features
- **Output**: `logits` — shape `(batch, 4)` — class logits
- **Features** (in order): `[rms, peak, kurtosis, skewness, crest_factor, dominant_freq]`
- **Architecture**: LSTM(64)→LSTM(32)→Dense(64)→Dense(32)→Dense(4)

### isolation_forest.pkl
- **Input**: shape `(n, 6)` — raw vibration features (same 6 as LSTM)
- **Output**: anomaly scores (negative = more anomalous)
- Used alongside LSTM for unsupervised anomaly weighting

### lstm_scaler.json
- Mean and standard deviation for normalising LSTM input features
- Backend must apply this before feeding data to the LSTM

### cnn_norm_stats.json
- Mean and std for normalising spectrogram input
- Backend must apply this before feeding to CNN

---

## Where the Backend Reads Models From

In `backend/app/main.py`:

```python
BASE_DIR = Path(__file__).parent          # = backend/app/
MODEL_DIR = BASE_DIR / "models"           # = backend/app/models/
```

So inside Docker, the path is `/app/app/models/` — this is why the training
scripts automatically save to `backend/app/models/` in your repo.

---

## Notes

- **No GPU required** — training runs on CPU, just takes longer
- **Synthetic fallback** — if CWRU downloads fail, synthetic physics-informed
  data is used. Models still work but may have lower real-world accuracy.
- **gitignore `train/data/`** — it's large (~500MB). Only commit the `.onnx` / `.pkl` files.
- **Re-training** — just re-run scripts 01→04 in order. Old files are overwritten.
