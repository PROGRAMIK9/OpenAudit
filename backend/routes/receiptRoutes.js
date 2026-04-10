const express = require("express");
const router = express.Router();

const { uploadReceipt } = require("../controllers/receiptController.js");
const upload = require("../middleware/upload.js"); // make sure this exists

router.post("/upload", upload.single("receipt"), uploadReceipt);

module.exports = router;