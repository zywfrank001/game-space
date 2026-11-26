(function () {
  'use strict';

  const LS = window.localStorage;
  const K = { recent:'gs_recent', token:'gs_token', user:'gs_user', events:'gs_events' };

  function getJSON(key, fallback) {
    try { const raw = LS.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (e) { return fallback; }
  }
  function setJSON(key, value) {
    try { LS.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  const recent = {
    list() { return getJSON(K.recent, []); },
    add(id, name) {
      const now = Date.now();
      const next = [{ id, name, at: now }].concat(
        recent.list().filter(x => x.id !== id)
      ).slice(0, 8);
      setJSON(K.recent, next);
      return next;
    },
    clear() { LS.removeItem(K.recent); }
  };

  const auth = {
    token() { return LS.getItem(K.token) || ''; },
    user() { return getJSON(K.user, null); },
    isLogged() { return !!LS.getItem(K.token); },
    set(token, user) {
      if (token) LS.setItem(K.token, token); else LS.removeItem(K.token);
      if (user) setJSON(K.user, user); else LS.removeItem(K.user);
    },
    logout() { auth.set('', null); }
  };

  async function request(path, options) {
    const opts = options || {};
    const headers = Object.assign({ 'Content-Type':'application/json' }, opts.headers || {});
    const token = auth.token();
    if (token) headers.Authorization = 'Bearer ' + token;

    const res = await fetch((window.GS_API_BASE || '') + path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
    });

    const contentType = res.headers.get('Content-Type') || '';
    if (contentType.indexOf('application/json') === -1) {
      throw new Error('后端 API 尚未配置');
    }
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(data.error || ('请求失败 ' + res.status));
    return data;
  }

  const api = {
    register: (email, password) => request('/api/register', { method:'POST', body:{ email, password } }),
    login:    (email, password) => request('/api/login',    { method:'POST', body:{ email, password } }),
    save:     (game, data)      => request('/api/save',     { method:'POST', body:{ game, data } }),
    load:     game              => request('/api/save/' + encodeURIComponent(game)),
    exportCode: ()              => request('/api/export'),
    importCode: code            => request('/api/import',   { method:'POST', body:{ code } }),
    score:    (game, score)     => request('/api/score',    { method:'POST', body:{ game, score } }),
    sub:      ()                => request('/api/sub')
  };

  function track(event, payload) {
    const row = { event, payload: payload || {}, at: Date.now() };
    const list = getJSON(K.events, []);
    list.push(row);
    setJSON(K.events, list.slice(-200));
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([JSON.stringify(row)], { type:'application/json' }));
      }
    } catch (e) {}
  }

  let toastEl;
  function toast(message, ms) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'gs-toast';
      document.body.appendChild(toastEl);
      const style = document.createElement('style');
      style.textContent = '.gs-toast{position:fixed;left:50%;bottom:28px;z-index:9999;transform:translate(-50%,20px);opacity:0;pointer-events:none;max-width:min(90vw,480px);padding:13px 22px;border-radius:12px;background:#ffcf4a;color:#05060b;font:600 14px/1.4 system-ui,"Microsoft YaHei",sans-serif;box-shadow:0 12px 40px -10px #ffcf4a;transition:transform .25s,opacity .25s}.gs-toast.show{transform:translate(-50%,0);opacity:1}';
      document.head.appendChild(style);
    }
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), ms || 2400);
  }

  const fmtDate = ts => {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '' : d.toLocaleString('zh-CN', { hour12:false });
  };

  window.GS_CORE = { K, getJSON, setJSON, recent, auth, api, request, track, record: function(){}, toast, fmtDate };
})();
