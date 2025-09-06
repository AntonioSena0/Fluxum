const express = require('express');
const router = express.Router();
const controller = require('../controllers/container.controller');

router.get('/containers/stats/per-day', controller.movementsPerDay);
router.get('/containers/stats/by-location', controller.byLocation);
router.get('/containers/stats/top-containers', controller.topContainers);
router.get('/containers/with-voyage', controller.listWithVoyage);


module.exports = router;
