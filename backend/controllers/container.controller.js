const { query } = require('../database/db');
const crypto = require('crypto');

function isValidEventType(t) {
  const a = ['RFID_DETECTED','OPEN','CLOSE','MOVE','ENTER','EXIT','ALERT','HEARTBEAT'];
  return a.includes(t);
}

exports.createEvent = async (req, res) => {
  const {
    containerId,
    eventType = 'RFID_DETECTED',
    site = null,
    location,
    gpio = null,
    deviceId = null,
    tag = null,
    timestamp = null,
    lat = null,
    lng = null,
    geohash = null,
    meta = null,
    source = 'api',
    voyageId = null,
    voyageCode = null
  } = req.body;

  if (!containerId || !location || !eventType) return res.status(400).json({ error: 'containerId, location e eventType são obrigatórios' });
  if (!isValidEventType(eventType)) return res.status(400).json({ error: 'eventType inválido' });

  let ts = timestamp ? new Date(timestamp) : new Date();
  if (isNaN(ts.getTime())) return res.status(400).json({ error: 'timestamp inválido' });
  ts = ts.toISOString();

  let vId = voyageId;
  if (!vId && voyageCode) {
    const r = await query('SELECT voyage_id FROM voyages WHERE voyage_code = $1 LIMIT 1', [voyageCode]);
    if (r.rows.length === 0) return res.status(400).json({ error: 'voyageCode inexistente' });
    vId = r.rows[0].voyage_id;
  }

  const idem = crypto.createHash('sha256').update(JSON.stringify({
    containerId, eventType, site, location, gpio, deviceId, tag, ts, vId
  })).digest('hex');

  const sql = `
    INSERT INTO container_movements
      (container_id, event_type, site, location, gpio, device_id, tag, ts_iso,
       lat, lng, geohash, meta, idempotency_key, source, voyage_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    RETURNING id
  `;
  const params = [
    containerId, eventType, site, location, gpio, deviceId, tag, ts,
    lat, lng, geohash, meta, idem, source, vId
  ];

  try {
    const r = await query(sql, params);
    return res.status(201).json({ message: 'Evento registrado', id: r.rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(200).json({ message: 'Evento duplicado ignorado' });
    if (e.code === '23503') return res.status(400).json({ error: 'voyageId inválido' });
    return res.status(500).json({ error: e.message });
  }
};

exports.listEvents = async (req, res) => {
  const { from, to, location, containerId } = req.query;
  const where = [];
  const params = [];

  if (from) { params.push(from); where.push('(cm.ts_iso >= $'+params.length+' OR cm.ts_iso IS NULL)'); }
  if (to) { params.push(to); where.push('(cm.ts_iso <= $'+params.length+' OR cm.ts_iso IS NULL)'); }
  if (location) { params.push(location); where.push('cm.location = $'+params.length); }
  if (containerId) { params.push(containerId); where.push('cm.container_id = $'+params.length); }

  const sql = `
    SELECT
      cm.id,
      cm.container_id,
      cm.event_type,
      cm.site,
      cm.location,
      cm.gpio,
      cm.device_id,
      cm.tag,
      cm.ts_iso,
      cm.lat,
      cm.lng,
      cm.geohash,
      cm.meta,
      cm.idempotency_key,
      cm.source,
      cm.voyage_id,
      v.voyage_code,
      s.name AS ship_name,
      s.imo,
      s.flag,
      cm.created_at
    FROM container_movements cm
    LEFT JOIN voyages v ON v.voyage_id = cm.voyage_id
    LEFT JOIN ships s ON s.ship_id = v.ship_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(cm.ts_iso, cm.created_at) DESC, cm.id DESC
    LIMIT 500
  `;

  try {
    const r = await query(sql, params);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

exports.listByVoyageOrIMO = async (req, res) => {
  const { voyageCode, imo, from, to } = req.query;
  const where = [];
  const params = [];

  if (voyageCode) { params.push(voyageCode); where.push('v.voyage_code = $'+params.length); }
  if (imo) { params.push(imo); where.push('s.imo = $'+params.length); }
  if (from) { params.push(from); where.push('(cm.ts_iso >= $'+params.length+' OR cm.ts_iso IS NULL)'); }
  if (to) { params.push(to); where.push('(cm.ts_iso <= $'+params.length+' OR cm.ts_iso IS NULL)'); }

  const sql = `
    SELECT
      cm.id,
      cm.container_id,
      cm.event_type,
      cm.location,
      cm.ts_iso,
      v.voyage_code,
      s.imo,
      s.name AS ship_name
    FROM container_movements cm
    LEFT JOIN voyages v ON v.voyage_id = cm.voyage_id
    LEFT JOIN ships s ON s.ship_id = v.ship_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(cm.ts_iso, cm.created_at) DESC, cm.id DESC
    LIMIT 500
  `;
  try {
    const r = await query(sql, params);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};


exports.movementsPerDay = async (req, res) => {
  const { from, to, location, containerId } = req.query;
  const where = [], params = [];
  if (from) { params.push(from); where.push("COALESCE(ts_iso, created_at) >= $"+params.length); }
  if (to) { params.push(to); where.push("COALESCE(ts_iso, created_at) <= $"+params.length); }
  if (location) { params.push(location); where.push("location = $"+params.length); }
  if (containerId) { params.push(containerId); where.push("container_id = $"+params.length); }

  const sql = `
    SELECT date_trunc('day', COALESCE(ts_iso, created_at))::date AS day,
           COUNT(*)::int AS total
    FROM container_movements
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY 1
    ORDER BY 1
  `;
  try {
    const r = await query(sql, params);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

exports.byLocation = async (req, res) => {
  const { from, to } = req.query;
  const where = [], params = [];
  if (from) { params.push(from); where.push("COALESCE(ts_iso, created_at) >= $"+params.length); }
  if (to) { params.push(to); where.push("COALESCE(ts_iso, created_at) <= $"+params.length); }

  const sql = `
    SELECT COALESCE(location, 'UNKNOWN') AS location,
           COUNT(*)::int AS total
    FROM container_movements
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY 1
    ORDER BY total DESC
  `;
  try {
    const r = await query(sql, params);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

exports.topContainers = async (req, res) => {
  const { from, to, limit = 10 } = req.query;
  const where = [], params = [];
  if (from) { params.push(from); where.push("COALESCE(ts_iso, created_at) >= $"+params.length); }
  if (to) { params.push(to); where.push("COALESCE(ts_iso, created_at) <= $"+params.length); }

  const sql = `
    SELECT container_id, COUNT(*)::int AS total
    FROM container_movements
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    GROUP BY 1
    ORDER BY total DESC, container_id ASC
    LIMIT $${params.length + 1}
  `;
  try {
    const r = await query(sql, [...params, Math.max(1, parseInt(limit, 10) || 10)]);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

exports.listWithVoyage = async (req, res) => {
  const { from, to, containerId } = req.query;
  const where = [];
  const params = [];

  if (from) { params.push(from); where.push('(cm.ts_iso >= $'+params.length+' OR cm.ts_iso IS NULL)'); }
  if (to)   { params.push(to);   where.push('(cm.ts_iso <= $'+params.length+' OR cm.ts_iso IS NULL)'); }
  if (containerId) { params.push(containerId); where.push('cm.container_id = $'+params.length); }

  const sql = `
    SELECT
      cm.id,
      cm.container_id,
      cm.event_type,
      cm.location,
      cm.ts_iso,
      v.voyage_code,
      s.imo
    FROM container_movements cm
    LEFT JOIN voyages v ON v.voyage_id = cm.voyage_id
    LEFT JOIN ships s ON s.ship_id = v.ship_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY COALESCE(cm.ts_iso, cm.created_at) DESC, cm.id DESC
    LIMIT 500
  `;

  try {
    const r = await query(sql, params);
    return res.json(r.rows);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};

