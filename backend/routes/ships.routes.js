// routes/ships.routes.js
const express = require('express');
const router = express.Router();
const { pool } = require('../database/db');
const { authRequired } = require('../middleware/auth');

// LISTAR
router.get('/ships', authRequired, async (req, res) => {
  try {
    const account_id = req.account_id; // BIGINT
    const { rows } = await pool.query(
      `SELECT
         ship_id, account_id, name, imo, flag, status,
         from_port, to_port, eta_date, departure_at,
         capacity, active, created_at
       FROM ships
       WHERE account_id = $1
       ORDER BY ship_id DESC
       LIMIT 100`,
      [account_id]
    );
    res.json(rows);
  } catch (e) {
    console.error('[GET /ships] error:', e);
    res.status(500).json({ error: 'Erro ao listar ships' });
  }
});

// CRIAR
router.post('/ships', authRequired, async (req, res) => {
  try {
    const account_id = req.account_id; // BIGINT
    const {
      imo, name, flag, status, from_port,
      to_port, eta_date, departure_at, active
    } = req.body || {};

    if (!name) return res.status(400).json({ error: 'name é obrigatório' });

    const { rows } = await pool.query(
      `INSERT INTO ships (
         account_id, imo, name, flag, status, from_port, to_port,
         eta_date, departure_at, active
       )
       VALUES ($1, NULLIF($2,''), $3, NULLIF($4,''), NULLIF($5,''), NULLIF($6,''), NULLIF($7,''),
               $8::date, $9::timestamptz, $10)
       RETURNING
         ship_id, account_id, name, imo, flag, status,
         from_port, to_port, eta_date, departure_at,
         capacity, active, created_at`,
      [
        account_id,
        (imo || '').trim(),
        String(name).trim(),
        flag ?? null,
        status ?? null,
        from_port ?? null,
        to_port ?? null,
        eta_date || null,
        departure_at || null,
        active === false ? false : true
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'IMO já cadastrado para esta conta' });
    }
    console.error('[POST /ships] error:', e);
    res.status(500).json({ error: 'Erro ao criar ship' });
  }
});

// BUSCAR POR ID  <<< ADICIONE ISSO
router.get('/ships/:id', authRequired, async (req, res) => {
  try {
    const account_id = req.account_id; // BIGINT
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'id inválido (inteiro esperado)' });
    }

    const { rows } = await pool.query(
      `SELECT
         ship_id, account_id, name, imo, flag, status,
         from_port, to_port, eta_date, departure_at,
         capacity, active, created_at
       FROM ships
       WHERE ship_id = $1 AND account_id = $2
       LIMIT 1`,
      [id, account_id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'Navio não encontrado' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[GET /ships/:id] error:', e);
    res.status(500).json({ error: 'Erro ao buscar ship' });
  }
});

module.exports = router;
