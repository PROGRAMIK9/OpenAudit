const router = require('express').Router();
const taxController = require('../controllers/taxController');
const { sendTaxReportOnWhatsApp } = require('../controllers/taxDeliveryController');
const { authenticate } = require('../middleware/authMiddleware');
router.post('/calculate', authenticate, taxController.calculateTax);
router.post('/send-report', authenticate, taxController.sendTaxReport);
router.get('/history', authenticate, taxController.getHistory);
router.post('/send-whatsapp', authenticate, sendTaxReportOnWhatsApp);
module.exports = router;