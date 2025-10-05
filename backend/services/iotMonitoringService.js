// backend/services/iotMonitoringService.js
const { logger } = require('../utils/observability');
const { pool } = require('../database/db');
const { v4: uuidv4 } = require('uuid');

const createAlert = async (containerId, deviceId, alertType, message) => {
  try {
    const alertId = uuidv4();
    await pool.query(
      `INSERT INTO alerts (id, alert_type, container_id, message, severity)
       VALUES ($1, $2, $3, $4, $5)`,
      [alertId, alertType, containerId, message, 3] // Severity 3 = Alta
    );
    logger.warn({ containerId, deviceId, message }, "ALERTA DE TEMPERATURA GERADO E SALVO!");
  } catch (error) {
    logger.error({ err: error, containerId }, "Falha ao salvar o registro de alerta no banco.");
  }
};

const processTelemetry = async (data) => {
    logger.info({ telemetryData: data }, "Pacote de telemetria recebido.");
    
    const { deviceId, timestamp, temp_c, humidity, pressure_hpa, lat, lng, rfid_tag, event_type } = data;
    const ts_iso = timestamp || new Date().toISOString();

    try {
        // ETAPA 1: Encontrar o container e suas regras
        const containerResult = await pool.query(
            'SELECT id, min_temp, max_temp FROM containers WHERE iot_device_id = $1', 
            [deviceId]
        );

        if (containerResult.rows.length === 0) {
            logger.warn({ deviceId }, "Dispositivo não associado. Nenhum dado foi salvo.");
            return; 
        }
        
        const container = containerResult.rows[0];
        const containerId = container.id;

        // ETAPA 2: Salvar o evento na tabela 'container_movements'
        const insertQuery = `
            INSERT INTO container_movements (container_id, device_id, ts_iso, temp_c, humidity, pressure_hpa, lat, lng, tag, event_type, source)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'iot-device')`;
        
        const insertValues = [containerId, deviceId, ts_iso, temp_c, humidity, pressure_hpa, lat, lng, rfid_tag, event_type];

        await pool.query(insertQuery, insertValues);
        logger.info({ deviceId, containerId }, "Dados de telemetria salvos no banco de dados.");

        // ======================================================================
        // --- LÓGICA DE VERIFICAÇÃO DE ALERTA (COM LOGS DE DETETIVE) ---
        // ======================================================================
        logger.info({
            temp_recebida: temp_c,
            limite_min_db: container.min_temp,
            limite_max_db: container.max_temp
        }, "Verificando condições de alerta...");

        if (temp_c != null && container.min_temp != null && container.max_temp != null) {
            let alertType = null;
            let message = null;

            // parseFloat para garantir que a comparação é entre números
            if (parseFloat(temp_c) > parseFloat(container.max_temp)) {
                alertType = 'TEMP_HIGH';
                message = `Alerta! Temperatura (${temp_c}°C) acima do limite de ${container.max_temp}°C.`;
            } else if (parseFloat(temp_c) < parseFloat(container.min_temp)) {
                alertType = 'TEMP_LOW';
                message = `Alerta! Temperatura (${temp_c}°C) abaixo do limite de ${container.min_temp}°C.`;
            }

            if (alertType) {
                await createAlert(containerId, deviceId, alertType, message);
            } else {
                logger.info("Temperatura está dentro dos limites. Nenhum alerta gerado.");
            }
        } else {
            logger.warn("Não foi possível verificar os alertas: temperatura ou limites estão faltando.");
        }

    } catch (dbError) {
        logger.error({ err: dbError, deviceId }, "ERRO CRÍTICO durante a operação com o banco de dados.");
        throw dbError; 
    }
};

module.exports = { processTelemetry };