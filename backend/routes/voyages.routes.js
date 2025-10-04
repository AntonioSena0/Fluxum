// routes/voyages.routes.js
const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');  // << importa!
const ctrl = require('../controllers/voyages.controller');


router.post('/voyages', authRequired, ctrl.create);

router.post('/voyages/:id/start', authRequired, ctrl.start);
router.post('/voyages/:id/arrive', authRequired, ctrl.arrive);
router.post('/voyages/:id/complete', authRequired, ctrl.complete);
router.get('/voyages/:id/last-update', authRequired, ctrl.lastUpdate);
router.post('/voyages/:id/containers', authRequired, ctrl.addContainers);
router.get('/voyages/:id/containers', authRequired, ctrl.listContainers);
router.get('/voyages/:id/trail', authRequired, ctrl.trail);

module.exports = router;
