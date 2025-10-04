// controllers/telemetry.controller.js
const { pool } = require("../database/db");
const { logger } = require("../utils/observability");
const telemetryService = require("../services/iotMonitoringService");

async function fetchVoyageIdByCode(client, account_id, voyage_code) {
  if (!voyage_code) return null;
  const q = await client.query(
    `SELECT v.voyage_id
       FROM public.voyages v
       JOIN public.ships s ON s.ship_id = v.ship_id
      WHERE s.account_id = $1 AND v.voyage_code = $2
      LIMIT 1`,
    [account_id, voyage_code]
  );
  return q.rowCount ? q.rows[0].voyage_id : null;
}

function safeNumber(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v : null;
}

function isoOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function normalizeEventItem(it = {}) {
  const event_type = String(it.event_type || it.type || "HEARTBEAT").toUpperCase();
  const ts_iso = isoOrNull(it.ts_iso || it.timestamp) || null;

  const hasPos = it && typeof it === "object" && it.position && (it.position.lat != null || it.position.lng != null);
  const lat = safeNumber(it.lat != null ? it.lat : hasPos ? it.position.lat : null);
  const lng = safeNumber(it.lng != null ? it.lng : hasPos ? it.position.lng : null);

  const sog_kn = safeNumber(
    it.sog_kn != null ? it.sog_kn :
    it.speed_knots != null ? it.speed_knots :
    it.speed != null ? it.speed : null
  );

  const cog_deg = safeNumber(
    it.cog_deg != null ? it.cog_deg :
    it.course_deg != null ? it.course_deg :
    it.heading != null ? it.heading : null
  );

  const container_id = String(it.container_id || "").trim();
  const device_id = it.device_id ? String(it.device_id).trim() : null;

  let idempotency_key = it.idempotency_key || null;
  if (!idempotency_key) {
    const baseTs = ts_iso || new Date().toISOString();
    idempotency_key = `${container_id}|${baseTs}|${event_type}|${device_id || ""}`;
  }

  return {
    container_id,
    event_type,
    device_id,
    ts_iso,
    lat,
    lng,
    geohash: it.geohash || null,
    meta: it.meta || null,
    idempotency_key,
    source: it.source || "esp32",
    voyage_id: it.voyage_id != null ? safeNumber(it.voyage_id) : null,
    voyage_code: it.voyage_code || null,
    imo: it.imo || null,
    battery_percent: it.battery_percent != null ? safeNumber(it.battery_percent) : null,
    temp_c: it.temp_c != null ? safeNumber(it.temp_c) : null,
    sog_kn,
    cog_deg,
    site: it.site || null,
    location: it.location || null,
    tag: it.tag || null,
  };
}

async function upsertContainerState(client, ev) {
  await client.query(
    `INSERT INTO container_state (
       container_id, last_event_type, last_location, last_site, last_gpio,
       last_ts_iso, updated_at, last_lat, last_lng, last_tag, last_device_id,
       last_battery_percent, last_temp_c, voyage_id
     )
     VALUES ($1,$2,$3,$4,NULL,$5,now(),$6,$7,$8,$9,$10,$11,$12)
     ON CONFLICT (container_id) DO UPDATE SET
       last_event_type = EXCLUDED.last_event_type,
       last_location   = COALESCE(EXCLUDED.last_location, container_state.last_location),
       last_site       = COALESCE(EXCLUDED.last_site, container_state.last_site),
       last_ts_iso     = EXCLUDED.last_ts_iso,
       updated_at      = now(),
       last_lat        = COALESCE(EXCLUDED.last_lat, container_state.last_lat),
       last_lng        = COALESCE(EXCLUDED.last_lng, container_state.last_lng),
       last_tag        = COALESCE(EXCLUDED.last_tag, container_state.last_tag),
       last_device_id  = COALESCE(EXCLUDED.last_device_id, container_state.last_device_id),
       last_battery_percent = COALESCE(EXCLUDED.last_battery_percent, container_state.last_battery_percent),
       last_temp_c     = COALESCE(EXCLUDED.last_temp_c, container_state.last_temp_c),
       voyage_id       = COALESCE(EXCLUDED.voyage_id, container_state.voyage_id)`,
    [
      ev.container_id, ev.event_type, ev.location, ev.site,
      ev.ts_iso, ev.lat, ev.lng, ev.tag, ev.device_id,
      ev.battery_percent, ev.temp_c, ev.voyage_id
    ]
  );
}

