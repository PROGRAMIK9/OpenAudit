function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function parseNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function buildReasoning(messages) {
  return messages.filter(Boolean).join(' ');
}

function addAnomaly(result, type, severity, message) {
  result.anomalies.push({ type, severity, message });
  const scoreMap = { LOW: 0.1, MEDIUM: 0.3, HIGH: 0.5 };
  result.risk_score = clamp(result.risk_score + (scoreMap[severity] || 0), 0, 1);
}

function detectAmountAnomalies(document, context, result) {
  const amount = parseNumber(document.amount);
  const historical = Array.isArray(context.historicalAmounts)
    ? context.historicalAmounts.map(parseNumber).filter((value) => typeof value === 'number')
    : [];

  if (amount == null) {
    addAnomaly(result, 'missing_amount', 'MEDIUM', 'Document amount is missing or invalid.');
    return;
  }

  if (historical.length >= 3) {
    const avg = historical.reduce((sum, value) => sum + value, 0) / historical.length;
    const deviation = Math.abs(amount - avg) / (avg || 1);

    if (deviation > 2) {
      addAnomaly(result, 'amount_spike', 'HIGH', 'Amount is a large spike compared to historical values.');
    } else if (deviation > 1) {
      addAnomaly(result, 'amount_anomaly', 'MEDIUM', 'Amount deviates significantly from historical values.');
    } else if (deviation > 0.5) {
      addAnomaly(result, 'amount_variation', 'LOW', 'Amount is somewhat unusual compared to historical amounts.');
    }
  }
}

function detectDuplicateAnomalies(document, context, result) {
  const vendor = normalizeText(document.vendor);
  const amount = parseNumber(document.amount);
  const date = normalizeText(document.document_date);
  const previous = Array.isArray(context.previousDocuments) ? context.previousDocuments : [];

  if (!vendor || amount == null || !date) return;

  const duplicate = previous.some((doc) => {
    return (
      normalizeText(doc.vendor) === vendor &&
      parseNumber(doc.amount) === amount &&
      normalizeText(doc.document_date) === date
    );
  });

  if (duplicate) {
    addAnomaly(result, 'duplicate_document', 'HIGH', 'A previous document has the same vendor, amount, and date.');
  }
}

function detectDateAnomalies(document, context, result) {
  if (typeof document.document_date !== 'string' || document.document_date.trim() === '') {
    addAnomaly(result, 'missing_date', 'LOW', 'Document date is missing.');
    return;
  }

  const date = new Date(document.document_date);
  if (Number.isNaN(date.getTime())) {
    addAnomaly(result, 'invalid_date', 'MEDIUM', 'Document date format is invalid.');
    return;
  }

  const now = new Date();
  if (date.getTime() > now.getTime()) {
    addAnomaly(result, 'future_date', 'MEDIUM', 'Document date is in the future.');
  }

  const yearsOld = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
  if (yearsOld > 5) {
    addAnomaly(result, 'very_old_document', 'LOW', 'Document date is very old.');
  }
}

function detectVendorAnomalies(document, context, result) {
  const vendor = normalizeText(document.vendor);
  const knownVendors = Array.isArray(context.knownVendors)
    ? context.knownVendors.map(normalizeText)
    : [];

  if (!vendor) {
    addAnomaly(result, 'missing_vendor', 'LOW', 'Vendor is missing or unclear.');
    return;
  }

  if (knownVendors.length > 0 && !knownVendors.includes(vendor)) {
    addAnomaly(result, 'unknown_vendor', 'MEDIUM', 'Vendor is not in the known vendor list.');
  }

  if (vendor.length < 3 || /\d{3,}/.test(vendor)) {
    addAnomaly(result, 'suspicious_vendor_name', 'LOW', 'Vendor name appears suspicious or inconsistent.');
  }
}

function detectItemAnomalies(document, context, result) {
  const items = Array.isArray(document.items) ? document.items : [];
  const amount = parseNumber(document.amount);
  if (items.length === 0) return;

  const itemValues = items.map((item) => {
    const price = parseNumber(item.price);
    const qty = typeof item.quantity === 'number' && Number.isFinite(item.quantity) ? item.quantity : 1;
    return price != null ? price * qty : undefined;
  });

  const invalidItem = itemValues.some((value) => value == null);
  if (invalidItem) {
    addAnomaly(result, 'invalid_item_values', 'LOW', 'One or more item entries have invalid price or quantity.');
  }

  const sum = itemValues.reduce((sumValue, value) => sumValue + (typeof value === 'number' ? value : 0), 0);
  if (amount != null && sum > 0 && Math.abs(sum - amount) / (amount || 1) > 0.2) {
    addAnomaly(result, 'amount_item_mismatch', 'MEDIUM', 'Total item values do not match the document amount.');
  }

  const highValueItems = items.filter((item) => parseNumber(item.price) > 10000);
  if (highValueItems.length >= 2) {
    addAnomaly(result, 'high_value_items', 'MEDIUM', 'Multiple high-value items were detected.');
  }
}

function detectDataQualityIssues(document, context, result) {
  if (typeof document.confidence_score === 'number' && document.confidence_score < 0.5) {
    addAnomaly(result, 'low_confidence_score', 'LOW', 'Document confidence score is low.');
  }

  if (!document.category || !document.document_type || !document.currency) {
    addAnomaly(result, 'missing_fields', 'LOW', 'One or more important fields are missing.');
  }
}

const anomalyPipeline = [
  detectAmountAnomalies,
  detectDuplicateAnomalies,
  detectDateAnomalies,
  detectVendorAnomalies,
  detectItemAnomalies,
  detectDataQualityIssues
];

function detectAnomalies(document = {}, context = {}) {
  const result = {
    anomalies: [],
    risk_score: 0,
    recommended_action: 'accept',
    reasoning: ''
  };

  anomalyPipeline.forEach((rule) => rule(document, context, result));

  result.risk_score = clamp(result.risk_score, 0, 1);
  if (result.risk_score < 0.3) {
    result.recommended_action = 'accept';
  } else if (result.risk_score < 0.7) {
    result.recommended_action = 'review';
  } else {
    result.recommended_action = 'reject';
  }

  result.reasoning = buildReasoning(result.anomalies.map((entry) => entry.message));

  return result;
}

module.exports = {
  detectAnomalies
};
