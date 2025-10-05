const { pool } = require('../database/db');

exports.create = async (req, res) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const device_id = String(body.device_id || '').trim();
    const alias = body.alias != null ? String(body.alias).trim() : null;
    const model = body.model != null ? String(body.model).trim() : null;
    const site_id = body.site_id || null; // pode ser UUID ou null
    const metadata = typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : null;

    if (!device_id) {
      return res.status(400).json({ error: 'Campo "device_id" é obrigatório (ex.: esp32-abc123).' });
    }

    const r = await client.query(
      `
      INSERT INTO devices (device_id, alias, model, site_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (device_id) DO UPDATE SET
        alias    = COALESCE(EXCLUDED.alias, devices.alias),
        model    = COALESCE(EXCLUDED.model, devices.model),
        site_id  = COALESCE(EXCLUDED.site_id, devices.site_id),
        metadata = COALESCE(EXCLUDED.metadata, devices.metadata)
      RETURNING id, device_id, alias, model, site_id, metadata, last_seen, created_at
      `,
      [device_id, alias, model, site_id, metadata]
    );

    return res.status(201).json(r.rows[0]);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Erro ao registrar device' });
  } finally {
    client.release();
  }
};



// backend/controllers/devices.controller.js

exports.attachToContainer = async (req, res) => {
  const containerId = String(req.params.id || '').trim();
  const deviceId = String((req.body && req.body.device_id) || '').trim();
  if (!containerId) return res.status(400).json({ error: 'container_id ausente' });
  if (!deviceId) return res.status(400).json({ error: 'device_id ausente' });

  const client = await pool.connect();
  try {
    // Inicia uma transação para garantir que todas as operações funcionem ou nenhuma
    await client.query('BEGIN');

    // 1. Verifica se o container existe (seu código já fazia isso, ótimo!)
    const c = await client.query('SELECT id FROM containers WHERE id=$1', [containerId]);
    if (c.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Container não encontrado' });
    }

    // 2. Verifica se o dispositivo existe (seu código já fazia isso, ótimo!)
    const d = await client.query('SELECT id FROM devices WHERE device_id=$1', [deviceId]);
    if (d.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Device não encontrado' });
    }

    // ======================================================================
    // --- NOSSA NOVA LÓGICA DE ATUALIZAÇÃO ---
    // 3. Atualiza a tabela 'containers' para registrar a associação permanentemente.
    await client.query(
      `UPDATE containers SET iot_device_id = $1 WHERE id = $2`,
      [deviceId, containerId]
    );
    // ======================================================================

    // 4. Cria um evento na tabela de movimentos (seu código já fazia isso)
    await client.query(
      `INSERT INTO container_movements
         (container_id, event_type, device_id, ts_iso, meta, source)
       VALUES
         ($1, 'DEVICE_ATTACHED', $2, NOW(), jsonb_build_object('op','attach'), 'dashboard')`,
      [containerId, deviceId]
    );
    
    // (Opcional) A atualização da tabela 'container_state' já é feita pelo trigger que você criou!
    // Não precisamos mais das queries que atualizavam o container_state aqui.

    // Confirma todas as operações
    await client.query('COMMIT');
    return res.status(204).send(); // 204 No Content é uma ótima resposta para sucesso sem corpo

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    // Trata erro de associação duplicada (se outro container já usa esse device)
    if (e.code === '23505') {
        return res.status(409).json({ error: 'Este dispositivo IoT já está associado a outro container.' });
    }
    logger.error({ err: e }, 'Erro ao anexar dispositivo ao container');
    return res.status(500).json({ error: 'Erro ao anexar device' });
  } finally {
    client.release();
  }
};

