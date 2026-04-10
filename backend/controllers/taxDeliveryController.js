const { generateTaxPdf } = require('../services/pdfService');
const { uploadPdfBuffer } = require('../services/cloudinaryUploadService');
const { sendWhatsAppMedia, validateRecipientNumber } = require('../services/twilioService');

function validateTaxResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('A valid tax result object is required.');
  }
  return result;
}

exports.sendTaxReportOnWhatsApp = async (req, res) => {
  try {
    const { phone, result } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, message: 'phone is required and must be a string.' });
    }

    const recipientNumber = validateRecipientNumber(phone);
    const taxResult = validateTaxResult(result);

    const pdfBuffer = await generateTaxPdf(taxResult);
    const url = await uploadPdfBuffer(pdfBuffer);

    await sendWhatsAppMedia(recipientNumber, 'Your tax report is ready. Please find the attached PDF.', url);

    return res.json({
      success: true,
      message: 'PDF sent successfully',
      url
    });
  } catch (error) {
    console.error('sendTaxReportOnWhatsApp error:', error?.message || error);
    return res.status(400).json({
      success: false,
      message: error?.message || 'Failed to send tax report via WhatsApp.'
    });
  }
};
