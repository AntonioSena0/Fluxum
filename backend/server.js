// server.js (CommonJS)
const express = require('express');
const dotenv = require('dotenv');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

const { logger, requestId, httpLogger, metricsRoute } = require('./utils/observability');

// DB
const { pool, query } = require('./database/db');

// Rotas existentes (IoT)
const containerRoutes = require('./routes/containerRoutes');

// Rotas novas
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Proxy/IP real
app.set('trust proxy', 1);

// Segurança
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS
const origins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: origins.length ? origins : false,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS']
}));

// Body & cookies
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// Observabilidade
app.use(requestId());
app.use(httpLogger());
metricsRoute(app); // GET /metrics

// Rate limiting global e slow down 
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });

const speed = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 100,
  delayMs: () => 250
});

// Rate especifico para endpoints sensiveis
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Muitas tentativas, tente depois.' });
const forgotLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5 });

app.use(limiter);
app.use(speed);
app.use('/auth/login', authLimiter);
app.use('/auth/forgot-password', forgotLimiter);

// Health e readiness
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/ready', async (_req, res) => {
  try {
    await query('SELECT 1');
    res.json({ ready: true });
  } catch {
    res.status(500).json({ ready: false });
  }
});

// Rotas IoT
app.use('/api/containers', containerRoutes);

// Rotas de auth/usuários
app.use('/auth', authRoutes);
app.use('/users', usersRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

// Erro global
app.use((err, req, res, _next) => {
  logger.error({ err, reqId: req.id }, 'Unhandled error');
  res.status(500).json({ error: 'Erro interno', reqId: req.id });
});

// Subir servidor
const server = app.listen(PORT, () => {
  logger.info(`Servidor rodando na porta ${PORT}`);
});

// Timeouts e graceful shutdown
server.setTimeout(30_000);

async function shutdown() {
  logger.info('Encerrando com graceful shutdown...');
  server.close(async () => {
    try { await pool.end(); } finally { process.exit(0); }
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
