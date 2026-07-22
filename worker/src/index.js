const MATTERS = new Set(['Probate', 'Estate Planning', 'Trust Administration', 'Other']);
const CONTACT_METHODS = new Set(['Phone', 'Email']);

export function allowedOrigin(origin, env) {
  if (!origin) return null;
  const exact = (env.ALLOWED_ORIGINS || '').split(',').map((v) => v.trim()).filter(Boolean);
  if (exact.includes(origin)) return origin;
  const project = (env.ALLOWED_VERCEL_PROJECT || '').trim().toLowerCase();
  if (!project) return null;
  try {
    const { protocol, hostname, port } = new URL(origin);
    const label = hostname.endsWith('.vercel.app') ? hostname.slice(0, -11) : '';
    if (protocol === 'https:' && !port && (label === project || label.startsWith(`${project}-`))) return origin;
  } catch { return null; }
  return null;
}

function reply(body, status, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

function clean(value, max) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function validate(form) {
  const data = { name: clean(form.get('name'), 100), phone: clean(form.get('phone'), 30), email: clean(form.get('email'), 254).toLowerCase(), matter: clean(form.get('matter'), 40), preferred: clean(form.get('preferred'), 10), message: clean(form.get('message'), 2000), acknowledgment: clean(form.get('acknowledgment'), 20), website: clean(form.get('website'), 200), token: clean(form.get('cf-turnstile-response'), 2048) };
  if (data.website) return { error: 'Submission rejected.' };
  if (data.name.length < 2) return { error: 'Please enter your name.' };
  if (!/^[+()\-\d\s.]{7,30}$/.test(data.phone)) return { error: 'Please enter a valid phone number.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: 'Please enter a valid email address.' };
  if (!MATTERS.has(data.matter)) return { error: 'Please select a valid matter type.' };
  if (!CONTACT_METHODS.has(data.preferred)) return { error: 'Please select a valid contact method.' };
  if (data.acknowledgment !== 'accepted') return { error: 'Please accept the consultation-form acknowledgment.' };
  if (!data.token) return { error: 'Please complete the security check.' };
  return { data };
}

async function hash(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function belowRateLimit(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `intake:${await hash(`${env.RATE_LIMIT_SALT}:${ip}`)}`;
  const current = Number(await env.RATE_LIMIT.get(key)) || 0;
  if (current >= Number(env.RATE_LIMIT_MAX || 5)) return false;
  await env.RATE_LIMIT.put(key, String(current + 1), { expirationTtl: Number(env.RATE_LIMIT_WINDOW_SECONDS || 600) });
  return true;
}

async function verifyTurnstile(token, ip, env) {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set('remoteip', ip);
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body }).then((r) => r.json());
  const hosts = (env.ALLOWED_TURNSTILE_HOSTNAMES || '').split(',').map((v) => v.trim()).filter(Boolean);
  return result.success && (!hosts.length || hosts.includes(result.hostname));
}

async function sendEmail(data, request, env) {
  const text = [`Name: ${data.name}`, `Phone: ${data.phone}`, `Email: ${data.email}`, `Matter: ${data.matter}`, `Preferred contact: ${data.preferred}`, `General description: ${data.message || '(none provided)'}`, '', `Submitted: ${new Date().toISOString()}`, `Request ID: ${request.headers.get('CF-Ray') || crypto.randomUUID()}`, '', 'Website submission only. Representation is not established until confirmed in writing after a conflicts review.'].join('\n');
  await env.INTAKE_EMAIL.send({ from: { email: env.EMAIL_FROM, name: 'RYANTRUST Website' }, to: env.EMAIL_TO, subject: `Consultation request: ${data.matter}`, text });
}

export default { async fetch(request, env) {
  const origin = allowedOrigin(request.headers.get('Origin'), env);
  if (!origin) return reply({ error: 'Origin not allowed.' }, 403);
  if (new URL(request.url).pathname !== '/intake') return reply({ error: 'Not found.' }, 404, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' } });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405, origin);
  const type = request.headers.get('Content-Type') || '';
  if (!type.startsWith('multipart/form-data') && !type.startsWith('application/x-www-form-urlencoded')) return reply({ error: 'Unsupported request format.' }, 415, origin);
  if (!env.RATE_LIMIT || !env.RATE_LIMIT_SALT || !env.TURNSTILE_SECRET_KEY || !env.INTAKE_EMAIL) return reply({ error: 'Intake service is not configured.' }, 503, origin);
  if (!(await belowRateLimit(request, env))) return reply({ error: 'Too many requests. Please wait and try again.' }, 429, origin);
  let form;
  try {
    const body = await request.arrayBuffer();
    if (body.byteLength > 16384) return reply({ error: 'Request is too large.' }, 413, origin);
    form = await new Request(request.url, { method: 'POST', headers: { 'Content-Type': type }, body }).formData();
  } catch { return reply({ error: 'Invalid form submission.' }, 400, origin); }
  const result = validate(form);
  if (result.error) return reply({ error: result.error }, 400, origin);
  if (!(await verifyTurnstile(result.data.token, request.headers.get('CF-Connecting-IP'), env))) return reply({ error: 'Security verification failed. Please try again.' }, 400, origin);
  try { await sendEmail(result.data, request, env); } catch (error) { console.error('Email delivery failed', error); return reply({ error: 'We could not deliver your request.' }, 502, origin); }
  return reply({ ok: true }, 200, origin);
} };
