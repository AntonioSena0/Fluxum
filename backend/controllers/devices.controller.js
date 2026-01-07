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

exports.attachToContainer = async (req, res) => {
  // 1. Tratamento de Strings: Garante que não há espaços em branco invisíveis
  const containerId = String(req.params.id || '').trim();
  const deviceId = String((req.body && req.body.device_id) || '').trim();

  console.log(`[ATTACH] Iniciando associação...`);
  console.log(`[ATTACH] Container ID recebido: '${containerId}'`);
  console.log(`[ATTACH] Device ID recebido: '${deviceId}'`);

  // Validação básica
  if (!containerId) return res.status(400).json({ error: 'container_id ausente' });
  if (!deviceId) return res.status(400).json({ error: 'device_id ausente' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Verificação de Existência: O container existe?
    const c = await client.query('SELECT id FROM containers WHERE id=$1', [containerId]);
    if (c.rowCount === 0) {
      console.log(`[ATTACH] Erro: Container '${containerId}' não encontrado no banco.`);
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Container não encontrado' });
    }

    // 3. Verificação de Existência: O dispositivo existe?
    const d = await client.query('SELECT id FROM devices WHERE device_id=$1', [deviceId]);
    if (d.rowCount === 0) {
      console.log(`[ATTACH] Erro: Device '${deviceId}' não encontrado no banco.`);
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Device não encontrado' });
    }

    // 4. LIMPEZA (CRUCIAL): Remove este dispositivo de qualquer OUTRO container
    // Isso evita o erro de "chave duplicada" se o dispositivo já estava sendo usado em outro lugar.
    const cleanUp = await client.query(
      `UPDATE containers SET iot_device_id = NULL WHERE iot_device_id = $1`,
      [deviceId]
    );
    if (cleanUp.rowCount > 0) {
      console.log(`[ATTACH] Aviso: O dispositivo estava associado a outro container e foi removido.`);
    }

    // 5. A ASSOCIAÇÃO REAL
    const updateResult = await client.query(
      `UPDATE containers SET iot_device_id = $1 WHERE id = $2 RETURNING id`,
      [deviceId, containerId]
    );
    
    console.log(`[ATTACH] Resultado do UPDATE no Container: ${updateResult.rowCount} linha(s) afetada(s).`);

    if (updateResult.rowCount === 0) {
        // Caso raro onde o container existia no SELECT mas falhou no UPDATE
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'Falha ao atualizar o container.' });
    }

    // 6. Log de Evento (Histórico)
    await client.query(
      `INSERT INTO container_movements
         (container_id, event_type, device_id, ts_iso, meta, source)
       VALUES
         ($1, 'DEVICE_ATTACHED', $2, NOW(), jsonb_build_object('op','attach'), 'dashboard')`,
      [containerId, deviceId]
    );

    await client.query('COMMIT');
    console.log(`[ATTACH] Sucesso! Dispositivo ${deviceId} vinculado ao Container ${containerId}.`);
    
    return res.status(204).send();

  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error("[ATTACH] Erro CRÍTICO (Catch):", e);
    
    if (e.code === '23505') {
        return res.status(409).json({ error: 'Conflito: Este dispositivo já está associado a outro container.' });
    }
    
    return res.status(500).json({ error: 'Erro interno ao anexar device: ' + e.message });
  } finally {
    client.release();
  }
};

exports.list = async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT 
        d.device_id as id, 
        d.alias as nome, 
        d.last_seen,
        c.id as container_nome, -- O ID do container (ex: MSCU...)
        s.name as navio_nome
      FROM devices d
      -- Usamos TRIM() para ignorar espaços invisíveis na comparação
      LEFT JOIN containers c ON TRIM(c.iot_device_id) = TRIM(d.device_id)
      LEFT JOIN voyage_containers vc ON vc.container_id = c.id
      LEFT JOIN voyages v ON v.voyage_id = vc.voyage_id
      LEFT JOIN ships s ON s.ship_id = v.ship_id
      ORDER BY d.created_at DESC
    `);
    
    const devices = r.rows.map(row => ({
      id: row.id,
      nome: row.nome || "Sem Nome",
      // Lógica de exibição: Se tem container, mostra o container.
      navio: row.container_nome 
        ? `Container ${row.container_nome}` 
        : "Disponível",
      status: row.last_seen ? "Ativo" : "Inativo",
      atualizado: row.last_seen ? new Date(row.last_seen).toLocaleString() : "Nunca"
    }));

    return res.json(devices);
  } catch (e) {
    console.error("Erro ao listar dispositivos:", e);
    return res.status(500).json({ error: "Erro ao listar dispositivos" });
  }
};

// Se você tiver a função delete, mantenha ela aqui também no final
exports.delete = async (req, res) => {
    const deviceId = decodeURIComponent(req.params.id);
    if (!deviceId) return res.status(400).json({ error: "ID do dispositivo não fornecido." });
  
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Desassocia de qualquer container antes de deletar para evitar erro de FK
      await client.query('UPDATE containers SET iot_device_id = NULL WHERE iot_device_id = $1', [deviceId]);
      
      const r = await client.query('DELETE FROM devices WHERE device_id = $1 RETURNING device_id', [deviceId]);
  
      if (r.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Dispositivo não encontrado para exclusão." });
      }
  
      await client.query('COMMIT');
      return res.status(200).json({ message: "Dispositivo excluído com sucesso.", id: r.rows[0].device_id });
  
    } catch (e) {
      await client.query('ROLLBACK');
      console.error("Erro ao excluir dispositivo:", e);
      return res.status(500).json({ error: "Erro interno ao excluir dispositivo." });
    } finally {
      client.release();
    }
  };