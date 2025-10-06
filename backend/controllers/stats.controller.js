// backend/controllers/stats.controller.js
const { pool } = require('../database/db');

exports.movementsPerDay = async (_req, res) => {
  const r = await pool.query(`
    select date_trunc('day', coalesce(ts_iso, created_at)) as day, count(*) as events
    from container_movements
    group by 1
    order by day desc
    limit 60
  `);
  res.json(r.rows);
};

exports.byLocation = async (_req, res) => {
  const r = await pool.query(`
    select coalesce(nullif(location,''), nullif(site,''), 'N/A') as location, count(*) as events
    from container_movements
    group by 1
    order by events desc
    limit 100
  `);
  res.json(r.rows);
};

exports.topContainers = async (_req, res) => {
  const r = await pool.query(`
    select container_id, count(*) as events
    from container_movements
    where container_id is not null and container_id <> ''
    group by 1
    order by events desc
    limit 50
  `);
  res.json(r.rows);
};

exports.listWithVoyage = async (_req, res) => {
  const r = await pool.query(`
    select vc.voyage_id,
           v.voyage_code,
           vc.container_id,
           vc.loaded_at,
           vc.unloaded_at,
           v.status
    from voyage_containers vc
    join voyages v on v.voyage_id = vc.voyage_id
    order by vc.voyage_id desc, vc.loaded_at desc nulls last
    limit 200
  `);
  res.json(r.rows);
};


exports.ingestTemp = async (req, res) => {
  const client = await pool.connect();
  try {
    const account_id = req.account_id; 
    const body = req.body || {};

    const container_id = String(body.container_id || '').trim();
    if (!container_id) return res.status(400).json({ error: 'container_id é obrigatório' });

    
    const ship_id = Number(body.ship_id) || null;
    const temp_c = (body.temp_c === 0 || body.temp_c) ? Number(body.temp_c) : null;
    const ts_iso = body.ts_iso ? new Date(body.ts_iso).toISOString() : new Date().toISOString();

    
    await client.query('BEGIN');

    
    let imo = null;
    if (Number.isFinite(ship_id)) {
      const r = await client.query(
        `SELECT imo FROM public.ships WHERE account_id=$1 AND ship_id=$2 LIMIT 1`,
        [account_id, ship_id]
      );
      if (r.rowCount > 0) imo = r.rows[0].imo || null;
    }

    
    await client.query(
      `INSERT INTO public.container_movements
         (container_id, event_type, ts_iso, temp_c, imo)
       VALUES ($1, 'HEARTBEAT', $2::timestamptz, $3, $4)`,
      [container_id, ts_iso, temp_c, imo]
    );

    
    await client.query(
      `INSERT INTO public.container_state
         (container_id, last_event_type, last_ts_iso, last_temp_c, updated_at)
       VALUES ($1, 'HEARTBEAT', $2::timestamptz, $3, now())
       ON CONFLICT (container_id) DO UPDATE SET
         last_event_type = EXCLUDED.last_event_type,
         last_ts_iso     = EXCLUDED.last_ts_iso,
         last_temp_c     = EXCLUDED.last_temp_c,
         updated_at      = now()`,
      [container_id, ts_iso, temp_c]
    );

    await client.query('COMMIT');
    return res.status(201).json({ ok: true, container_id, temp_c, ts_iso });
  } catch (e) {
    await pool.query('ROLLBACK');
    console.error('[stats.ingestTemp] error:', e);
    return res.status(500).json({ error: 'Falha ao ingerir temperatura' });
  } finally {
    client.release();
  }
};
