#include <Wire.h>
#include <MPU6050.h>

MPU6050 mpu;

// MAX4466 pin
#define MIC_PIN 34  

void setup() {
  Serial.begin(115200);

  // Initialize I2C
  Wire.begin(21, 22);

  // Initialize MPU6050
  mpu.init  ialize();

  if (mpu.testConnection()) {
    Serial.println("MPU6050 connected");
  } else {
    Serial.println("MPU6050 connection failed");
  }

  // Analog setup
  analogReadResolution(12); // 0–4095
}

void loop() {
  // --------- MPU6050 DATA ----------
  int16_t ax, ay, az;
  mpu.getAcceleration(&ax, &ay, &az);

  Serial.print("Vibration -> ");
  Serial.print("AX: "); Serial.print(ax);
  Serial.print(" AY: "); Serial.print(ay);
  Serial.print(" AZ: "); Serial.print(az);

  // --------- MICROPHONE DATA ----------
  int micValue = analogRead(MIC_PIN);

  Serial.print(" | Sound Level: ");
  Serial.println(micValue);

  delay(200);
}