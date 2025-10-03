const { pool } = require('../database/db');

const {
  normalizeContainerId,
  deriveOwnerFromContainerId,
} = require('../utils/shippingLines');


function isContainerId(v) {
  const s = normalizeContainerId(v);
  // 4 letras + 7 dígitos (o último é dígito verificador)
  return /^[A-Z]{4}\d{7}$/.test(s);
}



exports.create = async (req, res) => {
  const client = await pool.connect();
  try {
    const account_id = req.account_id;
    const body = req.body || {};

    // normaliza ID (tira hífen/espaço e uppercase)
    const rawId = String(body.id || body.container_id || '').trim();
    const id = normalizeContainerId(rawId);

    const imo  = body.imo ? String(body.imo).trim() : '';
    let owner  = body.owner ? String(body.owner).trim() : null;  // ← pode vir vazio
    const container_type = body.container_type ? String(body.container_type).trim() : null;
    const description    = body.description ? String(body.description).trim() : null;

    if (!isContainerId(id)) {
      return res.status(400).json({ error: 'Campo "id" (container_id) é obrigatório.' });
    }
    if (!imo) {
      return res.status(400).json({ error: 'Campo "imo" é obrigatório.' });
    }

    
    if (!owner) owner = deriveOwnerFromContainerId(id);

    
    const ship = await client.query(
      `SELECT ship_id FROM public.ships WHERE account_id=$1 AND imo=$2 LIMIT 1`,
      [account_id, imo]
    );
    if (ship.rowCount === 0) {
      return res.status(400).json({ error: 'Não existe navio com esse IMO nesta conta.' });
    }

    const q = await client.query(
      `INSERT INTO public.containers (id, account_id, imo, container_type, owner, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         account_id     = EXCLUDED.account_id,
         imo            = EXCLUDED.imo,
         container_type = COALESCE(EXCLUDED.container_type, containers.container_type),
         owner          = COALESCE(EXCLUDED.owner, containers.owner),
         description    = COALESCE(EXCLUDED.description, containers.description)
       RETURNING id, account_id, imo, container_type, owner, description, created_at`,
      [id, account_id, imo, container_type, owner, description]
    );

    return res.status(201).json(q.rows[0]);
  } catch (e) {
    console.error('[containers.create] error:', e);
    if (e.code === '23503') {
      return res.status(400).json({ error: 'IMO não vinculado a um navio desta conta.' });
    }
    return res.status(500).json({ error: 'Erro ao criar container' });
  } finally {
    client.release();
  }
};

exports.list = async (req, res) => {
  try {
    const account_id = req.account_id;
    const q = await pool.query(
      `SELECT id, account_id, imo, container_type, owner, description, created_at
         FROM public.containers
        WHERE account_id = $1
        ORDER BY created_at DESC
        LIMIT 500`,
      [account_id]
    );
    return res.json(q.rows);
  } catch (e) {
    console.error('[containers.list] error:', e);
    return res.status(500).json({ error: 'Erro ao listar containers' });
  }
};

exports.getById = async (req, res) => {
  try {
    const account_id = req.account_id;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const q = await pool.query(
      `SELECT id, account_id, imo, container_type, owner, description, created_at
         FROM public.containers
        WHERE account_id = $1 AND id = $2
        LIMIT 1`,
      [account_id, id]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: 'Container não encontrado' });
    return res.json(q.rows[0]);
  } catch (e) {
    console.error('[containers.getById] error:', e);
    return res.status(500).json({ error: 'Erro ao buscar container' });
  }
};

exports.update = async (req, res) => {
  try {
    const account_id = req.account_id;
    const rawId = String(req.params.id || '').trim();
    const id = normalizeContainerId(rawId);
    if (!id) return res.status(400).json({ error: 'id inválido' });

    const body = req.body || {};
    const imo  = body.imo ? String(body.imo).trim() : null;
    let owner  = body.owner ? String(body.owner).trim() : null;
    const container_type = body.container_type ? String(body.container_type).trim() : null;
    const description    = body.description ? String(body.description).trim() : null;

   
    if (imo) {
      const ship = await pool.query(
        `SELECT 1 FROM public.ships WHERE account_id=$1 AND imo=$2 LIMIT 1`,
        [account_id, imo]
      );
      if (ship.rowCount === 0) {
        return res.status(400).json({ error: 'Não existe navio com esse IMO nesta conta.' });
      }
    }

   
    if (!owner) owner = deriveOwnerFromContainerId(id);

    const q = await pool.query(
      `UPDATE public.containers
          SET imo            = COALESCE(NULLIF($3,''), imo),
              container_type = COALESCE($4, container_type),
              owner          = COALESCE($5, owner),
              description    = COALESCE($6, description)
        WHERE account_id = $1 AND id = $2
        RETURNING id, account_id, imo, container_type, owner, description, created_at`,
      [account_id, id, imo, container_type, owner, description]
    );

    if (q.rowCount === 0) return res.status(404).json({ error: 'Container não encontrado' });
    return res.json(q.rows[0]);
  } catch (e) {
    console.error('[containers.update] error:', e);
    if (e.code === '23503') {
      return res.status(400).json({ error: 'IMO não vinculado a um navio desta conta.' });
    }
    return res.status(500).json({ error: 'Erro ao atualizar container' });
  }
};
