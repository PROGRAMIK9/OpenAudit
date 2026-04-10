const axios = require('axios');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER
} = process.env;

function ensureTwilioConfig() {
  const missing = [];

  if (!TWILIO_ACCOUNT_SID) missing.push('TWILIO_ACCOUNT_SID');
  if (!TWILIO_AUTH_TOKEN) missing.push('TWILIO_AUTH_TOKEN');
  if (!TWILIO_WHATSAPP_NUMBER) missing.push('TWILIO_WHATSAPP_NUMBER');

  if (missing.length > 0) {
    throw new Error(`Missing Twilio environment variables: ${missing.join(', ')}`);
  }

  if (TWILIO_WHATSAPP_NUMBER !== 'whatsapp:+14155238886') {
    throw new Error('TWILIO_WHATSAPP_NUMBER must be set to whatsapp:+14155238886 for Twilio WhatsApp Sandbox usage.');
  }

  return {
    accountSid: TWILIO_ACCOUNT_SID,
    authToken: TWILIO_AUTH_TOKEN,
    whatsappNumber: TWILIO_WHATSAPP_NUMBER
  };
}

function validateRecipientNumber(value) {
  if (typeof value !== 'string') {
    throw new Error('Recipient phone number must be a string in E.164 format, for example +919876543210.');
  }

  const normalized = value.trim();
  const formatted = normalized.startsWith('+') ? normalized : `+${normalized}`;
  const e164Pattern = /^\+[1-9]\d{1,14}$/;

  if (!e164Pattern.test(formatted)) {
    throw new Error('Recipient phone number must be in E.164 format, for example +919876543210.');
  }

  return formatted;
}

function validatePdfUrl(pdfUrl) {
  if (!pdfUrl) {
    return null;
  }

  if (typeof pdfUrl !== 'string') {
    throw new Error('pdfUrl must be a string representing a public URL.');
  }

  let parsed;
  try {
    parsed = new URL(pdfUrl);
  } catch (err) {
    throw new Error('pdfUrl must be a valid public URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new Error('pdfUrl must be a valid public URL with http or https protocol.');
  }

  return pdfUrl;
}

function buildTwilioErrorMessage(error) {
  const response = error.response;
  const status = response?.status;
  const data = response?.data;
  const details = data?.message || error.message || 'Unknown error from Twilio.';

  if (status === 401 || status === 403) {
    return `Twilio authentication failed. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN. ${details}`;
  }

  if (data?.code === 63017 || (typeof details === 'string' && details.toLowerCase().includes('sandbox'))) {
    return 'The recipient number is not joined to the Twilio WhatsApp Sandbox. Ask the user to send JOIN to the sandbox WhatsApp number.';
  }

  if (data?.code === 21608) {
    return 'Twilio sender number is not authorized for WhatsApp sandbox messaging. Verify TWILIO_WHATSAPP_NUMBER is correct.';
  }

  return `Twilio WhatsApp send failed: ${details}`;
}

async function sendWhatsAppMessage({ recipientNumber, body, pdfUrl }) {
  const { accountSid, authToken, whatsappNumber } = ensureTwilioConfig();

  if (!body || typeof body !== 'string' || body.trim() === '') {
    throw new Error('Message body is required.');
  }

  const to = `whatsapp:${validateRecipientNumber(recipientNumber)}`;
  const mediaUrl = validatePdfUrl(pdfUrl);

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const payload = new URLSearchParams();

  payload.append('From', whatsappNumber);
  payload.append('To', to);
  payload.append('Body', body.trim());

  if (mediaUrl) {
    payload.append('MediaUrl', mediaUrl);
  }

  try {
    const response = await axios.post(twilioUrl, payload.toString(), {
      auth: {
        username: accountSid,
        password: authToken
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log(`Twilio WhatsApp message sent successfully. SID=${response.data.sid}`);
    return {
      success: true,
      sid: response.data.sid,
      status: response.data.status,
      to: response.data.to,
      from: response.data.from
    };
  } catch (error) {
    const message = buildTwilioErrorMessage(error);
    console.error('Twilio WhatsApp error:', error?.toString(), error?.response?.data || 'No response data');
    throw new Error(message);
  }
}

async function sendWhatsAppPDF(recipientNumber, pdfUrl, body = 'Your tax report is ready.') {
  return sendWhatsAppMessage({ recipientNumber, body, pdfUrl });
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppPDF,
  validateRecipientNumber,
  validatePdfUrl,
  ensureTwilioConfig
};
