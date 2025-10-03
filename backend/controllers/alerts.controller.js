const { pool } = require("../database/db");

function isUuid(v) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(String(v));
}

exports.list = async (req, res) => {
  const account_id = req.account_id;
  const status = String(req.query.status || "").toLowerCase();
  const voyageId = req.query.voyage_id || null;
  const containerId = req.query.container_id || null;
  const limit = Math.min(500, Number(req.query.limit || 200));
  const params = [account_id];
  let where = "account_id = $1";
  if (status === "pending") where += " and acknowledged_at is null";
  if (status === "resolved") where += " and acknowledged_at is not null";
  if (voyageId) { params.push(voyageId); where += ` and exists(select 1 from container_movements m where m.container_id=alerts.container_id and m.voyage_id=$${params.length})`; }
  if (containerId) { params.push(containerId); where += ` and alerts.container_id=$${params.length}`; }
  params.push(limit);
  const r = await pool.query(
    `select id, account_id, container_id, alert_type, severity, message, acknowledged_by, acknowledged_at, created_at
       from alerts
      where ${where}
      order by created_at desc
      limit $${params.length}`,
    params
  );
  res.json(r.rows);
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
