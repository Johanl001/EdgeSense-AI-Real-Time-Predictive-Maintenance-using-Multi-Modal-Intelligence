# EdgeSense AI Training Pipeline Script
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting EdgeSense AI Training Pipeline" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Step 1
Write-Host "`n[1/5] Installing Dependencies..." -ForegroundColor Yellow
pip install -r train/requirements_train.txt
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to install dependencies!" -ForegroundColor Red; exit }

# Step 2
Write-Host "`n[2/5] Preparing Data (CWRU Downloads & Synthetics)..." -ForegroundColor Yellow
python train/01_prepare_data.py
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to prepare data!" -ForegroundColor Red; exit }

# Step 3
Write-Host "`n[3/5] Training CNN Audio Model (This may take 15-40 min)..." -ForegroundColor Yellow
python train/02_train_cnn.py
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to train CNN!" -ForegroundColor Red; exit }

# Step 4
Write-Host "`n[4/5] Training LSTM & Isolation Forest Vibration Models..." -ForegroundColor Yellow
python train/03_train_lstm.py
if ($LASTEXITCODE -ne 0) { Write-Host "Failed to train LSTM!" -ForegroundColor Red; exit }

# Step 5
Write-Host "`n[5/5] Verifying ONNX Models..." -ForegroundColor Yellow
python train/04_verify_models.py
if ($LASTEXITCODE -ne 0) { Write-Host "Model verification failed!" -ForegroundColor Red; exit }

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "SUCCESS: All AI models have been trained and exported!" -ForegroundColor Green
Write-Host "You can now run 'docker-compose up --build' to use real ONNX inference." -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
