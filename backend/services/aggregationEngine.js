function parseAmount(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const numeric = Number(value.replace(/,/g, ''));
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  return undefined;
}

function normalizeCategory(category) {
  if (typeof category !== 'string' || category.trim() === '') return 'uncategorized';
  return category.trim();
}

function addFlag(result, flag) {
  if (!result.flags.includes(flag)) {
    result.flags.push(flag);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function aggregateFinancials(documents) {
  const result = {
    total_income: 0,
    total_expense: 0,
    net_cashflow: 0,
    taxable_income_estimate: 0,
    category_breakdown: {},
    flags: [],
    confidence: 1.0
  };

  if (!Array.isArray(documents) || documents.length === 0) {
    addFlag(result, 'sparse_data');
    result.confidence -= 0.3;
    result.net_cashflow = 0;
    result.taxable_income_estimate = 0;
    return {
      ...result,
      confidence: clamp(result.confidence, 0, 1)
    };
  }

  documents.forEach((document) => {
    const amount = parseAmount(document?.data?.amount);
    const classification = document?.classification;
    const category = normalizeCategory(document?.data?.category);
    const riskScore = typeof document?.anomaly?.risk_score === 'number' ? document.anomaly.risk_score : undefined;

    if (amount == null) {
      addFlag(result, 'missing_amount');
      result.confidence -= 0.15;
      return;
    }

    if (classification !== 'income' && classification !== 'expense') {
      addFlag(result, 'missing_classification');
      result.confidence -= 0.15;
    }

    if (classification === 'income') {
      result.total_income += amount;
    } else if (classification === 'expense') {
      result.total_expense += amount;
    }

    result.category_breakdown[category] = (result.category_breakdown[category] || 0) + amount;

    if (riskScore != null && riskScore > 0.7) {
      addFlag(result, 'high_risk_document');
      result.confidence -= 0.1;
    }

    if (document?.data?.document_date == null) {
      addFlag(result, 'missing_document_date');
      result.confidence -= 0.05;
    }
  });

  if (result.total_income === 0) {
    addFlag(result, 'no_income_detected');
    result.confidence -= 0.2;
  }

  if (result.total_expense > result.total_income * 2 && result.total_income > 0) {
    addFlag(result, 'expense_imbalance');
    result.confidence -= 0.1;
  }

  if (documents.length < 3) {
    addFlag(result, 'sparse_data');
    result.confidence -= 0.1;
  }

  result.taxable_income_estimate = result.total_income;
  result.net_cashflow = result.total_income - result.total_expense;
  result.confidence = clamp(result.confidence, 0, 1);

  return result;
}

module.exports = {
  aggregateFinancials
};
