const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const ctrl = require('../controllers/telemetry.controller');


router.post('/telemetry/events', authRequired, ctrl.ingestSmart);


router.post('/telemetry/iot-data', ctrl.receiveIoTPacket);

module.exports = router;
