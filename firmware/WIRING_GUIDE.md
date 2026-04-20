# EdgeSense AI: Hardware Wiring Guide

This document outlines the correct physical connections between the ESP32 microcontroller, the MPU6050 Vibration Sensor, and the INMP441 I2S Digital Microphone.

## Components Required
1.  **ESP32 Development Board** (NodeMCU-32S, ESP32-WROOM, etc.)
2.  **MPU6050** (3-Axis Accelerometer and Gyroscope module)
3.  **INMP441** (Omnidirectional I2S Digital Microphone module)
4.  Jumper wires and a breadboard.

---

## 🏗️ 1. Power Distribution
Both sensors require roughly 3.3V power. The ESP32 logic level is 3.3V. **Do not power the INMP441 with 5V**, as it will damage the sensor. 

If your ESP32 has multiple `3V3` pins, use them. If not, connect the ESP32 `3.3V` pin to the red positive power rail of your breadboard, and the ESP32 `GND` to the black/blue negative rail, then power both sensors from the rails.

| ESP32 Pin | Component Pin | Purpose |
| :--- | :--- | :--- |
| **3.3V (3V3)** | MPU6050 `VCC` | Power for Vibration Sensor |
| **3.3V (3V3)** | INMP441 `VDD` | Power for Microphone |
| **GND** | MPU6050 `GND` | Ground for MPU6050 |
| **GND** | INMP441 `GND` | Ground for Microphone |
| **GND** | INMP441 `L/R` | Channel Select (Grounding sets to Left Channel) |

---

## 📳 2. MPU6050 Wiring (I2C)
The vibration sensor uses the I2C protocol. We use the default hardware I2C pins on the ESP32.

| ESP32 Pin | MPU6050 Pin | Description |
| :--- | :--- | :--- |
| **GPIO 22** | `SCL` | I2C Serial Clock |
| **GPIO 21** | `SDA` | I2C Serial Data |

*(Note: The other pins on the MPU6050 like XDA, XCL, ADD, and INT are not strictly required for standard polling.)*

---

## 🎤 3. INMP441 Microphone (I2S)
The microphone uses the I2S digital audio protocol, which requires careful timing pins.

| ESP32 Pin | INMP441 Pin | Description |
| :--- | :--- | :--- |
| **GPIO 14** | `SCK` | Serial Clock (Bit Clock / BCLK) |
| **GPIO 15** | `WS` | Word Select (Left/Right Clock / LRCLK) |
| **GPIO 32** | `SD` | Serial Data (Audio Output) |

---

## 📝 Configuration Checklist

- [ ] Check that `L/R` on the microphone is tied to `GND`. If left floating, the microphone will not output reliable data.
- [ ] Check that both sensors are powered from a **3.3V** source and NOT the `VIN`/`5V` pin.
- [ ] Ensure the grounds of the ESP32, MPU6050, and INMP441 are all tied together.
- [ ] Ensure jumper wires, especially for the I2S microphone (WS, SCK, SD), are kept relatively short to prevent signal degradation and clock noise.
