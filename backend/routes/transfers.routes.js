// backend/routes/transfers.routes.js
const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transfer.controller');
const { authRequired } = require('../middleware/auth'); // Protegendo as rotas

// Rota para iniciar a transferência
router.post('/transfers/start', authRequired, transferController.handleStartTransfer);

// Rota para finalizar a transferência
router.post('/transfers/end', authRequired, transferController.handleEndTransfer);

// Rota para verificar o status da transferência atual
router.get('/transfers/status', authRequired, transferController.getTransferStatus);

module.exports = router;