#include <Arduin
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

struct VibData { float rms, peak, kurtosis, crest_factor, dominant_freq; };

// ── Config ──────────────────────────────────────────────
const char* ssid       = "your hotspot name";
const char* password   = "your hotspot password";
const char* serverUrl  = "http://[IP_ADDRESS]/api/predict";

#define MIC_PIN        34
#define SAMPLES        512      // samples per audio window
#define SAMPLE_RATE_US 125      // ~8kHz (125µs between samples)
#define USE_MPU6050    false    // set true when MPU6050 is physically connected

#if USE_MPU6050
  #include <MPU6050.h>
  MPU6050 mpu;
#endif

// ── Globals ─────────────────────────────────────────────
float audioBuffer[SAMPLES];

// ── Audio helpers ────────────────────────────────────────
void captureAudio() {
  for (int i = 0; i < SAMPLES; i++) {
    audioBuffer[i] = analogRead(MIC_PIN);
    delayMicroseconds(SAMPLE_RATE_US);
  }
}

float computeAudioRMS() {
  float mean = 0;
  for (int i = 0; i < SAMPLES; i++) mean += audioBuffer[i];
  mean /= SAMPLES;

  float sum = 0;
  for (int i = 0; i < SAMPLES; i++) {
    float diff = audioBuffer[i] - mean;
    sum += diff * diff;
  }
  return sqrt(sum / SAMPLES);
}

// Simple 13 pseudo-MFCC bands from the audio buffer
// Divides buffer into 13 equal bands, computes energy of each
void computePseudoMFCC(float* mfcc) {
  int bandSize = SAMPLES / 13;
  for (int b = 0; b < 13; b++) {
    float energy = 0;
    int start = b * bandSize;
    for (int i = start; i < start + bandSize; i++) {
      energy += audioBuffer[i] * audioBuffer[i];
    }
    mfcc[b] = sqrt(energy / bandSize) / 4096.0; // normalise 0-1
  }
}

float computeSpectralCentroid() {
  // Weighted mean of sample index (rough frequency proxy)
  float weightedSum = 0, totalEnergy = 0;
  for (int i = 0; i < SAMPLES; i++) {
    float e = audioBuffer[i] * audioBuffer[i];
    weightedSum  += i * e;
    totalEnergy  += e;
  }
  if (totalEnergy < 1.0) return 0;
  return (weightedSum / totalEnergy) * (8000.0 / SAMPLES); // map to Hz
}

// ── Vibration helpers ────────────────────────────────────
// Returns synthetic realistic vibration data for demo when MPU is absent

VibData getVibration() {
  VibData v;

#if USE_MPU6050
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);
  float ax_g = ax / 16384.0;
  float ay_g = ay / 16384.0;
  float az_g = az / 16384.0;
  v.rms          = sqrt((ax_g*ax_g + ay_g*ay_g + az_g*az_g) / 3.0);
  v.peak         = max({abs(ax_g), abs(ay_g), abs(az_g)});
  v.kurtosis     = 3.0;   // would need window buffer for real kurtosis
  v.crest_factor = (v.rms > 0) ? (v.peak / v.rms) : 1.0;
  v.dominant_freq = 50.0;
#else
  // Synthetic normal machine vibration with slight noise
  float t = millis() / 1000.0;
  v.rms          = 0.30 + 0.04 * sin(t * 0.7) + (random(-10, 10) / 1000.0);
  v.peak         = v.rms * 1.8 + 0.05;
  v.kurtosis     = 3.1 + 0.2 * sin(t * 0.3);  // near 3 = healthy
  v.crest_factor = v.peak / v.rms;
  v.dominant_freq = 50.0 + 2.0 * sin(t * 0.5);
#endif

  return v;
}

// ── Setup ────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db); // allows full 0-3.3V range on GPIO34

  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());

#if USE_MPU6050
  Wire.begin(21, 22);
  mpu.initialize();
  if (mpu.testConnection()) {
    Serial.println("MPU6050 OK");
  } else {
    Serial.println("MPU6050 FAILED — check wiring");
  }
#else
  Serial.println("Running in SYNTHETIC vibration mode (no MPU6050)");
#endif
}

// ── Main loop ────────────────────────────────────────────
void loop() {
  // 1. Capture audio window (~64ms at 8kHz)
  captureAudio();

  float audioRMS    = computeAudioRMS();
  float mfcc[13];
  computePseudoMFCC(mfcc);
  float spectralCentroid = computeSpectralCentroid();

  // 2. Get vibration (real or synthetic)
  VibData vib = getVibration();

  // 3. Serial debug
  Serial.printf("Audio RMS: %.1f | Centroid: %.1fHz | Vib RMS: %.3fg | Kurt: %.2f\n",
                audioRMS, spectralCentroid, vib.rms, vib.kurtosis);

  // 4. Send to backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(3000); // 3 second timeout — don't hang forever

    StaticJsonDocument<1024> doc;

    JsonObject vibObj = doc.createNestedObject("vibration");
    vibObj["rms"]          = round(vib.rms * 1000) / 1000.0;
    vibObj["peak"]         = round(vib.peak * 1000) / 1000.0;
    vibObj["kurtosis"]     = round(vib.kurtosis * 100) / 100.0;
    vibObj["crest_factor"] = round(vib.crest_factor * 100) / 100.0;
    vibObj["dominant_freq"]= round(vib.dominant_freq * 10) / 10.0;

    JsonObject audioObj = doc.createNestedObject("audio");
    JsonArray mfccArr   = audioObj.createNestedArray("mfcc");
    for (int i = 0; i < 13; i++) {
      mfccArr.add(round(mfcc[i] * 1000) / 1000.0);
    }
    audioObj["spectral_centroid"] = round(spectralCentroid * 10) / 10.0;
    audioObj["rms"]               = round(audioRMS * 10) / 10.0;

    String payload;
    serializeJson(doc, payload);

    int code = http.POST(payload);
    if (code > 0) {
      Serial.printf("POST OK: %d | Response: %s\n", code, http.getString().c_str());
    } else {
      Serial.printf("POST FAILED: %s\n", http.errorToString(code).c_str());
    }
    http.end();
  } else {
    Serial.println("WiFi lost — reconnecting...");
    WiFi.reconnect();
  }

  delay(2000); // 2s between sends
}