const express = require('express');
const router = express.Router();
const controller = require('../controllers/container.controller');

router.post('/containers/register', controller.createEvent);
router.get('/containers', controller.listEvents);

module.exports = router;
