// middleware/auth.js
const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  try {
    const h = req.headers.authorization || '';
    const m = h.match(/^Bearer\s+(.+)$/i);
    if (!m) return res.status(401).json({ error: 'Token ausente' });

    const payload = jwt.verify(m[1], process.env.JWT_ACCESS_SECRET);

    // sub é UUID do usuário; account_id é BIGINT
    const sub = String(payload.sub || '');
    const role = String(payload.role || 'user');
    const email = payload.email || null;
    const account_id_num = Number(payload.account_id);

    if (!sub) return res.status(401).json({ error: 'Token inválido' });
    if (!Number.isFinite(account_id_num)) {
      return res.status(401).json({ error: 'Conta inválida no token' });
    }

    // Compatibilidade: algumas rotas usam sub, outras id
    req.user = { sub, id: sub, role, email, account_id: account_id_num };
    req.account_id = account_id_num;

    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}

/**
 * requireRole('admin') → só admin
 * requireRole('admin', 'manager') → admin ou manager
 */
function requireRole(...roles) {
  const allowed = roles.map(String);
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão negada' });
    }
    return next();
  };
}

module.exports = { authRequired, requireRole };
