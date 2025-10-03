const express = require("express");
const { authRequired } = require("../middleware/auth");
const ctrl = require("../controllers/alerts.controller");
const router = express.Router();

router.get("/alerts", authRequired, ctrl.list);
router.patch("/alerts/:id/ack", authRequired, ctrl.ack);
router.delete("/alerts/:id", authRequired, ctrl.remove);

module.exports = router;
