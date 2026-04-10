const db = require('../config/db');
const { generateTaxPdf } = require('../services/pdfService');

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildTaxResultFromTransaction(tx) {
  const annualIncome = parseNumber(tx.annualincome);
  const investments = parseNumber(tx.investments_80c);
  const otherDeductions = parseNumber(tx.other_deductions);
  const rentPaid = parseNumber(tx.rent_paid);
  const standardDeductionOld = parseNumber(tx.standard_deduction) || 50000;
  const hraExemption = parseNumber(tx.hra_exemption);
  const standardDeductionNew = 75000;

  const oldTaxableIncome = Math.max(0, annualIncome - standardDeductionOld - investments - hraExemption - otherDeductions);
  const newTaxableIncome = Math.max(0, annualIncome - standardDeductionNew);

  return {
    annualIncome,
    investments,
    otherDeductions,
    rentPaid,
    oldRegime: {
      taxableIncome: oldTaxableIncome,
      tax: parseNumber(tx.calculated_old_tax)
    },
    newRegime: {
      taxableIncome: newTaxableIncome,
      tax: parseNumber(tx.calculated_new_tax)
    },
    recommendation: tx.recommendation || 'N/A',
    savings: parseNumber(tx.savings)
  };
}

exports.downloadReport = async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (Number.isNaN(reportId) || reportId <= 0) {
      return res.status(400).json({ error: 'Invalid report id.' });
    }

    const result = await db.query('SELECT * FROM transactions WHERE id=$1', [reportId]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Report not found.' });
    }

    const transaction = result.rows[0];
    const taxResult = buildTaxResultFromTransaction(transaction);
    const pdfBuffer = await generateTaxPdf(taxResult);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="report.pdf"');
    res.setHeader('Cache-Control', 'private, max-age=0, no-transform');
    res.send(pdfBuffer);
  } catch (error) {
    console.error('downloadReport error:', error?.message || error);
    res.status(500).json({ error: 'Unable to generate or download the report.' });
  }
};
