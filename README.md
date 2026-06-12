# EdgeSense AI 🏭⚡

<img width="1871" height="873" alt="Screenshot 2026-04-21 192311" src="https://github.com/user-attachments/assets/fed21397-f8c1-44d9-a2fa-fd94c4d29161" />

<img width="1706" height="837" alt="Screenshot 2026-04-20 134311" src="https://github.com/user-attachments/assets/a6baa758-8d8a-4f5b-b6a7-f1dec300e1c5" />

### 🌐 [Live Demo Dashboard](https://edge-sense-ai-real-time-predictive.vercel.app/) | 🔌 [Backend API Docs](https://edgesense-api.onrender.com/docs)

**Real-Time Predictive Maintenance using Multi-Modal Intelligence.**

EdgeSense AI is a complete, end-to-end hardware-to-UI machine learning platform designed to predict industrial machine failure *before* it happens. By simultaneously monitoring acoustic telemetry and 3-axis vibration metrics directly from the edge, this system streams multi-modal intelligence to a high-performance visual dashboard via WebSockets.

---

## 🌟 Key Features

*   **Multi-Modal ML Intelligence:** Combines an Acoustic CNN with a Vibration LSTM to generate highly-confident predictive maintenance scores and isolate anomalous machinery behavior.
*   **Real-time Telemetry Dashboard:** A stunning, ultra-modern Next.js application that renders real-time streaming signals at sub-10ms latency using Live WebSockets.
*   **Optimized Edge Inference:** Uses `onnxruntime` for high-speed prediction on resource-constrained environments (successfully deployed on Render Free Tier).
*   **Actionable Alerts & CSV Export:** Generates critical fault warnings mapped to specific bearing/motor defects and allows an instant snapshot export of fleet health via CSV.
*   **Dockerized Deployment:** Ready-to-go Docker configuration for local development and cloud-native scaling.
*   **Custom Training Pipeline:** A full end-to-end Python pipeline to normalize, train, and export PyTorch models into performant ONNX artifacts.

---

## 📂 Codebase Architecture

The project is decoupled into clear, standalone domains:

*   **`/next_frontend`** — A React + Next.js (+ Tailwind CSS / Framer Motion) futuristic visualization dashboard. Deployed on **Vercel**.
*   **`/backend`** — A FastAPI Python server handling WebSocket streams, ONNX inference, and SQLite history. Deployed on **Render**.
*   **`/train`** — ML Pipeline for data preparation and PyTorch-to-ONNX training.
*   **`/firmware`** — Embedded C++ (PlatformIO) code for ESP32 devices attached to physical sensors.

---

## 🚀 Live Deployment

The application is currently live and can be accessed via the following links:

*   **Frontend (Dashboard):** [https://edge-sense-ai-real-time-predictive.vercel.app/](https://edge-sense-ai-real-time-predictive.vercel.app/)
*   **Backend (API & WebSockets):** [https://edgesense-api.onrender.com](https://edgesense-api.onrender.com)
*   **Interactive API Documentation:** [https://edgesense-api.onrender.com/docs](https://edgesense-api.onrender.com/docs)

---

## 💻 Local Development

The easiest way to run the entire stack locally is via Docker.

### Launch with Docker
```bash
docker-compose up --build
```
*   **Frontend:** `http://localhost:3000`
*   **Backend:** `http://localhost:8000`

### Hardware Integration
To connect physical ESP32 hardware to the live backend, update the `serverUrl` in `firmware/src/main.cpp`:
```cpp
const char* serverUrl = "https://edgesense-api.onrender.com/api/predict";
```

---

## 🧠 Training Your Own Models

1. Place your raw matrices or `.npz` files inside `train/data/`.
2. Run the master PowerShell script:
   ```powershell
   ./run_training.ps1
   ```
3. The script will train the models, convert them to ONNX, and update the backend models automatically.

--- 

*Built with ❤️ for the 2026 Engineering Hackathon. Let's eliminate unplanned downtime forever.*
