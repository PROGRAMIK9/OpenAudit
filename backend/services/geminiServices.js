const fs = require('fs').promises;
const path = require('path');
const { ResponsesClient } = require('@google/generative-ai');

const MODEL_ENV_VAR = 'GEMINI_MODEL';
const ALLOWED_CATEGORIES = new Set(['food', 'travel', 'office', 'medical', 'utilities', 'entertainment', 'other']);

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.gif':
      return 'image/gif';
    case '.bmp':
      return 'image/bmp';
    case '.tiff':
    case '.tif':
      return 'image/tiff';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'image/*';
  }
}

function cleanInlineJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('No response text available to parse');
  }

  let cleaned = text.trim();
  cleaned = cleaned.replace(/```(?:json)?\s*/gi, '');
  cleaned = cleaned.replace(/```/g, '');
  cleaned = cleaned.replace(/^>\s?/gm, '');
  cleaned = cleaned.replace(/\r\n/g, '\n');

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    cleaned = jsonMatch[0];
  }

  return cleaned.trim();
}

function parseJsonSafely(text) {
  const cleaned = cleanInlineJson(text);
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    const message = `Invalid JSON from Gemini response. Raw text: ${cleaned}`;
    const error = new Error(message);
    error.original = err;
    throw error;
  }
}

function maybeNumber(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, '').trim());
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return null;
}

function normalizeText(value) {
  if (typeof value === 'string') {
    return value.trim();
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function assertReceiptShape(receipt) {
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('Parsed receipt is not a valid object');
  }

  const vendor = normalizeText(receipt.vendor);
  const amount = maybeNumber(receipt.amount);
  const currency = normalizeText(receipt.currency).toUpperCase();
  const receipt_date = normalizeText(receipt.receipt_date);
  const category = normalizeText(receipt.category).toLowerCase();
  const confidence_score = maybeNumber(receipt.confidence_score);

  if (!vendor) {
    throw new Error('Missing or invalid vendor');
  }
  if (amount === null) {
    throw new Error('Missing or invalid amount');
  }
  if (currency !== 'INR') {
    throw new Error('Currency must be INR');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receipt_date)) {
    throw new Error('receipt_date must be in YYYY-MM-DD format');
  }
  if (!ALLOWED_CATEGORIES.has(category)) {
    throw new Error(`category must be one of: ${Array.from(ALLOWED_CATEGORIES).join(', ')}`);
  }
  if (confidence_score === null) {
    throw new Error('Missing or invalid confidence_score');
  }

  if (!Array.isArray(receipt.items)) {
    throw new Error('Missing or invalid items array');
  }

  const items = receipt.items.map((item, index) => {
    if (!item || typeof item !== 'object') {
      throw new Error(`Item at index ${index} is invalid`);
    }
    const name = normalizeText(item.name);
    const quantity = maybeNumber(item.quantity);
    const price = maybeNumber(item.price);

    if (!name) {
      throw new Error(`Item at index ${index} is missing a name`);
    }
    if (quantity === null) {
      throw new Error(`Item at index ${index} has invalid quantity`);
    }
    if (price === null) {
      throw new Error(`Item at index ${index} has invalid price`);
    }

    return { name, quantity, price };
  });

  return {
    vendor,
    amount,
    currency,
    receipt_date,
    category,
    items,
    confidence_score,
  };
}

function extractTextFromResponse(response) {
  if (!response) {
    return '';
  }

  if (typeof response === 'string') {
    return response;
  }

  if (typeof response.outputText === 'string' && response.outputText.trim()) {
    return response.outputText;
  }

  if (Array.isArray(response.output)) {
    for (const output of response.output) {
      if (typeof output.text === 'string' && output.text.trim()) {
        return output.text;
      }
      if (Array.isArray(output.content)) {
        for (const content of output.content) {
          if (typeof content.text === 'string' && content.text.trim()) {
            return content.text;
          }
        }
      }
    }
  }

  if (Array.isArray(response.candidates)) {
    for (const candidate of response.candidates) {
      if (typeof candidate.outputText === 'string' && candidate.outputText.trim()) {
        return candidate.outputText;
      }
      if (Array.isArray(candidate.content)) {
        for (const content of candidate.content) {
          if (typeof content.text === 'string' && content.text.trim()) {
            return content.text;
          }
        }
      }
    }
  }

  if (response?.result?.[0]?.content?.[0]?.text) {
    return response.result[0].content[0].text;
  }

  return JSON.stringify(response);
}

async function parseReceipt(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('filePath must be a non-empty string');
  }

  const modelName = process.env[MODEL_ENV_VAR];
  if (!modelName) {
    throw new Error(`Environment variable ${MODEL_ENV_VAR} is required`);
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  let fileBuffer;
  try {
    fileBuffer = await fs.readFile(absolutePath);
  } catch (err) {
    throw new Error(`Unable to read file at ${absolutePath}: ${err.message}`);
  }

  const mimeType = getMimeType(absolutePath);
  const base64 = fileBuffer.toString('base64');

  const prompt = `You are a receipts parser. Extract only valid JSON in the exact shape shown below, with no explanations, no markdown, and no extra fields. If the receipt cannot be parsed, return a JSON object with the same keys and sensible fallback values.

{
  "vendor": "string",
  "amount": number,
  "currency": "INR",
  "receipt_date": "YYYY-MM-DD",
  "category": "food/travel/office/medical/utilities/entertainment/other",
  "items": [
    { "name": "string", "quantity": number, "price": number }
  ],
  "confidence_score": number
}

Analyze the attached receipt image or PDF and return ONLY the JSON object.`;

  const client = new ResponsesClient();
  let apiResponse;
  try {
    apiResponse = await client.responses.create({
      model: modelName,
      input: {
        text: prompt,
        image: {
          inlineData: {
            data: base64,
            mimeType,
          },
        },
      },
    });
  } catch (err) {
    const message = `Gemini API request failed: ${err.message || err}`;
    throw new Error(message);
  }

  const responseText = extractTextFromResponse(apiResponse);
  const parsed = parseJsonSafely(responseText);
  return assertReceiptShape(parsed);
}

async function runReceiptParseTest() {
  try {
    const samplePath = './uploads/sample.jpg';
    const result = await parseReceipt(samplePath);
    console.log('Receipt parse result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Receipt parse test failed:', err.message || err);
  }
}

module.exports = {
  parseReceipt,
};

if (require.main === module) {
  runReceiptParseTest();
}
