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

function buildReason(segments) {
  return segments.filter(Boolean).join(' ');
}

function applyAmountAndDateRules(document, result) {
  const amount = parseNumber(document.amount);
  const now = new Date();
  let invalidAmount = false;

  if (amount == null || typeof amount !== 'number' || amount <= 0) {
    result.flags.push('invalid_or_missing_amount');
    result.confidence -= 0.25;
    invalidAmount = true;
  }

  if (!invalidAmount) {
    result.amount = amount;
  }

  if (typeof document.document_date === 'string' && document.document_date.trim() !== '') {
    const date = new Date(document.document_date);
    if (!Number.isNaN(date.getTime())) {
      const diffMs = date.getTime() - now.getTime();
      if (diffMs > 0) {
        result.flags.push('future_date');
        result.confidence -= 0.1;
      }
      const yearsOld = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
      if (yearsOld > 5) {
        result.flags.push('very_old_date');
        result.confidence -= 0.1;
      }
    } else {
      result.flags.push('invalid_date_format');
      result.confidence -= 0.15;
    }
  } else if (document.document_date != null) {
    result.flags.push('invalid_date_format');
    result.confidence -= 0.15;
  }
}

function applyClassificationRules(document, result) {
  const category = normalizeText(document.category);
  const vendor = normalizeText(document.vendor);
  const docType = normalizeText(document.document_type);

  const incomeKeywords = [
    'salary',
    'payroll',
    'refund',
    'rebate',
    'commission',
    'credit',
    'payout',
    'income',
    'deposit',
    'receipt',
    'payment received'
  ];
  const expenseKeywords = [
    'purchase',
    'bill',
    'expense',
    'invoice',
    'utility',
    'rent',
    'travel',
    'taxi',
    'food',
    'dining',
    'hotel',
    'subscription',
    'membership',
    'payment',
    'fuel',
    'repair'
  ];

  const textSources = [category, vendor, docType].filter(Boolean).join(' ');
  const matchIncome = incomeKeywords.some((keyword) => textSources.includes(keyword));
  const matchExpense = expenseKeywords.some((keyword) => textSources.includes(keyword));

  if (matchIncome && !matchExpense) {
    result.classification = 'income';
  } else if (matchExpense && !matchIncome) {
    result.classification = 'expense';
  } else if (matchIncome && matchExpense) {
    if (category.includes('refund') || vendor.includes('refund')) {
      result.classification = 'income';
    } else {
      result.classification = 'unknown';
    }
  }

  if (category && !result.classification) {
    if (category.includes('refund') || category.includes('salary')) {
      result.classification = 'income';
    } else if (category.includes('expense') || category.includes('bill')) {
      result.classification = 'expense';
    }
  }

  if (result.classification !== 'unknown') {
    result.confidence += 0.1;
  }
}

function applyContentAnalysisRules(document, result) {
  const vendor = normalizeText(document.vendor);
  const category = normalizeText(document.category);
  const docType = normalizeText(document.document_type);

  const keywordMap = [
    { keywords: ['salary', 'payroll', 'income'], classification: 'income', flag: 'income_related' },
    { keywords: ['refund', 'rebate'], classification: 'income', flag: 'refund_related' },
    { keywords: ['subscription', 'membership'], classification: 'expense', flag: 'subscription_expense' },
    { keywords: ['utility', 'electricity', 'water', 'internet'], classification: 'expense', flag: 'utility_expense' },
    { keywords: ['travel', 'taxi', 'flight', 'hotel'], classification: 'expense', flag: 'travel_expense' },
    { keywords: ['fuel', 'repair', 'maintenance'], classification: 'expense', flag: 'vehicle_expense' },
    { keywords: ['invoice', 'bill', 'purchase', 'vendor'], classification: 'expense', flag: 'invoice_expense' }
  ];

  const combined = [vendor, category, docType].join(' ');
  const items = Array.isArray(document.items) ? document.items : [];
  const itemNames = items
    .map((item) => normalizeText(item?.name))
    .filter(Boolean)
    .join(' ');
  const searchText = `${combined} ${itemNames}`;

  keywordMap.forEach(({ keywords, classification, flag }) => {
    if (keywords.some((keyword) => searchText.includes(keyword))) {
      if (!result.flags.includes(flag)) {
        result.flags.push(flag);
      }
      if (result.classification === 'unknown') {
        result.classification = classification;
      }
    }
  });

  if (items.length > 0) {
    const invalidItem = items.some((item) => item == null || typeof item !== 'object' || !normalizeText(item.name));
    if (invalidItem) {
      result.flags.push('invalid_item_entries');
      result.confidence -= 0.1;
    }
  }
}

function applyTaxRelevanceAndImpactRules(result) {
  if (result.classification === 'income') {
    result.tax_relevance = 'taxable';
    result.impact = 'increase_income';
  } else if (result.classification === 'expense') {
    result.tax_relevance = 'non_deductible';
    result.impact = 'no_effect';
  } else {
    result.tax_relevance = 'unknown';
    result.impact = 'no_effect';
  }
}

function applyConfidenceScore(document, result) {
  if (typeof document.confidence_score === 'number' && Number.isFinite(document.confidence_score)) {
    const externalScore = clamp(document.confidence_score, 0, 1);
    result.confidence = clamp((result.confidence + externalScore) / 2, 0, 1);
  } else {
    result.confidence = clamp(result.confidence, 0, 1);
  }
}

function buildResultReasoning(document, result) {
  const segments = [];
  segments.push(`classified_as_${result.classification}`);
  segments.push(`tax_relevance_${result.tax_relevance}`);

  if (result.flags.length > 0) {
    segments.push(`flags_${result.flags.join(',')}`);
  }

  if (typeof document.confidence_score === 'number') {
    segments.push('external_confidence_used');
  }

  result.reasoning = buildReason(segments);
}

const rulePipeline = [
  applyAmountAndDateRules,
  applyClassificationRules,
  applyContentAnalysisRules,
  applyTaxRelevanceAndImpactRules,
  applyConfidenceScore,
  buildResultReasoning
];

function evaluateDocument(document = {}) {
  const result = {
    classification: 'unknown',
    tax_relevance: 'unknown',
    impact: 'no_effect',
    flags: [],
    confidence: 1.0,
    reasoning: ''
  };

  rulePipeline.forEach((rule) => {
    rule(document, result);
  });

  result.confidence = clamp(result.confidence, 0, 1);

  return {
    classification: result.classification,
    tax_relevance: result.tax_relevance,
    impact: result.impact,
    flags: result.flags,
    confidence: result.confidence,
    reasoning: result.reasoning
  };
}

module.exports = {
  evaluateDocument
};
