const { pool } = require("../database/db");

function isUuid(v) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(v));
}

function describeAlert(t) {
  const T = String(t || "").toUpperCase();
  switch (T) {
    case "TEMP_HIGH":
      return "Temperatura acima do limite seguro no contêiner";
    case "TEMP_LOW":
      return "Temperatura abaixo do esperado no contêiner";
    case "ROUTE_DEVIATION":
      return "Desvio de rota detectado";
    case "ROUTE_COMPLETED":
      return "Rota concluída com sucesso";
    case "DOOR_OPEN":
      return "Porta do contêiner aberta";
    case "DOOR_CLOSE":
      return "Porta do contêiner fechada";
    case "BATTERY_LOW":
      return "Nível de bateria baixo no dispositivo IoT";
    default:
      return "Alerta do sistema";
  }
}

function severityLabel(s) {
  const n = Number(s);
  if (n <= 1) return "Baixa";
  if (n === 2) return "Média";
  return "Alta";
}


exports.list = async (req, res) => {
  const account_id = req.account_id;
  const status = String(req.query.status || "").toLowerCase();
  const voyageId = req.query.voyage_id || null;
  const containerId = req.query.container_id || null;
  const limit = Math.min(500, Number(req.query.limit || 200));

  const params = [account_id];
  let where = "a.account_id = $1";
  if (status === "pending") where += " AND a.acknowledged_at IS NULL";
  if (status === "resolved") where += " AND a.acknowledged_at IS NOT NULL";
  if (voyageId) {
    params.push(voyageId);
    where += ` AND EXISTS (
      SELECT 1 FROM container_movements m
       WHERE m.container_id = a.container_id
         AND m.voyage_id = $${params.length}
    )`;
  }
  if (containerId) {
    params.push(containerId);
    where += ` AND a.container_id = $${params.length}`;
  }
  params.push(limit);

  // SELECT enriquecido
  const sql = `
    SELECT
      a.id,
      a.account_id,
      a.container_id,
      a.alert_type,
      a.severity,
      a.message,
      a.acknowledged_by,
      a.acknowledged_at,
      a.created_at,

      -- do container
      c.imo            AS container_imo,
      c.container_type AS container_type,
      c.owner          AS container_owner,

      -- do navio (via account_id+imo)
      s.name           AS ship_name,
      s.flag           AS ship_flag,
      s.status         AS ship_status

    FROM alerts a
    JOIN containers c
      ON c.account_id = a.account_id
     AND c.id         = a.container_id
    LEFT JOIN ships s
      ON s.account_id = c.account_id
     AND s.imo        = c.imo
    WHERE ${where}
    ORDER BY a.created_at DESC
    LIMIT $${params.length};
  `;

  const r = await pool.query(sql, params);

  
 const rows = r.rows.map(row => ({
  ...row,
  severity_label: severityLabel(row.severity),
  human_message : describeAlert(row.alert_type),
}));

 
  res.json(rows);
};

exports.ack = async (req, res) => {
  const account_id = req.account_id;
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "alert id deve ser UUID" });
  const userId = req.user?.sub || null;
  const client = await pool.connect();
  try {
    const q = await client.query(
      `update alerts
          set acknowledged_by = coalesce($3, acknowledged_by),
              acknowledged_at = now()
        where id = $1 and account_id = $2 and acknowledged_at is null
        returning id, account_id, container_id, alert_type, severity, message, acknowledged_by, acknowledged_at, created_at`,
      [id, account_id, userId]
    );
    if (q.rowCount === 0) return res.status(404).json({ error: "alert não encontrado" });
    return res.json(q.rows[0]);
  } finally {
    client.release();
  }
};

exports.remove = async (req, res) => {
  const account_id = req.account_id;
  const { id } = req.params;
  if (!isUuid(id)) return res.status(400).json({ error: "alert id deve ser UUID" });
  const r = await pool.query(`delete from alerts where id = $1 and account_id = $2`, [id, account_id]);
  if (r.rowCount === 0) return res.status(404).json({ error: "alert não encontrado" });
  return res.status(204).send();
};
