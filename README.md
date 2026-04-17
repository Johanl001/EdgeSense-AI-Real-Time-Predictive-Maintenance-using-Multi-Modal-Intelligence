# EdgeSense AI

Real-Time Predictive Maintenance using Multi-Modal Intelligence. Hackathon Edition 2026.

## Structure

- `/backend`: FastAPI Python server handling WebSocket streams, mock AI engine, and real-time telemetry ingestion.
- `/frontend`: React + Vite + Tailwind CSS dashboard visualizing real-time metrics and SHAP explainability.
- `/firmware`: Embedded ESP32 PlatformIO codebase that connects to microphones and MPU6050 vibration sensors.

## Running Locally

1. **Backend**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # or venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   uvicorn app.main:app --reload
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Demo Mode

To run a simulation without an ESP32 connected:
1. Start both servers.
2. Open the React frontend `http://localhost:5173`.
3. Click "Start Simulation" to activate auto-stream generation and occasionally inject faults.
