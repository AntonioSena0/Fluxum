// utils/ports.js
const removeAccents = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const norm = (s) =>
  removeAccents(String(s || '').trim().toLowerCase());

/**
 * Dicionário enxuto com nomes e alguns UN/LOCODEs comuns.
 * Adicione o que precisar ao longo do tempo.
 */
const PORTS = [
  // Santos
  { keys: ['porto de santos', 'santos', 'brssz', 'ssz'], lat: -23.9523, lng: -46.3327 },
  // Rio de Janeiro
  { keys: ['porto do rio', 'rio de janeiro', 'riodejaneiro', 'brrio', 'rio', 'rio-rj'], lat: -22.8946, lng: -43.1670 },
  // Suape (PE)
  { keys: ['porto de suape', 'suape', 'brssu', 'ssu'], lat: -8.3961, lng: -34.9642 },
  // Rio Grande (RS)
  { keys: ['porto de rio grande', 'rio grande', 'brrig', 'rig'], lat: -32.0341, lng: -52.0986 },
  // Itajaí (SC)
  { keys: ['porto de itajai', 'itajai', 'britj', 'itj'], lat: -26.9026, lng: -48.6550 },
  // Paranaguá (PR)
  { keys: ['porto de paranagua', 'paranagua', 'brpng', 'png'], lat: -25.5146, lng: -48.5089 },
  // Salvador (BA)
  { keys: ['porto de salvador', 'salvador', 'brssa', 'ssa'], lat: -12.9714, lng: -38.5014 },
  // Vitória (ES)
  { keys: ['porto de vitoria', 'vitoria', 'brvix', 'vix'], lat: -20.3199, lng: -40.3353 },
  // Fortaleza / Mucuripe (CE)
  { keys: ['porto de fortaleza', 'fortaleza', 'brfor', 'for'], lat: -3.7184, lng: -38.5434 },
  // Pecém (CE)
  { keys: ['porto do pecem', 'pecem', 'brpec', 'pec'], lat: -3.5453, lng: -38.8289 },
];

function resolvePortCoords(input) {
  const s = norm(input);
  if (!s) return null;

  for (const p of PORTS) {
    for (const k of p.keys) {
      const nk = norm(k);
      if (s === nk || s.includes(nk) || nk.includes(s)) {
        return { lat: p.lat, lng: p.lng };
      }
    }
  }
  return null;
}

module.exports = { resolvePortCoords };