async function ingestSmart(req, res) {
  const body = req.body || {};
  const items = Array.isArray(body.items) ? body.items : (Array.isArray(body) ? body : [body]);
  const account_id = req.account_id;

  const client = await pool.connect();
  let inserted = 0;
  const conflicts = [];

  try {
    await client.query("BEGIN");

    for (const raw of items) {
      const ev = normalizeEventItem(raw);
      if (!ev.container_id) continue;

      if (!ev.voyage_id && ev.voyage_code) {
        ev.voyage_id = await fetchVoyageIdByCode(client, account_id, ev.voyage_code);
      }

     const ins = await client.query(
  `INSERT INTO container_movements
   (container_id, event_type, site, location, gpio, device_id, tag,
    ts_iso, lat, lng, geohash, meta, idempotency_key, source,
    voyage_id, battery_percent, temp_c, sog_kn, cog_deg, voyage_code, imo)
   VALUES
   ($1,$2,$3,$4,NULL,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
   ON CONFLICT (idempotency_key) DO NOTHING
   RETURNING 1`,
  [
    ev.container_id, ev.event_type, ev.site, ev.location,
    ev.device_id, ev.tag,
    ev.ts_iso, ev.lat, ev.lng, ev.geohash, ev.meta,
    ev.idempotency_key, ev.source, ev.voyage_id,
    ev.battery_percent, ev.temp_c, ev.sog_kn, ev.cog_deg,
    ev.voyage_code, ev.imo
  ]
);


      if (ev.ts_iso) {
        const cur = await client.query(
          `SELECT last_ts_iso FROM container_state WHERE container_id=$1`,
          [ev.container_id]
        );
        const curTs = cur.rows[0]?.last_ts_iso ? new Date(cur.rows[0].last_ts_iso).getTime() : 0;
        const evTs = new Date(ev.ts_iso).getTime();
        if (ins.rowCount > 0 || evTs > curTs) {
          await upsertContainerState(client, ev);
        }
      } else if (ins.rowCount > 0) {
        await upsertContainerState(client, ev);
      }

      if (ins.rowCount > 0) {
        inserted++;
      } else {
        try {
          const dbg = await client.query(
            `SELECT container_id, event_type,
                    COALESCE(ts_iso, created_at) AS ts,
                    device_id, tag, idempotency_key
               FROM container_movements
              WHERE container_id = $1
                AND event_type   = $2
                AND COALESCE(ts_iso, created_at) = COALESCE($3::timestamptz, created_at)
                AND COALESCE(device_id,'') = COALESCE($4,'')
                AND COALESCE(tag,'')       = COALESCE($5,'')
                AND (idempotency_key IS NULL OR idempotency_key = $6)
              ORDER BY ts DESC
              LIMIT 1`,
            [ev.container_id, ev.event_type, ev.ts_iso, ev.device_id, ev.tag || '', ev.idempotency_key || null]
          );
          if (dbg.rowCount) conflicts.push(dbg.rows[0]);
        } catch {}
      }
    }

    await client.query("COMMIT");
    const payload = { ok: true, inserted };
    if (conflicts.length) payload.conflicts = conflicts;
    return res.status(200).json(payload);
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "ingestSmart error");
    return res.status(400).json({ error: "Bad Request" });
  } finally {
    client.release();
  }
}

async function receiveIoTPacket(req, res) {
  const telemetryData = req.body;
  if (!telemetryData || Object.keys(telemetryData).length === 0) {
    logger.warn("Recebida requisição de telemetria de IoT vazia.");
    return res.status(400).json({ message: "Nenhum dado recebido." });
  }
  try {
    await telemetryService.processTelemetry(telemetryData);
    res.status(200).json({ message: "Dados de telemetria recebidos com sucesso." });
  } catch (error) {
    logger.error({ err: error, data: telemetryData }, "Erro ao processar dados de telemetria da IoT.");
    res.status(500).json({ message: "Erro interno no servidor." });
  }
}

module.exports = {
  ingestSmart,
  receiveIoTPacket,
};
