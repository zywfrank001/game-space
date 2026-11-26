(function () {
  'use strict';
  const C = window.GS_CORE;
  if (!C) return;

  const K_STATS = 'gs_stats';
  const K_ACH = 'gs_ach';
  const stats = C.getJSON(K_STATS, {
    plays:0, games:[], finishes:0, daily:0, days:[], streak:0,
    saves:0, cloud:0, night:0, pro:false
  });
  const unlocked = C.getJSON(K_ACH, {});

  const isPro = () => !!(C.auth.user() && C.auth.user().is_pro);
  const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  };
  const dayGap = (a, b) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);

  function updateStats(event, payload) {
    const t = today();
    if (stats.days.indexOf(t) === -1) stats.days.push(t);

    let run = 1, best = 1;
    const days = stats.days.slice().sort();
    for (let i = 1; i < days.length; i++) {
      if (dayGap(days[i-1], days[i]) === 1) { run++; if (run > best) best = run; }
      else run = 1;
    }
    if (best > (stats.streak || 0)) stats.streak = best;

    if (event === 'play' || event === 'home_play') {
      stats.plays++;
      const g = String(payload.game || '').split('-')[0];
      if (g && stats.games.indexOf(g) === -1) stats.games.push(g);
      const h = new Date().getHours();
      if (h >= 23 || h < 5) stats.night++;
    }
    if (event === 'finish') stats.finishes++;
    if (event === 'daily_play') stats.daily++;
    if (event === 'save_local') stats.saves++;
    if (event === 'cloud_save') stats.cloud++;
    if (event === 'member' || isPro()) stats.pro = true;

    C.setJSON(K_STATS, stats);
  }

  const LIST = [
    { id:'first',    icon:'◉', name:'初次开机',   desc:'启动第一款游戏',           pro:false, test:s=>s.plays>=1,    progress:s=>[Math.min(s.plays,1),1] },
    { id:'exp10',    icon:'▤', name:'十款尝鲜',   desc:'玩过 10 款不同游戏',        pro:false, test:s=>s.games.length>=10, progress:s=>[Math.min(s.games.length,10),10] },
    { id:'exp30',    icon:'▦', name:'街机常客',   desc:'玩过 30 款不同游戏',        pro:false, test:s=>s.games.length>=30, progress:s=>[Math.min(s.games.length,30),30] },
    { id:'exp60',    icon:'▩', name:'全图鉴',     desc:'玩过全部 60 款游戏',        pro:false, test:s=>s.games.length>=60, progress:s=>[Math.min(s.games.length,60),60] },
    { id:'fin10',    icon:'◆', name:'十局结算',   desc:'完成 10 次结算',            pro:false, test:s=>s.finishes>=10, progress:s=>[Math.min(s.finishes,10),10] },
    { id:'save1',    icon:'▣', name:'存档新手',   desc:'保存过一次进度',            pro:false, test:s=>s.saves>=1,    progress:s=>[Math.min(s.saves,1),1] },
    { id:'save10',   icon:'▥', name:'进度收藏家', desc:'累计保存 10 次',            pro:false, test:s=>s.saves>=10,   progress:s=>[Math.min(s.saves,10),10] },
    { id:'daily1',   icon:'☼', name:'每日打卡',   desc:'玩过一次每日挑战',          pro:false, test:s=>s.daily>=1,    progress:s=>[Math.min(s.daily,1),1] },
    { id:'daily7',   icon:'✦', name:'七日连击',   desc:'连续 7 天来街机厅',         pro:false, test:s=>s.streak>=7,   progress:s=>[Math.min(s.streak,7),7] },
    { id:'night',    icon:'☾', name:'深夜街机',   desc:'23:00 之后玩过一局',        pro:false, test:s=>s.night>=1,    progress:s=>[Math.min(s.night,1),1] },
    { id:'cloud',    icon:'☁', name:'云端旅人',   desc:'把存档同步到云端',          pro:true,  test:s=>s.cloud>=1,    progress:s=>[Math.min(s.cloud,1),1] },
    { id:'member',   icon:'★', name:'通行证持有者', desc:'成为会员',                pro:true,  test:s=>s.pro,         progress:s=>[s.pro?1:0,1] }
  ];

  function check(silent) {
    const fresh = [];
    LIST.forEach(a => {
      if (unlocked[a.id]) return;
      if (a.pro && !isPro()) return;
      if (a.test(stats)) { unlocked[a.id] = Date.now(); fresh.push(a); }
    });
    if (fresh.length) {
      C.setJSON(K_ACH, unlocked);
      if (!silent) fresh.forEach(a => C.toast('◆ 解锁成就：' + a.name));
    }
    return fresh;
  }

  function record(event, payload) { updateStats(event, payload || {}); check(false); }
  C.record = record;

  const origTrack = C.track;
  C.track = function (event, payload) {
    try { origTrack(event, payload); } catch (e) {}
    record(event, payload);
  };

  function summary() {
    const total = LIST.length;
    const got = LIST.filter(a => unlocked[a.id]).length;
    return { got, total, pct: Math.round(got / total * 100) };
  }

  function cardHTML() {
    return LIST.map(a => {
      const got = !!unlocked[a.id];
      const lockedPro = a.pro && !isPro();
      const pair = a.progress(stats);
      const pct = Math.min(100, Math.round(pair[0] / pair[1] * 100));
      return '<div class="ach' + (got ? ' got' : '') + (a.pro ? ' pro' : '') + '">' +
        '<span class="ach-icon">' + (got ? a.icon : (lockedPro ? '▢' : '·')) + '</span>' +
        '<span class="ach-body"><b>' + a.name + (a.pro ? '<small>PRO</small>' : '') + '</b>' +
        '<em>' + a.desc + '</em><span class="ach-bar"><i style="width:' + pct + '%"></i></span></span>' +
        '<span class="ach-state">' + (got ? '已解锁' : (lockedPro ? '会员专属' : pair[0] + '/' + pair[1])) + '</span></div>';
    }).join('');
  }

  window.GS_ACH = { LIST, stats, unlocked, summary, cardHTML, check, record };
  check(true);
})();
