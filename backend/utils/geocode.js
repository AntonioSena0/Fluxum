// utils/geocode.js

const { pool } = require("../database/db");

function round5(n) {
  return Math.round(Number(n) * 1e5) / 1e5;
}

function buildLabelFromOSM(addr) {
  if (!addr) return null;
  const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || null;
  const stateCode = addr.state_code || null; // alguns países preenchem state_code
  const state = stateCode || addr.state || null;
  const country = addr.country || null;

  // Prioridade BR: "Cidade, UF"
  if (addr.country_code === "br" && city && state) {
    const uf = (stateCode || state)?.split("-").pop()?.toUpperCase() || state;
    return `${city}, ${uf}`;
  }

  // genérico: "Cidade, País" ou só País
  if (city && country) return `${city}, ${country}`;
  if (state && country) return `${state}, ${country}`;
  return city || state || country || null;
}

async function lookupCache(lat, lng) {
  const latr = round5(lat), lngr = round5(lng);
  const { rows } = await pool.query(
    "SELECT label FROM place_cache WHERE lat_rounded=$1 AND lng_rounded=$2",
    [latr, lngr]
  );
  return rows[0]?.label || null;
}

async function saveCache(lat, lng, payload) {
  const latr = round5(lat), lngr = round5(lng);
  const label = payload.label || null;
  await pool.query(
    `INSERT INTO place_cache (lat_rounded, lng_rounded, label, city, state, country, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (lat_rounded,lng_rounded)
     DO UPDATE SET label=EXCLUDED.label, city=EXCLUDED.city, state=EXCLUDED.state, country=EXCLUDED.country, updated_at=now()`,
    [latr, lngr, label, payload.city || null, payload.state || null, payload.country || null]
  );
}

async function reverseGeocode(lat, lng) {
  // 1) cache
  const cached = await lookupCache(lat, lng);
  if (cached) return cached;

  // 2) nominatim (respeite rate limit)
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("zoom", "10");
  url.searchParams.set("accept-language", "pt-BR");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Fluxum/1.0 (contato@seu-dominio.com)" },
    timeout: 10_000
  });
  if (!res.ok) return null;

  const json = await res.json().catch(() => null);
  const addr = json?.address || null;
  const label = buildLabelFromOSM(addr) || json?.display_name || null;

  if (label) {
    await saveCache(lat, lng, {
      label,
      city: addr?.city || addr?.town || addr?.village || addr?.municipality || addr?.county || null,
      state: addr?.state_code || addr?.state || null,
      country: addr?.country || null
    });
  }

  return label || null;
}

module.exports = { reverseGeocode };
