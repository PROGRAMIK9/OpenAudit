const PDFDocument = require('pdfkit');

function formatCurrency(value) {
  const number = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(number)) {
    return '₹0.00';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(number);
}

function safeNumber(value) {
  const number = typeof value === 'number' ? value : parseFloat(value);
  return Number.isNaN(number) ? 0 : number;
}

function formatPdfCurrency(value) {
  const number = typeof value === 'number' ? value : parseFloat(value);
  if (Number.isNaN(number)) {
    return 'Rs. 0.00';
  }

  return `Rs. ${number.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function writeLabelValue(doc, label, value) {
  doc.font('Helvetica-Bold').text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(`${value}`);
}

function drawInputRow(doc, label, value, y) {
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#64748b')
    .text(label, 64, y, { width: 260 });

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#0f172a')
    .text(value, 320, y, { align: 'right', width: 211 });
}

function drawMetricCard(doc, title, taxableIncome, tax, x, y, color) {
  doc
    .roundedRect(x, y, 205, 116, 10)
    .fillAndStroke('#ffffff', '#e2e8f0');

  doc
    .roundedRect(x, y, 205, 26, 10)
    .fill(color);

  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#ffffff')
    .text(title, x + 16, y + 8);

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#64748b')
    .text('Taxable Income', x + 16, y + 46);

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor('#0f172a')
    .text(formatPdfCurrency(taxableIncome), x + 16, y + 61, { width: 173 });

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#64748b')
    .text('Estimated Tax', x + 16, y + 84);

  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor(color)
    .text(formatPdfCurrency(tax), x + 16, y + 98, { width: 173 });
}

function drawSectionTitle(doc, title, y) {
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor('#1f2937')
    .text(title, 64, y, { width: 467 });

  doc
    .moveTo(64, y + 20)
    .lineTo(531, y + 20)
    .strokeColor('#e5e7eb')
    .stroke();
}

async function generateTaxPdf(result = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 48 });
  const chunks = [];

  doc.on('data', (chunk) => chunks.push(chunk));
  doc.on('error', (err) => {
    throw err;
  });

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const savings = typeof result.savings === 'number'
    ? Math.abs(result.savings)
    : Math.abs(safeNumber(result.oldRegime?.tax) - safeNumber(result.newRegime?.tax));
  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  doc.rect(0, 0, pageWidth, pageHeight).fill('#f8fafc');
  doc.rect(0, 0, pageWidth, 108).fill('#0c4a6e');
  doc.circle(pageWidth - 64, 18, 48).fill('#0e7490');
  doc.circle(pageWidth - 18, 78, 28).fill('#155e75');

  doc
    .font('Helvetica-Bold')
    .fontSize(24)
    .fillColor('#ffffff')
    .text('OpenAudit Tax Report', 48, 30, { width: 360 });

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor('#cffafe')
    .text('Personalized tax regime comparison and savings summary', 48, 62, { width: 360 });

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor('#ffffff')
    .text(`Generated on ${generatedDate}`, pageWidth - 210, 34, { align: 'right', width: 162 });

  doc
    .roundedRect(48, 148, 499, 142, 12)
    .fillAndStroke('#ffffff', '#e2e8f0');

  drawSectionTitle(doc, 'Income & Deduction Inputs', 164);
  drawInputRow(doc, 'Annual Income', formatPdfCurrency(result.annualIncome), 202);
  drawInputRow(doc, 'Investments under 80C', formatPdfCurrency(result.investments), 224);
  drawInputRow(doc, 'Other Deductions', formatPdfCurrency(result.otherDeductions), 246);
  drawInputRow(doc, 'Rent Paid', formatPdfCurrency(result.rentPaid), 268);

  drawSectionTitle(doc, 'Regime Comparison', 324);
  drawMetricCard(doc, 'Old Regime', result.oldRegime?.taxableIncome, result.oldRegime?.tax, 48, 360, '#dc2626');
  drawMetricCard(doc, 'New Regime', result.newRegime?.taxableIncome, result.newRegime?.tax, 342, 360, '#16a34a');

  doc
    .roundedRect(48, 520, 499, 104, 12)
    .fillAndStroke('#eef2ff', '#c7d2fe');

  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor('#4338ca')
    .text('Recommendation', 64, 542, { width: 467 });

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#1e293b')
    .text(`Go with the ${result.recommendation || 'recommended regime'}`, 64, 566, { width: 467 });

  doc
    .font('Helvetica')
    .fontSize(12)
    .fillColor('#4f46e5')
    .text(`Estimated savings: ${formatPdfCurrency(savings)}`, 64, 596, { width: 467 });

  doc
    .moveTo(48, pageHeight - 88)
    .lineTo(547, pageHeight - 88)
    .strokeColor('#cbd5e1')
    .stroke();

  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor('#64748b')
    .text('Generated by OpenAudit', 48, pageHeight - 72, { align: 'center', width: 499 });

  doc.end();

  return new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

module.exports = {
  generateTaxPdf
};
