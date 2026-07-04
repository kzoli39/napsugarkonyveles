const ALLOWED_ORIGINS = new Set([
  'https://www.napsugarkonyveles.hu',
  'https://napsugarkonyveles.hu',
  'http://localhost:4173',
  'http://localhost:5500',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5500'
]);

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) {
    return true;
  }

  return /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin);
}

class AppError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function buildCorsHeaders(origin) {
  const allowOrigin = isAllowedOrigin(origin) ? origin : 'https://www.napsugarkonyveles.hu';

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

function json(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders
    }
  });
}

function sanitize(value) {
  return String(value || '')
    .trim()
    .replace(/[<>]/g, '');
}

function normalizePhone(value) {
  return String(value || '').trim().slice(0, 40);
}

async function parseIncomingPayload(request) {
  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await request.json();
  }

  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  throw new AppError('Unsupported content type', 415);
}

async function verifyTurnstile(token, remoteIp, env) {
  if (!env.TURNSTILE_SECRET_KEY) {
    return true;
  }

  if (!token) {
    return true;
  }

  const payload = new URLSearchParams();
  payload.append('secret', env.TURNSTILE_SECRET_KEY);
  payload.append('response', token);

  if (remoteIp) {
    payload.append('remoteip', remoteIp);
  }

  const verificationResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: payload
  });

  if (!verificationResponse.ok) {
    return false;
  }

  const verificationJson = await verificationResponse.json();
  return verificationJson.success === true;
}

async function sendEmail(payload, env) {
  if (!env.RESEND_API_KEY || !env.FROM_EMAIL || !env.TO_EMAIL) {
    throw new Error('Missing email configuration in worker secrets/vars');
  }

  const emailBody = [
    `Nev: ${payload.name}`,
    `Email: ${payload.email}`,
    `Telefon: ${payload.phone || '-'}`,
    `Szolgaltatas: ${payload.service}`,
    `\nUzenet:\n${payload.message}`,
    `\nForras: ${payload.source || '-'}`,
    `Bongeszo: ${payload.userAgent || '-'}`
  ].join('\n');

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: env.FROM_EMAIL,
      to: [env.TO_EMAIL],
      reply_to: payload.email,
      subject: 'Uj kapcsolatfelvetel - napsugarkonyveles.hu',
      text: emailBody
    })
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text();
    throw new Error(`Email kuldes hiba: ${errorText}`);
  }
}

function validatePayload(input) {
  const payload = {
    name: sanitize(input.name),
    email: sanitize(input.email),
    phone: normalizePhone(input.phone),
    service: sanitize(input.service),
    message: sanitize(input.message),
    company: sanitize(input.company),
    turnstileToken: sanitize(input.turnstileToken || input['cf-turnstile-response']),
    source: sanitize(input.source),
    userAgent: sanitize(input.userAgent)
  };

  if (!payload.name || !payload.email || !payload.service || !payload.message) {
    throw new AppError('Missing required fields', 400);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(payload.email)) {
    throw new AppError('Invalid email', 400);
  }

  if (payload.message.length < 8) {
    throw new AppError('Message too short', 400);
  }

  return payload;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const isContactPath = url.pathname === '/contact' || url.pathname === '/';
    if (!isContactPath) {
      return json({ success: false, error: 'Not found' }, 404, corsHeaders);
    }

    if (request.method !== 'POST') {
      return json({ success: false, error: 'Method not allowed' }, 405, corsHeaders);
    }

    try {
      const rawPayload = await parseIncomingPayload(request);
      const payload = validatePayload(rawPayload);

      // Honeypot protection: silently accept bot-like traffic.
      if (payload.company) {
        return json({ success: true }, 200, corsHeaders);
      }

      const remoteIp = request.headers.get('CF-Connecting-IP') || '';
      const isTurnstileValid = await verifyTurnstile(payload.turnstileToken, remoteIp, env);

      if (!isTurnstileValid) {
        return json({ success: false, error: 'Captcha failed' }, 400, corsHeaders);
      }

      await sendEmail(payload, env);

      return json({ success: true }, 200, corsHeaders);
    } catch (error) {
      const status = error instanceof AppError ? error.status : 500;
      const isServerError = status >= 500;

      return json(
        {
          success: false,
          error: isServerError ? 'Server error' : String(error.message || 'Bad request'),
          details: env.NODE_ENV === 'development' ? String(error.message || error) : undefined
        },
        status,
        corsHeaders
      );
    }
  }
};
