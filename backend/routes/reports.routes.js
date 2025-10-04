// routes/reports.js
const express = require("express");
const { Pool } = require("pg");
const puppeteer = require("puppeteer");
const { authRequired } = require("../middleware/auth");
const { reverseGeocode } = require("../utils/geocode");

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// --- Helpers ---
function parseRange(query) {
  const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), 0, 1); // 1-jan ano atual
  const to = query.to ? new Date(query.to) : new Date(); // agora
  return { from, to };
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
}
function monthLabel(yyyyMM) {
  const [y, m] = yyyyMM.split("-");
  const nomes = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  const mm = Math.max(1, Math.min(12, parseInt(m,10)));
  return `${nomes[mm-1]}/${String(y).slice(-2)}`;
}
function buildAlertsBarSVG(rows) {
  const width = 600;
  const height = 220;
  const margin = { top: 10, right: 12, bottom: 40, left: 32 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const n = rows.length || 1;
  const maxV = Math.max(1, ...rows.map(r => r.count || 0));
  const barGap = 8;
  const barW = Math.max(8, Math.floor((innerW - (barGap*(n-1))) / n));

  let bars = "";
  rows.forEach((r, i) => {
    const v = r.count || 0;
    const h = Math.round((v / maxV) * (innerH - 20));
    const x = margin.left + i * (barW + barGap);
    const y = margin.top + (innerH - h);
    const label = monthLabel(r.month);
    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${h}" rx="6" ry="6" fill="#9F9CE8"></rect>
      <text x="${x + barW/2}" y="${height - 16}" text-anchor="middle" font-size="11" fill="#444">${esc(label)}</text>
    `;
  });

  const y0 = margin.top + innerH;
  const yMax = margin.top;
  const grid = `
    <line x1="${margin.left}" y1="${y0}" x2="${width - margin.right}" y2="${y0}" stroke="#ddd" />
    <line x1="${margin.left}" y1="${yMax}" x2="${width - margin.right}" y2="${yMax}" stroke="#eee" />
    <text x="${margin.left - 6}" y="${y0}" text-anchor="end" font-size="10" fill="#666">0</text>
    <text x="${margin.left - 6}" y="${yMax + 10}" text-anchor="end" font-size="10" fill="#666">${esc(String(maxV))}</text>
  `;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="white"/>
  ${grid}
  ${bars}
</svg>
  `;
}

// ================ SUMMARY ==================
router.get("/api/reports/summary", authRequired, async (req, res) => {
  const accountId = req.user.account_id;
  const { from, to } = parseRange(req.query);

  const client = await pool.connect();
  try {
    
    const totalMovementsQ = `
      SELECT COUNT(*)::int AS total
      FROM container_movements m
      JOIN containers c ON c.id = m.container_id
      WHERE c.account_id = $1
        AND COALESCE(m.ts_iso, m.created_at) >= $2
        AND COALESCE(m.ts_iso, m.created_at) <  $3
    `;
    const total = await client.query(totalMovementsQ, [accountId, from, to]);

    
    const avgViaVoyageContainersQ = `
      WITH vc AS (
        SELECT
          v.voyage_id,
          vc.container_id,
          vc.loaded_at,
          vc.unloaded_at
        FROM voyage_containers vc
        JOIN voyages v ON v.voyage_id = vc.voyage_id
        JOIN ships s ON s.ship_id = v.ship_id
        WHERE s.account_id = $1
          AND vc.loaded_at IS NOT NULL
          AND vc.unloaded_at IS NOT NULL
          AND vc.loaded_at >= $2
          AND vc.unloaded_at <  $3
      ),
      diff AS (
        SELECT EXTRACT(EPOCH FROM (unloaded_at - loaded_at))/86400.0 AS days
        FROM vc
        WHERE unloaded_at > loaded_at
      )
      SELECT COALESCE(ROUND(AVG(days)::numeric,1), 0)::float AS avg_days
      FROM diff;
    `;
    const avg1 = await client.query(avgViaVoyageContainersQ, [accountId, from, to]);
    let avgDeliveryDays = Number(avg1.rows?.[0]?.avg_days || 0);

    
    if (!avgDeliveryDays || Number.isNaN(avgDeliveryDays)) {
      const avgViaEnterExitQ = `
        WITH bounds AS (
          SELECT
            c.account_id,
            m.container_id,
            m.voyage_id,
            MIN(CASE WHEN m.event_type='ENTER' THEN COALESCE(m.ts_iso, m.created_at) END) AS first_enter,
            MIN(CASE WHEN m.event_type='EXIT'  THEN COALESCE(m.ts_iso, m.created_at) END)   AS first_exit
          FROM container_movements m
          JOIN containers c ON c.id = m.container_id
          WHERE c.account_id = $1
            AND COALESCE(m.ts_iso, m.created_at) >= $2
            AND COALESCE(m.ts_iso, m.created_at) <  $3
            AND m.event_type IN ('ENTER','EXIT')
          GROUP BY c.account_id, m.container_id, m.voyage_id
        ), diff AS (
          SELECT EXTRACT(EPOCH FROM (first_exit - first_enter))/86400.0 AS days
          FROM bounds
          WHERE first_enter IS NOT NULL AND first_exit IS NOT NULL AND first_exit > first_enter
        )
        SELECT COALESCE(ROUND(AVG(days)::numeric,1), 0)::float AS avg_days
        FROM diff;
      `;
      const avg2 = await client.query(avgViaEnterExitQ, [accountId, from, to]);
      avgDeliveryDays = Number(avg2.rows?.[0]?.avg_days || 0);
    }

    return res.json({
      totalMovements: total.rows[0].total,
      avgDeliveryDays
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao carregar resumo" });
  } finally {
    client.release();
  }
});

// =========== ALERTAS POR MÊS ===============
router.get("/api/reports/alerts-by-month", authRequired, async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const months = Math.max(1, Math.min(24, Number(req.query.months) || 6));

    const q = `
      SELECT TO_CHAR(date_trunc('month', a.created_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM alerts a
      JOIN containers c ON c.id = a.container_id
      WHERE c.account_id = $1
        AND a.created_at >= (date_trunc('month', now()) - ($2 || ' months')::interval)
      GROUP BY 1
      ORDER BY 1;
    `;
    const { rows } = await pool.query(q, [accountId, months]);
    return res.json(rows);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao carregar alertas" });
  }
});


router.get("/api/reports/containers", authRequired, async (req, res) => {
  const accountId = req.user.account_id;
  const search = (req.query.search || "").trim();
  const page = Math.max(1, parseInt(req.query.page || "1", 10));
  const pageSize = Math.min(100, Math.max(5, parseInt(req.query.pageSize || "20", 10)));

  const { rows } = await pool.query(
    `
    WITH base AS (
      SELECT
        cs.container_id AS id,
        cs.last_location AS local,
        cs.last_event_type,
        cs.last_ts_iso AS data,
        cs.last_lat,
        cs.last_lng
      FROM container_state cs
      JOIN containers c ON c.id = cs.container_id
      WHERE c.account_id = $1
    ),
    filtrada AS (
      SELECT *
      FROM base
      WHERE ($2 = '' 
             OR id ILIKE '%'||$2||'%' 
             OR COALESCE(local,'') ILIKE '%'||$2||'%')
    ),
    classificada AS (
      SELECT
        id,
        local,
        last_lat,
        last_lng,
        CASE
          WHEN last_event_type = 'EXIT' THEN 'Entregue'
          WHEN (now() - data) > interval '48 hours' THEN 'Atrasado'
          ELSE 'Em trânsito'
        END AS status,
        data
      FROM filtrada
    ),
    paginada AS (
      SELECT *
      FROM classificada
      ORDER BY data DESC
      OFFSET ($3-1)*$4 LIMIT $4
    )
    SELECT jsonb_build_object(
      'items', jsonb_agg(jsonb_build_object(
        'id', id,
        'local', COALESCE(local,''),
        'status', status,
        'data', data,
        'lat', last_lat,
        'lng', last_lng
      )) FILTER (WHERE true),
      'total', (SELECT COUNT(*) FROM classificada)
    ) AS result
    FROM paginada;
    `,
    [accountId, search, page, pageSize]
  );

  const payload = rows[0]?.result || { items: [], total: 0 };
  const items = Array.isArray(payload.items) ? payload.items : [];

  // Enriquecimento no Node: preenche "local" via reverse geocode quando vazio
  const enriched = await Promise.all(items.map(async (it) => {
    if (it.local && it.local.trim() !== "") return it;
    if (typeof it.lat === "number" && typeof it.lng === "number") {
      try {
        const label = await reverseGeocode(it.lat, it.lng);
        if (label) {
          it.local = label;
        }
      } catch {}
    }
    // fallback
    if (!it.local || it.local.trim() === "") it.local = "—";
    // não exponha lat/lng se não quiser; pode remover estas linhas:
    delete it.lat;
    delete it.lng;
    return it;
  }));

  return res.send({ items: enriched, total: payload.total || 0 });
});

// ============ EXPORTAR PDF =================
/**
 * Gera um PDF com os três blocos:
 * - Resumo (totalMovements, avgDeliveryDays)
 * - Alertas por mês (tabela simples)
 * - Tabela de containers (primeiras N linhas)
 *
 * Body: { from?: string, to?: string, search?: string, pageSize?: number }
 */
router.post("/api/reports/export", authRequired, async (req, res) => {
  const accountId = req.user.account_id;
  const { from, to } = parseRange(req.body || {}); // YTD default
  const search = String(req.body?.search || "").trim();
  const pageSize = Math.min(100, Math.max(5, parseInt(req.body?.pageSize || "20", 10)));

  const client = await pool.connect();
  try {
    // totalMovements (todos os eventos)
    const totalQ = `
      SELECT COUNT(*)::int AS total
      FROM container_movements m
      JOIN containers c ON c.id = m.container_id
      WHERE c.account_id = $1
        AND COALESCE(m.ts_iso, m.created_at) >= $2
        AND COALESCE(m.ts_iso, m.created_at) <  $3
    `;
    const total = await client.query(totalQ, [accountId, from, to]);

    // avgDeliveryDays (voyage_containers -> fallback ENTER/EXIT)
    const avgViaVC = `
      WITH vc AS (
        SELECT v.voyage_id, vc.container_id, vc.loaded_at, vc.unloaded_at
        FROM voyage_containers vc
        JOIN voyages v ON v.voyage_id = vc.voyage_id
        JOIN ships s ON s.ship_id = v.ship_id
        WHERE s.account_id = $1
          AND vc.loaded_at IS NOT NULL
          AND vc.unloaded_at IS NOT NULL
          AND vc.loaded_at >= $2
          AND vc.unloaded_at <  $3
      ),
      diff AS (
        SELECT EXTRACT(EPOCH FROM (unloaded_at - loaded_at))/86400.0 AS days
        FROM vc
        WHERE unloaded_at > loaded_at
      )
      SELECT COALESCE(ROUND(AVG(days)::numeric,1), 0)::float AS avg_days
      FROM diff;
    `;
    const avg1 = await client.query(avgViaVC, [accountId, from, to]);
    let avgDeliveryDays = Number(avg1.rows?.[0]?.avg_days || 0);

    if (!avgDeliveryDays || Number.isNaN(avgDeliveryDays)) {
      const avgFallback = `
        WITH bounds AS (
          SELECT
            c.account_id,
            m.container_id,
            m.voyage_id,
            MIN(CASE WHEN m.event_type='ENTER' THEN COALESCE(m.ts_iso, m.created_at) END) AS first_enter,
            MIN(CASE WHEN m.event_type='EXIT'  THEN COALESCE(m.ts_iso, m.created_at) END)   AS first_exit
          FROM container_movements m
          JOIN containers c ON c.id = m.container_id
          WHERE c.account_id = $1
            AND COALESCE(m.ts_iso, m.created_at) >= $2
            AND COALESCE(m.ts_iso, m.created_at) <  $3
            AND m.event_type IN ('ENTER','EXIT')
          GROUP BY c.account_id, m.container_id, m.voyage_id
        ), diff AS (
          SELECT EXTRACT(EPOCH FROM (first_exit - first_enter))/86400.0 AS days
          FROM bounds
          WHERE first_enter IS NOT NULL AND first_exit IS NOT NULL AND first_exit > first_enter
        )
        SELECT COALESCE(ROUND(AVG(days)::numeric,1), 0)::float AS avg_days
        FROM diff;
      `;
      const avg2 = await client.query(avgFallback, [accountId, from, to]);
      avgDeliveryDays = Number(avg2.rows?.[0]?.avg_days || 0);
    }

    // últimos 6 meses para o gráfico (ajuste o intervalo se quiser)
    const alertsQ = `
      SELECT TO_CHAR(date_trunc('month', a.created_at), 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM alerts a
      JOIN containers c ON c.id = a.container_id
      WHERE c.account_id = $1
        AND a.created_at >= (date_trunc('month', now()) - interval '6 months')
      GROUP BY 1
      ORDER BY 1;
    `;
    const alerts = await client.query(alertsQ, [accountId]);

    // tabela (amostra)
    const tableQ = `
      WITH base AS (
        SELECT
          cs.container_id AS id,
          cs.last_location AS local,
          cs.last_event_type,
          cs.last_ts_iso AS data
        FROM container_state cs
        JOIN containers c ON c.id = cs.container_id
        WHERE c.account_id = $1
      ),
      filtrada AS (
        SELECT *
        FROM base
        WHERE ($2 = '' 
               OR id ILIKE '%'||$2||'%' 
               OR COALESCE(local,'') ILIKE '%'||$2||'%')
      ),
      classificada AS (
        SELECT
          id,
          local,
          CASE
            WHEN last_event_type = 'EXIT' THEN 'Entregue'
            WHEN (now() - data) > interval '48 hours' THEN 'Atrasado'
            ELSE 'Em trânsito'
          END AS status,
          data
        FROM filtrada
      )
      SELECT *
      FROM classificada
      ORDER BY data DESC
      LIMIT $3;
    `;
    const table = await client.query(tableQ, [accountId, search, pageSize]);

    // SVG do gráfico
    const alertsSVG = buildAlertsBarSVG(alerts.rows);

    const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Relatório Fluxum</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #222; }
    h1 { color: #3E41C0; margin: 0 0 8px; }
    h2 { color: #3E41C0; margin-top: 24px; }
    .kpis { display: flex; gap: 24px; margin: 12px 0 24px; }
    .card { background: #F2F6FB; padding: 16px; border-radius: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ddd; padding: 8px 6px; font-size: 12px; text-align: left; }
    th { background: #ECF2F9; color: #3E41C0; }
    .status-atrasado { color: #F21D4E; font-weight: bold; }
    .status-transito { color: #3E41C0; font-weight: bold; }
    .status-entregue { color: #2b2b2b; font-weight: bold; }
    .muted { color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Relatório</h1>
  <div class="muted">Período: ${esc(from.toISOString().slice(0,10))} a ${esc(to.toISOString().slice(0,10))}</div>

  <div class="kpis">
    <div class="card">
      <div> Total de cargas movimentadas </div>
      <div style="font-size: 28px; color:#3E41C0; font-weight: 700;">${esc(total.rows[0].total)}</div>
    </div>
    <div class="card">
      <div> Tempo médio de entrega </div>
      <div style="font-size: 28px; color:#3E41C0; font-weight: 700;">${esc(avgDeliveryDays)} dias</div>
    </div>
  </div>

  <h2>Alertas por mês</h2>
  ${alertsSVG}

  <table>
    <thead><tr><th>Mês</th><th>Qtde</th></tr></thead>
    <tbody>
      ${alerts.rows.map(r => `<tr><td>${esc(monthLabel(r.month))}</td><td>${esc(r.count)}</td></tr>`).join("")}
    </tbody>
  </table>

  <h2>Containers (amostra)</h2>
  <table>
    <thead><tr><th>ID</th><th>Localização</th><th>Status</th><th>Data</th></tr></thead>
    <tbody>
      ${table.rows.map(r => {
        const status = r.last_event_type === 'EXIT' ? 'Entregue'
                     : ((Date.now() - new Date(r.data).getTime()) > 48*3600*1000 ? 'Atrasado' : 'Em trânsito');
        const cls = status === 'Atrasado' ? 'status-atrasado'
                  : status === 'Em trânsito' ? 'status-transito' : 'status-entregue';
        return `<tr>
          <td>${esc(r.id)}</td>
          <td>${esc(r.local ?? '—')}</td>
          <td class="${cls}">${esc(status)}</td>
          <td>${esc(new Date(r.data).toLocaleString())}</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>
</body>
</html>
    `;

    const browser = await puppeteer.launch({ args: ["--no-sandbox","--disable-setuid-sandbox"] });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "16mm", left: "12mm", right: "12mm" }
    });
    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="relatorio-fluxum.pdf"`);
    return res.send(pdf);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Erro ao exportar PDF" });
  } finally {
    client.release();
  }
});


module.exports = router;
