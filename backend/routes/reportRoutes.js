const router = require('express').Router();
const reportController = require('../controllers/reportController');

router.get('/:id/download', reportController.downloadReport);

module.exports = router;
