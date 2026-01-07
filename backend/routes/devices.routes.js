const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/devices.controller');
const { authRequired } = require('../middleware/auth');

router.post('/devices', authRequired, ctrl.create);
router.post('/containers/:id/devices/attach', authRequired, ctrl.attachToContainer);
router.get('/devices', authRequired, ctrl.list);

// --- NOVA ROTA DE DELETE ---
// O :id será o MAC Address (ex: 5C:01:3B...)
router.delete('/devices/:id', authRequired, ctrl.delete);

module.exports = router;