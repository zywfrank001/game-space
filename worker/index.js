const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json;charset=utf-8' }, CORS)
  });
}

const enc = text => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const dec = str => new TextDecoder().decode(
  Uint8Array.from(atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4)), c => c.charCodeAt(0))
);
const bytesToUrl = bytes => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const urlToBytes = str => Uint8Array.from(
  atob(String(str).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((String(str).length + 3) % 4)),
  c => c.charCodeAt(0)
);

async function hashPassword(password, saltValue) {
  const salt = saltValue ? urlToBytes(saltValue) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256
  );
  return { salt: bytesToUrl(salt), hash: bytesToUrl(new Uint8Array(bits)) };
}

async function signToken(subject, secret, ttlSeconds) {
  const header = enc(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = enc(JSON.stringify({ sub: subject, exp: Math.floor(Date.now() / 1000) + (ttlSeconds || 604800) }));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(header + '.' + body));
  return header + '.' + body + '.' + bytesToUrl(new Uint8Array(sig));
}

async function verifyToken(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  try {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('HMAC', key, urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!ok) return null;
    const payload = JSON.parse(dec(parts[1]));
    if (!payload.sub || (payload.exp && payload.exp < Date.now() / 1000)) return null;
    return payload;
  } catch (e) { return null; }
}

const publicUser = u => ({ id: u.id, email: u.email, is_pro: !!u.is_pro, expire: u.expire || null, created: u.created });

async function requireUser(request, env) {
  const header = request.headers.get('Authorization') || '';
  const payload = await verifyToken(header.replace(/^Bearer\s+/i, ''), env.JWT_SECRET);
  if (!payload) throw new ApiError(401, '请先登录');
  const user = await env.USER_KV.get('user:' + payload.sub, 'json');
  if (!user) throw new ApiError(401, '账号不存在');
  return { id: payload.sub, user };
}

async function readBody(request) {
  try { return await request.json() || {}; }
  catch (e) { throw new ApiError(400, '请求格式错误'); }
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (path === '/api/track') return new Response(null, { status: 204, headers: CORS });

  if (path === '/api/register' && request.method === 'POST') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new ApiError(400, '邮箱格式不正确');
    if (password.length < 8) throw new ApiError(400, '密码至少 8 位');
    if (await env.USER_KV.get('user:' + email)) throw new ApiError(409, '邮箱已注册');

    const pw = await hashPassword(password);
    const user = {
      id: email, email, hash: pw.hash, salt: pw.salt,
      is_pro: false, expire: null, created: new Date().toISOString()
    };
    await env.USER_KV.put('user:' + email, JSON.stringify(user));
    const token = await signToken(email, env.JWT_SECRET);
    return json({ ok: true, token, user: publicUser(user) });
  }

  if (path === '/api/login' && request.method === 'POST') {
    const body = await readBody(request);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = await env.USER_KV.get('user:' + email, 'json');
    if (!user) throw new ApiError(401, '邮箱或密码错误');
    const check = await hashPassword(password, user.salt);
    if (check.hash !== user.hash) throw new ApiError(401, '邮箱或密码错误');
    const token = await signToken(email, env.JWT_SECRET);
    return json({ ok: true, token, user: publicUser(user) });
  }

  if (path === '/api/save' && request.method === 'POST') {
    const { id } = await requireUser(request, env);
    const body = await readBody(request);
    const game = String(body.game || '').trim();
    if (!game || game.length > 120) throw new ApiError(400, '游戏标识无效');
    await env.SAVE_KV.put('save:' + id + ':' + game, JSON.stringify({
      data: body.data || {}, updated_at: new Date().toISOString()
    }));
    return json({ ok: true, game, updated_at: new Date().toISOString() });
  }

  const saveMatch = path.match(/^\/api\/save\/(.+)$/);
  if (saveMatch && request.method === 'GET') {
    const { id } = await requireUser(request, env);
    const game = decodeURIComponent(saveMatch[1]);
    const rec = await env.SAVE_KV.get('save:' + id + ':' + game, 'json');
    if (!rec) return json({ game, data: {}, saved_at: null });
    return json({ game, data: rec.data, saved_at: rec.updated_at });
  }

  if (path === '/api/export' && request.method === 'GET') {
    const { id } = await requireUser(request, env);
    const listed = await env.SAVE_KV.list({ prefix: 'save:' + id + ':' });
    const saves = {};
    for (const item of listed.keys) {
      const game = item.name.slice(('save:' + id + ':').length);
      const rec = await env.SAVE_KV.get(item.name, 'json');
      if (rec) saves[game] = { data: rec.data, saved_at: rec.updated_at };
    }
    const payload = { v: 1, user_id: id, saves, exported_at: new Date().toISOString() };
    const code = enc(JSON.stringify(payload));
    const expire = new Date(Date.now() + 7 * 86400000).toISOString();
    await env.EXPORT_KV.put('export:' + code, JSON.stringify({ user_id: id, saves, expire }), { expirationTtl: 604800 });
    return json({ code, expire, count: Object.keys(saves).length });
  }

  if (path === '/api/import' && request.method === 'POST') {
    const { id } = await requireUser(request, env);
    const body = await readBody(request);
    const code = String(body.code || '').trim();
    if (!code) throw new ApiError(400, '存档码不能为空');
    let payload = await env.EXPORT_KV.get('export:' + code, 'json');
    if (!payload) {
      try { payload = JSON.parse(dec(code)); } catch (e) { throw new ApiError(400, '存档码无效或已过期'); }
    }
    const saves = payload.saves || {};
    const keys = Object.keys(saves);
    if (!keys.length) throw new ApiError(400, '存档码中没有数据');
    for (const game of keys) {
      const rec = saves[game];
      await env.SAVE_KV.put('save:' + id + ':' + game, JSON.stringify({
        data: rec.data || {}, updated_at: rec.saved_at || new Date().toISOString()
      }));
    }
    return json({ ok: true, imported: keys.length });
  }

  if (path === '/api/score' && request.method === 'POST') {
    const { id } = await requireUser(request, env);
    const body = await readBody(request);
    const game = String(body.game || '').trim();
    const score = Number(body.score);
    if (!game || !Number.isFinite(score)) throw new ApiError(400, '分数数据无效');
    const row = { score, date: new Date().toISOString() };
    await env.SCORE_KV.put('score:' + game + ':' + id, JSON.stringify(row));
    return json({ ok: true, ...row });
  }

  if (path === '/api/sub' && request.method === 'GET') {
    const { user } = await requireUser(request, env);
    let isPro = !!user.is_pro;
    if (isPro && user.expire && new Date(user.expire).getTime() < Date.now()) isPro = false;
    return json({ is_pro: isPro, expire: user.expire || null });
  }

  return json({ error: 'not found' }, 404);
}

export default {
  async fetch(request, env) {
    try { return await handle(request, env); }
    catch (e) { return json({ error: e.message || '服务器错误' }, e.status || 500); }
  }
};
