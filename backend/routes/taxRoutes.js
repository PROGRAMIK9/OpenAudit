const router = require('express').Router();
const taxController = require('../controllers/taxController');
const { authenticate } = require('../middleware/authMiddleware');
router.post('/calculate', authenticate, taxController.calculateTax);
router.post('/send-report', authenticate, taxController.sendTaxReport);
router.get('/history', authenticate, taxController.getHistory);
module.exports = router;