const fs = require('fs');
const { parseReceipt } = require('../services/geminiServices.js');

async function uploadReceipt(req, res) {
  const filePath = req.file && req.file.path;

  if (!filePath) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  try {
    const data = await parseReceipt(filePath);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      type: err.type || 'SERVER_ERROR',
      error: err.message,
    });
  } finally {
    fs.unlink(filePath, () => {});
  }
}

module.exports = { uploadReceipt };
