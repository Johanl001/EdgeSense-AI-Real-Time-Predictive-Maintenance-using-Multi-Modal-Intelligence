FROM python:3.10-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the app code
COPY . .

# Set default port
ENV PORT=8000

# Run the backend using the PORT environment variable
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT
