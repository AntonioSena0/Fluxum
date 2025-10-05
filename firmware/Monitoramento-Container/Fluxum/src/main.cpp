#include <Arduino.h>
#include <Wire.h>
#include "GyverBME280.h"
#include <TinyGPS++.h>
#include <esp_task_wdt.h>
#include <WiFi.h>
#include <HTTPClient.h>

// --- CONFIGURAÇÕES DE REDE ---
const char* ssid = "wneves";
const char* password = "20437355wgrjj";
const char* serverUrl = "http://192.168.15.13:3000/api/container-events"; 

// --- Configuração dos Pinos ---
const int GPS_RX_PIN = 16, GPS_TX_PIN = 17;

// --- Objetos dos Sensores ---
GyverBME280 bme;
TinyGPSPlus gps;
HardwareSerial gpsSerial(2);

// --- Variáveis Globais para o Timer---
unsigned long previousDataMillis = 0;
const long dataInterval = 8000;

// ======================================================================
// --- FUNÇÕES AUXILIARES ---
// ======================================================================

String getDeviceId() {
  #ifdef WOKWI
    return "AA:BB:CC:DD:EE:FF";
  #else
    uint8_t baseMac[6];
    esp_read_mac(baseMac, ESP_MAC_WIFI_STA);
    char deviceId[18];
    sprintf(deviceId, "%02X:%02X:%02X:%02X:%02X:%02X", baseMac[0], baseMac[1], baseMac[2], baseMac[3], baseMac[4], baseMac[5]);
    return String(deviceId);
  #endif
}

String montarPacoteJson() {
  String deviceId = getDeviceId();
  float tempC = bme.readTemperature();
  float umidade = bme.readHumidity();
  float pressao = bme.readPressure();

  String jsonString = "{";
  jsonString += "\"device_id\":\"" + deviceId + "\"";
  jsonString += ",\"event_type\":\"HEARTBEAT\"";
  jsonString += ",\"source\":\"iot-device\"";

  if (gps.date.isValid() && gps.time.isValid() && gps.date.year() > 2000) {
    char timestamp[24];
    sprintf(timestamp, "%04d-%02d-%02dT%02d:%02d:%02dZ", gps.date.year(), gps.date.month(), gps.date.day(), gps.time.hour(), gps.time.minute(), gps.time.second());
    jsonString += ",\"ts_iso\":\"" + String(timestamp) + "\"";
  }

  if (tempC == 0 && umidade == 0 && pressao == 0) {
    jsonString += ",\"ambiente_error\":\"Falha na leitura do BME280\"";
  } else {
    jsonString += ",\"temp_c\":" + String(tempC);
    jsonString += ",\"humidity\":" + String(umidade);
    jsonString += ",\"pressure_hpa\":" + String(pressao / 100.0F);
  }

  if (gps.location.isValid()) {
    jsonString += ",\"lat\":" + String(gps.location.lat(), 6);
    jsonString += ",\"lng\":" + String(gps.location.lng(), 6);
  } else {
    jsonString += ",\"gps_error\":\"Localizacao invalida\"";
  }

  jsonString += "}";
  return jsonString;
}

void enviarDadosParaApi(String jsonPayload) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(5000); // Timeout de 5 segundos para evitar crash do WDT

    Serial.println("-> Enviando pacote para a API...");
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.printf("HTTP Response code: %d\n", httpResponseCode);
    } else {
      Serial.printf("Erro na requisição HTTP: %s\n", http.errorToString(httpResponseCode).c_str());
    }
    http.end();
  } else {
    Serial.println("ERRO: Sem conexão Wi-Fi.");
  }
}

void setup_wifi() {
  delay(10);
  Serial.println("\nConectando ao Wi-Fi...");
  WiFi.begin(ssid, password);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    esp_task_wdt_reset();
    attempts++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWi-Fi conectado!");
    Serial.print("Endereço de IP do dispositivo: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFalha ao conectar no Wi-Fi.");
  }
}

// ======================================================================
// --- FUNÇÕES PRINCIPAIS ---
// ======================================================================

void setup(void) {
  Serial.begin(115200);
  esp_task_wdt_add(NULL);
  
  setup_wifi(); 
  
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  
  if (!bme.begin()) {
    Serial.println("ERRO FATAL: Sensor BME280 nao encontrado!");
    while (1); 
  }
  
  delay(1000);
  Serial.println("\n--- UMC Fluxum (Hardware Real) iniciada ---");
  Serial.print("Device ID: ");
  Serial.println(getDeviceId());
  Serial.println("-------------------------------------------");
}

void loop(void) {
  esp_task_wdt_reset();
  while (gpsSerial.available() > 0) { gps.encode(gpsSerial.read()); }
  
  unsigned long currentMillis = millis();
  
  if (currentMillis - previousDataMillis >= dataInterval) {
    previousDataMillis = currentMillis;
    
    String pacoteDeDados = montarPacoteJson();
    Serial.println("--- Gerando Pacote de Dados (UMC) ---");
    Serial.println(pacoteDeDados); 
    
    enviarDadosParaApi(pacoteDeDados);
  }
}