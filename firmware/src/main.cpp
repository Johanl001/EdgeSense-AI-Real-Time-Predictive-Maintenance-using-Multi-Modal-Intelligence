#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "WIFI_SSID";
const char* password = "WIFI_PASSWORD";
const char* serverUrl = "http://192.168.x.x:8000/api/predict";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // Simulated payload since this is a stub
    String jsonPayload = "{\"vibration\":{\"rms\":0.05,\"peak\":0.1,\"kurtosis\":3.2,\"crest_factor\":2.0,\"dominant_freq\":50.0},\"audio\":{\"mfcc\":[0,0,0,0,0,0,0,0,0,0,0,0,0],\"spectral_centroid\":1000.0}}";
    
    int httpResponseCode = http.POST(jsonPayload);
    Serial.println(httpResponseCode);
    http.end();
  }
  delay(2000);
}
