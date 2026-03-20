const express = require('express');
const router = express.Router();
const { getProgress } = require('../controllers/progressController');

router.get('/:attemptId', getProgress);

module.exports = router;