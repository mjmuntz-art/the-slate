window.__MAIN__ = 1;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f1 = n => n == null ? '—' : (Math.round(n * 10) / 10).toFixed(1);
const sgn = (n, d) => n == null ? '—' : (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(d == null ? 1 : d);
const pct = n => n == null ? '—' : Math.round(n * 100) + '%';
const odds = n => n == null ? '' : (n > 0 ? '+' : '−') + Math.abs(Math.round(n));
const line = n => n == null ? '' : n === 0 ? 'PK' : (n > 0 ? '+' : '−') + Math.abs(n).toFixed(1).replace(/\.0$/, '');
const num = v => v == null || v === '' ? null : Number(v);
let B = null, teamFilter = 'ALL', sortKey = 'pts', showAll = false, propMkt = 'ALL', propAll = false, plView = 'tonight';
const PROP_ROWS = 40;
const BY_ID = {};

function tipCT(iso) {
  try { return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso)) + ' CT'; }
  catch (e) { return ''; }
}
const team = code => (B.teams || {})[code] || {};
const tcolor = code => team(code).color || '#555';
function logo(code, cls) {
  const t = team(code);
  const fb = `<span class="logo-fallback ${cls || ''}" style="background:${esc(tcolor(code))}">${esc(code)}</span>`;
  if (!t.logo) return fb;
  return `<img class="logo ${cls || ''}" src="${esc(t.logo)}" alt="${esc(t.name || code)}" onerror="this.outerHTML=this.dataset.fb" data-fb='${fb.replace(/'/g, '&#39;')}'>`;
}
function initials(name) { return String(name).split(' ').filter(w => /^[A-Z]/.test(w)).map(w => w[0]).slice(0, 2).join(''); }
const headshot = id => {
  const clean = String(id == null ? '' : id).replace(/^ESPN:/, '').trim();
  return /^\d+$/.test(clean) ? `https://a.espncdn.com/i/headshots/nba/players/full/${clean}.png` : '';
};
// full-colour logo for a team-coloured background: ESPN's dark-background version first, a thin light halo so it never sinks into the colour
function bgLogo(code) {
  const t = team(code);
  if (!t.logo) return `<b class="bgl-fb">${esc(code)}</b>`;
  const dark = /\/500\//.test(t.logo) ? t.logo.replace('/500/', '/500-dark/') : '';
  return `<img class="bgl" src="${esc(dark || t.logo)}" alt="${esc(t.name || code)}" onerror="${dark ? `if(this.src.indexOf('500-dark')>0){this.src='${esc(t.logo)}'}else{this.remove()}` : 'this.remove()'}">`;
}
const teamMark = code => `<span class="tmk">${logo(code)}<small>${esc(code)}</small></span>`;
const isAwayTeam = code => (B.games || []).some(g => g.away === code);
const oppTxt = (code, opp) => opp ? `${isAwayTeam(code) ? 'at' : 'vs'} ${esc(opp)}` : '';
function hsDot(p, cls) {   // headshot in a team-tinted circle, initials until it loads (or if ESPN has none)
  const url = headshot(p.id);
  return `<span class="pr-hs${url ? '' : ' noshot'}${cls ? ' ' + cls : ''}" style="--tc:${esc(tcolor(p.team))}">${url ? `<img src="${esc(url)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noshot');this.remove()">` : ''}<span class="ini">${esc(initials(p.name || p.player || ''))}</span></span>`;
}
function face(p, size) {   // small team-logo circle; headshots live in the hero blocks
  const t = team(p.team);
  const img = t.logo ? `<img class="tl" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('nologo');this.remove()">` : '';
  return `<span class="face ${size || ''} ${t.logo ? '' : 'nologo'}" style="--tc:${esc(tcolor(p.team))}"><span class="ini">${esc(p.team)}</span>${img}</span>`;
}
// dark, team-tinted backdrop with a big faded logo behind the headshot (same look as the NFL cards)
function shade(hex, k) {
  const m = String(hex || '').match(/^#?([0-9a-f]{6})$/i);
  if (!m) return '#1B1D21';
  const n = parseInt(m[1], 16), f = c => Math.round(c * (1 - k)).toString(16).padStart(2, '0');
  return '#' + f(n >> 16 & 255) + f(n >> 8 & 255) + f(n & 255);
}
const heroBg = code => `linear-gradient(120deg, ${shade(tcolor(code), 0.35)} 0%, ${shade(tcolor(code), 0.72)} 48%, #101317 100%)`;
function heroArt(p) {
  const t = team(p.team), url = headshot(p.id);
  const wm = t.logo ? `<img class="wm" src="${esc(t.logo)}" alt="" loading="lazy" onerror="this.remove()">` : '';
  const shot = url ? `<img class="hs" src="${esc(url)}" alt="${esc(p.name)}" loading="lazy" onerror="this.parentNode.classList.add('noshot');this.remove()">` : '';
  return `${wm}<span class="hsw${url ? '' : ' noshot'}">${shot}<span class="ini">${esc(initials(p.name))}</span></span>`;
}
const plBtn = (p, label, market) => `<button class="pl" data-pid="${esc(p.id)}"${market ? ` data-mkt="${esc(market)}"` : ''}>${esc(label || p.name)}</button>`;
const showStatus = s => /Out|Doubtful|Questionable|Probable/.test(s || '');   // day-to-day is treated as playing, so it stays quiet
const stCls = s => /Out/.test(s) ? 'out' : /Questionable|Doubtful/.test(s) ? 'q' : 'd';
// "8:01 AM" today, "Sun 8:01 AM" on another day (so stale lines are obvious)
const ctStamp = iso => {
  try {
    const d = new Date(iso), fmt = (x, o) => new Intl.DateTimeFormat('en-US', Object.assign({ timeZone: 'America/Chicago' }, o)).format(x);
    const sameDay = fmt(d, { year: 'numeric', month: 'numeric', day: 'numeric' }) === fmt(new Date(), { year: 'numeric', month: 'numeric', day: 'numeric' });
    return (sameDay ? '' : fmt(d, { weekday: 'short' }) + ' ') + fmt(d, { hour: 'numeric', minute: '2-digit' }) + ' CT';
  } catch (e) { return ''; }
};
const ctTime = iso => { try { return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }).format(new Date(iso)); } catch (e) { return ''; } };

/* ---------- prices (inverse normal, Acklam) ---------- */
function zInv(p) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
const ceilHalf = x => Math.ceil(x * 2 - 1e-9) / 2, floorHalf = x => Math.floor(x * 2 + 1e-9) / 2;
const P = () => B.params || { flag: 0.03, breakeven: 0.5238, marginSD: 14.5, totalSD: 19, ttSD: 12.2, h1MarginSD: 9, h1TotalSD: 12.5 };
const TR = () => B.tracking || { lines: true, props: true };
// team spread: needs line ≥ s·z(p) − margin
function spreadPrices(margin, sd) { const s = sd || P().marginSD; return { bet: ceilHalf(s * zInv(P().breakeven + P().flag) - margin), lean: ceilHalf(s * zInv(P().breakeven) - margin) }; }
function totalPrices(total, side, sd) {
  const s = sd || P().totalSD, zb = zInv(P().breakeven + P().flag), zl = zInv(P().breakeven);
  return side === 'Over' ? { bet: floorHalf(total - s * zb), lean: floorHalf(total - s * zl) } : { bet: ceilHalf(total + s * zb), lean: ceilHalf(total + s * zl) };
}
const toAmerican = q => q <= 0 || q >= 1 ? null : q >= 0.5 ? -100 * q / (1 - q) : 100 * (1 - q) / q;
function mlPrices(win, flag) { return { bet: toAmerican(win - (flag == null ? P().flag : flag)), lean: toAmerican(win) }; }

/* ---------- reading a game ---------- */
function spreadCall(g) {
  const out = {};
  [['algo', g.algo], ['player', g.player]].forEach(([k, m]) => {
    if (!m || !m.home || !m.away || m.home.margin == null || m.home.spread == null) return;
    const diff = m.home.margin - (-m.home.spread);            // > 0 → home side has the value
    const side = diff >= 0 ? m.home : m.away;
    out[k] = { diff, team: side.team, line: side.spread, cover: side.cover, margin: side.margin,
      flagged: side.signals.some(s => /^ATS /.test(s)), modelLine: -side.margin };
  });
  return out;
}
function totalCall(g) {
  const out = {};
  [['algo', g.algo], ['player', g.player]].forEach(([k, m]) => {
    if (!m || !m.away || m.away.total == null || m.away.ou == null) return;
    const diff = m.away.total - m.away.ou;
    out[k] = { diff, side: diff >= 0 ? 'Over' : 'Under', line: m.away.ou, prob: diff >= 0 ? m.away.over : 1 - m.away.over,
      flagged: m.away.signals.some(s => /^(OVER|UNDER) /.test(s)), total: m.away.total };
  });
  return out;
}
function mlCall(g) {
  const out = {};
  [['algo', g.algo], ['player', g.player]].forEach(([k, m]) => {
    if (!m || !m.away || !m.home) return;
    const side = [m.away, m.home].find(x => x.signals.some(s => /^ML /.test(s)));
    if (side) out[k] = { team: side.team, ml: side.ml, win: side.win, mkt: side.mkt, flagged: true };
  });
  return out;
}
// team total for one side ('away' | 'home')
function ttCall(g, where) {
  const out = {};
  [['algo', g.algo], ['player', g.player]].forEach(([k, m]) => {
    const t = m && m[where];
    if (!t || t.tt == null || t.pts == null) return;
    const diff = t.pts - t.tt, side = diff >= 0 ? 'Over' : 'Under';
    out[k] = { diff, side, team: t.team, line: t.tt, total: t.pts, prob: t.ttOver == null ? null : (diff >= 0 ? t.ttOver : 1 - t.ttOver),
      flagged: t.signals.some(s => /^TT [OU]/.test(s)) };
  });
  return out;
}
// first-half spread (h1ats = team's projected 1H margin + its 1H spread; > 0 means that side covers)
function h1SpreadCall(g) {
  const out = {};
  [['algo', g.algo], ['player', g.player]].forEach(([k, m]) => {
    if (!m || !m.home || !m.away || m.home.h1sp == null || m.home.h1ats == null) return;
    const side = m.home.h1ats >= 0 ? m.home : m.away;
    const margin = side.h1ats - side.h1sp;
    out[k] = { diff: m.home.h1ats, team: side.team, line: side.h1sp, cover: side.h1cov, margin, modelLine: -margin,
      flagged: side.signals.some(s => /^1H ATS /.test(s)) };
  });
  return out;
}
function h1TotalCall(g) {
  const out = {};
  [['algo', g.algo], ['player', g.player]].forEach(([k, m]) => {
    const a = m && m.away;
    if (!a || a.h1ou == null || a.h1ouDiff == null) return;
    const diff = a.h1ouDiff;
    out[k] = { diff, side: diff >= 0 ? 'Over' : 'Under', line: a.h1ou, total: a.h1ou + diff,
      prob: a.h1over == null ? null : (diff >= 0 ? a.h1over : 1 - a.h1over), flagged: a.signals.some(s => /^1H (OVER|UNDER) /.test(s)) };
  });
  return out;
}
function verdict(a, p, label) {
  if (!a || !p) return { cls: 'quiet', text: 'No line yet' };
  const same = Math.sign(a.diff) === Math.sign(p.diff) || a.diff === 0 || p.diff === 0;
  if (same && a.flagged && p.flagged) return { cls: 'both', text: 'Both models: ' + label(a), call: a };
  if (a.flagged || p.flagged) {
    const m = a.flagged ? ['NBA ALGO', a] : ['PLAYER ALGO', p];
    return same ? { cls: 'lean', text: m[0] + ' flags ' + label(m[1]), call: m[1] } : { cls: 'split', text: 'Split: only ' + m[0] + ' flags ' + label(m[1]) };
  }
  return { cls: 'quiet', text: same ? 'Close to the number' : 'Models split, no flag' };
}
// graded result for a logged bet (EDGE LOG)
function graded(gid, model, market, teamOrSide) {
  const L = (B.logged || {})[gid];
  if (!L) return null;
  return L.bets.find(b => b.model === model && b.market === market && b.flagged && (b.team === teamOrSide || b.side === teamOrSide)) || null;
}
const badge = b => b && (b.grade === 'W' || b.grade === 'L') ? `<span class="res ${b.grade}${b.soft ? ' soft' : ''}" title="${esc(b.title || b.result)}">${b.grade}</span>`
  : b && /PUSH/.test(b.result || '') ? `<span class="res P">P</span>` : '';
// a prop's projection if he plays (what the chance and edge use; a prop is voided if he sits). Older snapshots sent the expected value.
const projIf = p => p.play != null && p.play > 0 && p.play < 0.99 && p.projExp == null && p.proj != null ? p.proj / p.play : p.proj;
const playTag = p => p.play != null && p.play > 0 && p.play < 0.99 ? `<small class="ptp" title="Questionable: the projection assumes he plays">${pct(p.play)} to play</small>` : '';
// every graded prop, flagged or not: did the side the model took hit? (flagged ones are solid, the rest outlined)
const propRes = p => {
  const r = String(p.result || '').toUpperCase(), act = p.actual === '' || p.actual == null ? '' : ` (actual ${p.actual})`;
  if (r === 'PUSH') return { result: 'PUSH' };
  if (r !== 'OVER' && r !== 'UNDER') return null;
  return { grade: r === String(p.side).toUpperCase() ? 'W' : 'L', soft: !p.flagged, title: `Went ${r.toLowerCase()}${act}${p.flagged ? '' : ' · not a flagged bet'}` };
};

/* ---------- best spots ---------- */
function gameCalls(g) {
  // rank = 1 if both models agree, plus the edge: the (lower) model chance minus what the price needs to break even
  // (−110 lines: 52.4%; moneylines: the market's no-vig chance). Same edge the EDGE LOG flags on.
  const BE = P().breakeven || 0.5238;
  const out = [];
  const sc = spreadCall(g), tc = totalCall(g), mc = mlCall(g);
  const sv = verdict(sc.algo, sc.player, c => c.team + ' ' + line(c.line));
  const tv = verdict(tc.algo, tc.player, c => c.side + ' ' + c.line);
  const who = (both, c, a) => both ? 'both' : (c === a ? 'NBA ALGO' : 'PLAYER ALGO');
  if (sv.call) {
    const both = sv.cls === 'both', c = sv.call;
    const margins = [sc.algo, sc.player].filter(x => x && x.team === c.team && (both || x === c)).map(x => x.margin);
    const pr = spreadPrices(Math.min(...margins));
    out.push({ g, both, model: who(both, c, sc.algo), kind: 'spread', team: c.team, opp: c.team === g.away ? g.home : g.away, bet: c.team + ' ' + line(c.line),
      probs: [sc.algo && sc.algo.team === c.team ? ['a', sc.algo.cover] : null, sc.player && sc.player.team === c.team ? ['p', sc.player.cover] : null],
      prices: [line(pr.bet), line(pr.lean)], score: (both ? 1 : 0) + (Math.min(...[sc.algo, sc.player].filter(x => x && x.team === c.team).map(x => x.cover)) - BE),
      result: graded(g.id, both || c === sc.algo ? 'algo' : 'player', 'SPREAD', c.team) });
  } else if (sv.cls === 'split') out.push({ g, kind: 'spread', pass: 'models split' });
  const ma = mc.algo, mp = mc.player;
  if (ma || mp) {
    const both = !!(ma && mp && ma.team === mp.team), c = ma || mp;
    const w = both ? Math.min(ma.win, mp.win) : c.win, pr = mlPrices(w);
    out.push({ g, both, model: who(both, c, ma), kind: 'ml', team: c.team, opp: c.team === g.away ? g.home : g.away, bet: c.team + ' ' + odds(c.ml),
      probs: [ma && ma.team === c.team ? ['a', ma.win] : null, mp && mp.team === c.team ? ['p', mp.win] : null],
      prices: [odds(pr.bet), odds(pr.lean)], score: (both ? 1 : 0) + (w - c.mkt), sub: pct(c.mkt),
      result: graded(g.id, both || c === ma ? 'algo' : 'player', 'ML', c.team) });
  }
  if (tv.call) {
    const both = tv.cls === 'both', c = tv.call;
    const totals = [tc.algo, tc.player].filter(x => x && x.side === c.side && (both || x === c)).map(x => x.total);
    const pr = totalPrices(c.side === 'Over' ? Math.min(...totals) : Math.max(...totals), c.side);
    out.push({ g, both, model: who(both, c, tc.algo), kind: 'total', team: null, bet: c.side + ' ' + c.line,
      probs: [tc.algo && tc.algo.side === c.side ? ['a', tc.algo.prob] : null, tc.player && tc.player.side === c.side ? ['p', tc.player.prob] : null],
      prices: [String(pr.bet), String(pr.lean)], score: (both ? 1 : 0) + (Math.min(...[tc.algo, tc.player].filter(x => x && x.side === c.side).map(x => x.prob)) - BE),
      result: graded(g.id, both || c === tc.algo ? 'algo' : 'player', 'GAME TOTAL', c.side.toUpperCase()) });
  } else if (tv.cls === 'split') out.push({ g, kind: 'total', pass: 'models split' });
  // team totals (each side)
  ['away', 'home'].forEach(where => {
    const cc = ttCall(g, where), v = verdict(cc.algo, cc.player, c => c.side + ' ' + c.line);
    const code = where === 'away' ? g.away : g.home;
    if (v.call) {
      const both = v.cls === 'both', c = v.call;
      const pts = [cc.algo, cc.player].filter(x => x && x.side === c.side && (both || x === c)).map(x => x.total);
      const pr = totalPrices(c.side === 'Over' ? Math.min(...pts) : Math.max(...pts), c.side, P().ttSD);
      out.push({ g, both, model: who(both, c, cc.algo), kind: 'tt', where, team: code, opp: code === g.away ? g.home : g.away, bet: code + ' ' + c.side + ' ' + c.line,
        probs: [cc.algo && cc.algo.side === c.side ? ['a', cc.algo.prob] : null, cc.player && cc.player.side === c.side ? ['p', cc.player.prob] : null],
        prices: [String(pr.bet), String(pr.lean)], score: (both ? 1 : 0) + (Math.min(...[cc.algo, cc.player].filter(x => x && x.side === c.side).map(x => x.prob || 0)) - BE),
        result: graded(g.id, both || c === cc.algo ? 'algo' : 'player', 'TEAM TOTAL', code) });
    } else if (v.cls === 'split') out.push({ g, kind: 'tt', where, pass: 'models split' });
  });
  // first half
  const hs = h1SpreadCall(g), hv = verdict(hs.algo, hs.player, c => c.team + ' ' + line(c.line));
  if (hv.call) {
    const both = hv.cls === 'both', c = hv.call;
    const margins = [hs.algo, hs.player].filter(x => x && x.team === c.team && (both || x === c)).map(x => x.margin);
    const pr = spreadPrices(Math.min(...margins), P().h1MarginSD);
    out.push({ g, both, model: who(both, c, hs.algo), kind: 'h1spread', team: c.team, opp: c.team === g.away ? g.home : g.away, bet: c.team + ' ' + line(c.line),
      probs: [hs.algo && hs.algo.team === c.team ? ['a', hs.algo.cover] : null, hs.player && hs.player.team === c.team ? ['p', hs.player.cover] : null],
      prices: [line(pr.bet), line(pr.lean)], score: (both ? 1 : 0) + (Math.min(...[hs.algo, hs.player].filter(x => x && x.team === c.team).map(x => x.cover || 0)) - BE),
      result: graded(g.id, both || c === hs.algo ? 'algo' : 'player', '1H SPREAD', c.team) });
  } else if (hv.cls === 'split') out.push({ g, kind: 'h1spread', pass: 'models split' });
  const ht = h1TotalCall(g), htv = verdict(ht.algo, ht.player, c => c.side + ' ' + c.line);
  if (htv.call) {
    const both = htv.cls === 'both', c = htv.call;
    const totals = [ht.algo, ht.player].filter(x => x && x.side === c.side && (both || x === c)).map(x => x.total);
    const pr = totalPrices(c.side === 'Over' ? Math.min(...totals) : Math.max(...totals), c.side, P().h1TotalSD);
    out.push({ g, both, model: who(both, c, ht.algo), kind: 'h1total', team: null, bet: c.side + ' ' + c.line,
      probs: [ht.algo && ht.algo.side === c.side ? ['a', ht.algo.prob] : null, ht.player && ht.player.side === c.side ? ['p', ht.player.prob] : null],
      prices: [String(pr.bet), String(pr.lean)], score: (both ? 1 : 0) + (Math.min(...[ht.algo, ht.player].filter(x => x && x.side === c.side).map(x => x.prob || 0)) - BE),
      result: graded(g.id, both || c === ht.algo ? 'algo' : 'player', '1H TOTAL', c.side.toUpperCase()) });
  } else if (htv.cls === 'split') out.push({ g, kind: 'h1total', pass: 'models split' });
  return out;
}
function spots() {
  return (B.games || []).flatMap(gameCalls).filter(x => !x.pass).sort((x, y) => y.score - x.score);
}
function spotCard(s, i) {
  const g = s.g, logged = (B.logged || {})[g.id], fin = (B.finals || {})[g.id];
  const band = s.team ? `background:${tcolor(s.team)}` : `background:linear-gradient(90deg, ${tcolor(g.away)} 50%, ${tcolor(g.home)} 50%)`;
  const head = s.team
    ? `<div class="who">${logo(s.team)}<div><div class="bet">${esc(s.bet)}</div><div class="ctx">${s.team === g.away ? 'at' : 'vs'} ${esc(s.opp)} · ${tipCT(g.tip)}</div></div></div>`
    : `<div class="who">${logo(g.away)}${logo(g.home)}<div><div class="bet">${esc(s.bet)}</div><div class="ctx">${esc(g.away)} at ${esc(g.home)} · ${tipCT(g.tip)}</div></div></div>`;
  const probs = s.probs.filter(Boolean).map(([k, v]) => `<span><i class="dot ${k}"></i><b>${pct(v)}</b>${k === 'a' ? 'NBA ALGO' : 'PLAYER ALGO'}</span>`).join('');
  const kindName = KIND_NAME[s.kind];
  const isTotal = s.kind === 'total' || s.kind === 'tt' || s.kind === 'h1total';
  let state = 'Logs about an hour before tip';
  if (logged) state = `Logged ${ctTime(logged.at)}`;
  if (fin && g.away in fin && g.home in fin) state = `Final: ${g.away} ${fin[g.away]}, ${g.home} ${fin[g.home]}`;
  return `<article class="spot" data-go="g/${esc(g.id)}"><div class="band" style="${band}"></div><div class="body">
    <span class="tag ${s.both ? 'both' : ''}">${i != null ? `<b class="rk">#${i + 1}</b>` : ''}${kindName} · ${s.both ? 'both models' : 'one model'} · edge ${sgn((s.score - (s.both ? 1 : 0)) * 100, 1)}%</span>
    ${head}
    <div class="probs"><span class="lbl">${s.kind === 'ml' ? 'Chance to win' : isTotal ? 'Chance it goes ' + (/Over/.test(s.bet) ? 'over' : 'under') : 'Chance to cover'}${s.sub ? ' (Vegas ' + esc(s.sub) + ')' : ''}</span>${probs}</div>
    ${priceBoxes(s.prices, TR().lines)}
  </div><div class="foot"><span>${esc(state)}</span>${badge(s.result)}</div></article>`;
}
const KIND_NAME = { spread: 'Spread', ml: 'Moneyline', total: 'Total', tt: 'Team total', h1spread: '1st half spread', h1total: '1st half total' };
// "Bet to / Lean to" boxes; greyed with a tracking label while the model hasn't earned real bets
const priceBoxes = (pr, tracking) => tracking
  ? `<div class="prices ghost"><div class="price"><small>Would bet to</small><b>${esc(pr[0])}</b></div><div class="price"><small>Lean to</small><b>${esc(pr[1])}</b></div><span class="trk">Tracking only</span></div>`
  : `<div class="prices"><div class="price go"><small>Bet to</small><b>${esc(pr[0])}</b></div><div class="price"><small>Lean to</small><b>${esc(pr[1])}</b></div></div>`;
let spotsAll = false;
function leanRow(sp, i) {
  const g = sp.g, logged = (B.logged || {})[g.id], fin = (B.finals || {})[g.id];
  const { pr, edge, be } = callNums(sp);
  const logos = sp.team ? logo(sp.team) : logo(g.away) + logo(g.home);
  const ctx = sp.team ? `${sp.team === g.away ? 'at' : 'vs'} ${esc(sp.opp)}` : `${esc(g.away)} at ${esc(g.home)}`;
  let state = '';
  if (logged) state = ` · logged ${ctTime(logged.at)}`;
  if (fin && g.away in fin && g.home in fin) state = ` · final ${g.away} ${fin[g.away]}, ${g.home} ${fin[g.home]}`;
  const pills = pr.map(([k, v]) => `<span class="lp ${k}">${k === 'a' ? 'NBA' : 'PLAYER'} ${pct(v)}</span>`).join('') + (be != null ? `<span class="lp n">break-even ${pct(be)}</span>` : '');
  const trk = TR().lines;
  return `<article class="lean${i < 3 ? ' top' : ''}" data-go="g/${esc(g.id)}" style="--tc:${esc(tcolor(sp.team || g.home))}">
    <i class="ln-e"${sp.team ? '' : ` style="background:linear-gradient(180deg, ${esc(tcolor(g.away))} 50%, ${esc(tcolor(g.home))} 50%)"`}></i>
    <span class="ln-rk">${i + 1}</span>
    <span class="ln-lg">${logos}</span>
    <span class="ln-pk"><small>${KIND_NAME[sp.kind]} · ${sp.both ? 'both models' : sp.model + ' only'}</small><b>${esc(sp.bet)}</b><span>${ctx} · ${esc(tipCT(g.tip))}${esc(state)}</span></span>
    ${edgeDial(edge, 'How far the lower model clears break-even')}
    <span class="ln-pills">${pills}</span>
    <span class="ln-pr"><small>${trk ? 'would bet to' : 'bet to'}</small><b>${esc(sp.prices[0])}</b><small>lean to ${esc(sp.prices[1])}</small></span>
    <span class="ln-res">${badge(sp.result)}</span>
  </article>`;
}
function renderSpots() {
  const all = spots(), both = all.filter(s => s.both);
  const pool = both.length ? both.concat(all.filter(s => !s.both).slice(0, Math.max(0, 3 - both.length))) : all.slice(0, 3);
  const CAP = 10, show = spotsAll ? pool : pool.slice(0, CAP);
  const trk = TR().lines;
  const body = show.length ? `<div class="leans">${show.map(leanRow).join('')}</div>${pool.length > CAP ? `<button type="button" class="show-all" data-spotsall>${spotsAll ? 'Show the top ' + CAP : 'Show all ' + pool.length + ' picks'}</button>` : ''}` :
    `<div class="empty"><b>Nothing flagged on this slate.</b> Neither model is far enough from Vegas on any game to clear the ${pct(P().flag)} edge flag. That's a normal night; the full board is below.</div>`;
  return `<section id="spots"><h2>${trk ? 'Model leans' : 'Best spots'}</h2>
    <p class="sub">${trk ? '<b>Tracking only.</b> Logged and graded like bets so the models can earn trust; not bets yet. ' : ''}${both.length ? `${both.length === 1 ? 'One pick' : both.length + ' picks'} where both models flag the same side${pool.length > both.length ? ', then the strongest single-model flags' : ''}, best first.` : 'Nothing has both models behind it tonight, so these are the strongest single-model flags, best first.'}
</p>
    ${show.length ? `<div class="lkey"><div><b><span class="lp a">NBA 66%</span><span class="lp p">PLAYER 73%</span></b>How often each model thinks the pick hits.</div>
      <div><b><span class="lp n">break-even 52%</span></b>How often it has to hit to make money at this price: 52% at −110, less for an underdog.</div>
      <div><b>${edgeDial(0.1).replace('class="ag"', 'class="ag mini"')}</b>The edge: how far the lower model clears break-even. Every dial uses the same 0–15% scale, so a fuller arch is a better pick.</div></div>` : ''}${body}</section>`;
}

/* ---------- diverging strip (drawn at the real width so text stays readable on a phone) ---------- */
const STRIPS = {};
let stripN = 0;
function strip(rows, leftLabel, rightLabel, vegasLabel) {
  const id = 's' + (stripN++);
  STRIPS[id] = { rows, leftLabel, rightLabel, vegasLabel };
  return `<div class="strip" data-strip="${id}"></div>`;
}
function drawStrip(el) {
  const { rows, leftLabel, rightLabel, vegasLabel } = STRIPS[el.dataset.strip];
  const W = Math.max(280, el.clientWidth || 600), cx = W / 2, laneH = 24, top = 24;
  const room = W < 420 ? 74 : 96;
  const span = Math.max(3, ...rows.map(r => Math.abs(r.diff || 0)));
  const x = d => cx + (d / span) * (W / 2 - room);
  const H = top + rows.length * laneH + 20;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(vegasLabel)}">`;
  for (let i = -Math.floor(span); i <= Math.floor(span); i++) {
    const xx = x(i);
    s += `<line x1="${xx}" x2="${xx}" y1="${top - 2}" y2="${top + rows.length * laneH}" stroke="${i === 0 ? '#12161C' : '#E6EAEF'}" stroke-width="${i === 0 ? 2 : 1}"/>`;
  }
  s += `<text x="${cx}" y="13" text-anchor="middle" class="val">${esc(vegasLabel)}</text>`;
  rows.forEach((r, i) => {
    const y = top + i * laneH + 4, h = laneH - 10;
    const color = r.cls === 'a' ? '#2344A8' : '#D9601C';
    if (r.diff == null) { s += `<text x="${cx + 8}" y="${y + h - 2}">no line</text>`; return; }
    const x2 = x(r.diff), x0 = Math.min(cx, x2), w = Math.max(2, Math.abs(x2 - cx));
    s += `<rect x="${x0}" y="${y}" width="${w}" height="${h}" rx="2" fill="${color}"/>`;
    const right = r.diff >= 0, tx = right ? x2 + 6 : x2 - 6;
    s += `<text x="${tx}" y="${y + h - 2}" text-anchor="${right ? 'start' : 'end'}"><tspan class="val">${esc(r.label)}</tspan>${r.prob != null ? `<tspan dx="5">${pct(r.prob)}</tspan>` : ''}</text>`;
  });
  s += `<text x="0" y="${H - 4}" class="end">← ${esc(leftLabel)}</text><text x="${W}" y="${H - 4}" text-anchor="end" class="end">${esc(rightLabel)} →</text>`;
  el.innerHTML = s + '</svg>';
}
function drawStrips() { document.querySelectorAll('.strip[data-strip]').forEach(drawStrip); }
let rsz; window.addEventListener('resize', () => { clearTimeout(rsz); rsz = setTimeout(drawStrips, 120); });

/* ---------- record ---------- */
function trackingNote() {
  const t = TR();
  if (!t.lines && !t.props) return '';
  const st = x => x && x.status ? esc(x.status.replace(/^TRACKING · /, '')) : 'waiting for games';
  const parts = [];
  if (t.lines) parts.push(`game lines ${st(t.algo)}`);
  if (t.props) parts.push(`props ${st(t.propsCheck)}`);
  return `<div class="trust"><b>Tracking only</b><span>Nothing here is a bet yet. Every pick is logged before tip and graded, and REPORT CARD 5d says when a model has earned real bets: ${parts.join(' · ')}.</span></div>`;
}
/* ---------- Record screen: season / last 7 days / last night, built from EDGE LOG + FORWARD VALIDATION ---------- */
let recPer = 'season', recFlagOnly = false, recGame = '';
// 10-27b: props by game, top-edge ranks, what's hitting
let recPricing = 'rp';   // 'rp' = every prop on today's pricing (EDGE LOG AM:AN), 'log' = edges as logged
let pgDate = '', pgGame = '', pgKind = 'p', pgMk = 'ALL', pgSort = 'edge', pgAll = false, whKind = 'p', whDim = 'ms';
const REC_MK = [['ML', 'Moneyline'], ['SPREAD', 'Spread'], ['GAME TOTAL', 'Game total'], ['TEAM TOTAL', 'Team total'], ['1H SPREAD', '1H spread'], ['1H TOTAL', '1H total']];
const REC_PM = [['PTS', 'Points'], ['REB', 'Rebounds'], ['AST', 'Assists'], ['3PM', 'Threes'], ['PRA', 'PRA']];
const REC_EB = [['u3', 'under 3%'], ['b3', '3–5%'], ['b5', '5–8%'], ['b8', '8–12%'], ['b12', '12%+'], ['n0', 'negative'], ['r0', '0–1%'], ['r1', '1–2%'], ['r2', '2–3%'], ['r3', '3%+'], ['chk', 'check-marked']];
const REC_CB = ['c0', 'c50', 'c55', 'c60', 'c65', 'c70', 'c80'];
const SMALL = 10;   // fewer than this: drawn faded, read with care
function recBar(label, frac, mark, right, tone, n) {
  const w = frac == null ? 0 : Math.max(0, Math.min(1, frac)) * 100;
  return `<div class="rb${n != null && n < SMALL ? ' thin' : ''}"><span class="rb-l">${label}</span>
    <span class="rb-t"><i class="${tone || ''}" style="width:${w}%"></i>${mark != null ? `<s style="left:${Math.max(0, Math.min(1, mark)) * 100}%"></s>` : ''}</span>
    <span class="rb-r">${right}</span></div>`;
}
const recU = u => `<span class="${u > 0.005 ? 'pos' : u < -0.005 ? 'neg' : ''}">${sgn(u, 2)}</span>`;
function unitsChart(series) {
  if (!series || series.length < 2) return `<p class="muted">The line starts once there are two graded nights.</p>`;
  const W = Math.round(Math.max(300, Math.min(1000, (window.innerWidth || 800) - 70))), H = W < 500 ? 170 : 160, L = 34, R = 10, T = 12, Bm = 22;   // drawn at the real width so the labels stay readable
  const three = series[0] && series[0][3] != null;
  const vals = series.flatMap(s => three ? [s[1], s[3], s[4]] : [s[1], s[2]]).concat([0]);
  let lo = Math.min(...vals), hi = Math.max(...vals); const pad = Math.max(1, (hi - lo) * 0.1); lo -= pad; hi += pad;
  const x = i => L + (W - L - R) * (series.length === 1 ? 0 : i / (series.length - 1)), y = v => T + (H - T - Bm) * (1 - (v - lo) / (hi - lo));
  const path = k => series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s[k]).toFixed(1)}`).join('');
  const d = s => s.slice(5).replace('-', '/');
  const last = series[series.length - 1];
  return `<svg class="uchart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Running units by night">
    <line x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}" class="z"/>
    <text x="${L - 6}" y="${y(0) + 4}" text-anchor="end">0</text><text x="${L - 6}" y="${y(hi) + 10}" text-anchor="end">${sgn(hi, 0)}</text><text x="${L - 6}" y="${y(lo)}" text-anchor="end">${sgn(lo, 0)}</text>
    ${three ? `<path d="${path(4)}" class="lt"/><path d="${path(3)}" class="lp"/>` : `<path d="${path(2)}" class="lp"/>`}<path d="${path(1)}" class="lg"/>
    <circle cx="${x(series.length - 1)}" cy="${y(last[1])}" r="4" class="dg"/><circle cx="${x(series.length - 1)}" cy="${y(last[three ? 3 : 2])}" r="4" class="dp"/>
    <text x="${L}" y="${H - 4}">${d(series[0][0])}</text><text x="${W - R}" y="${H - 4}" text-anchor="end">${d(last[0])}</text>
  </svg>
  <div class="ulg"><span><i class="dg"></i>Flagged game picks ${recU(last[1])}</span>${three ? `<span><i class="dp"></i>Flagged props ${recU(last[3])}</span><span><i class="dt"></i>Top 5 props each night ${recU(last[4])}</span>` : `<span><i class="dp"></i>Every prop at 1 unit ${recU(last[2])}</span>`}</div>`;
}
function calibChart(pc) {
  const pts = REC_CB.map(k => pc[k]).filter(v => v && v[0] > 0).map(v => ({ n: v[0], said: v[2] / v[0], hit: v[1] / v[0] }));
  if (!pts.length) return `<p class="muted">No graded props in this period.</p>`;
  const W = 300, H = 218, L = 46, Bm = 38, T = 8, R = 8, lo = 0.3, hi = 0.9;
  const x = v => L + (W - L - R) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo), y = v => T + (H - T - Bm) * (1 - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo));
  const tol = 0.03;
  return `<svg class="cchart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Model chance against how often it hit">
    <line x1="${x(lo)}" y1="${y(lo)}" x2="${x(hi)}" y2="${y(hi)}" class="diag"/>
    <line x1="${L}" x2="${W - R}" y1="${y(lo)}" y2="${y(lo)}" class="ax"/><line x1="${L}" x2="${L}" y1="${T}" y2="${y(lo)}" class="ax"/>
    ${[0.4, 0.5, 0.6, 0.7, 0.8].map(v => `<text x="${x(v)}" y="${H - 22}" text-anchor="middle">${Math.round(v * 100)}%</text><text x="${L - 5}" y="${y(v) + 3}" text-anchor="end">${Math.round(v * 100)}%</text>`).join('')}
    <text x="${(L + W - R) / 2}" y="${H - 4}" text-anchor="middle" class="axt">What the model said →</text>
    <text x="10" y="${(T + y(lo)) / 2}" text-anchor="middle" class="axt" transform="rotate(-90 10 ${(T + y(lo)) / 2})">How often it hit →</text>
    ${pts.map(p => `<circle cx="${x(p.said)}" cy="${y(p.hit)}" r="${Math.min(11, 3 + Math.sqrt(p.n))}" class="${p.hit - p.said < -tol ? 'over' : p.hit - p.said > tol ? 'under' : 'ok'}${p.n < 20 ? ' thin' : ''}"><title>Model said ${pct(p.said)}, hit ${pct(p.hit)} (${p.n} props)</title></circle>`).join('')}
  </svg>
  <div class="ulg"><span><i class="ok"></i>within 3 pts</span><span><i class="over"></i>overconfident</span><span><i class="under"></i>underconfident</span><span class="muted">bigger dot = more props; faded under 20</span></div>`;
}
function recLastList(last, games) {
  games = games || {};
  const ids = [...new Set(last.map(x => x.g))].sort((a, b) => String((games[a] || {}).tip || a) < String((games[b] || {}).tip || b) ? -1 : 1);
  if (!ids.length) return `<p class="muted">Nothing graded yet.</p>`;
  if (!ids.includes(recGame)) recGame = ids[0];
  const teamsOf = gid => { const g = games[gid]; if (g) return [g.away, g.home];
    return [...new Set(last.filter(x => x.g === gid).map(x => x.t === 'P' ? x.tm : x.who).filter(Boolean))].slice(0, 2); };
  const wl = gid => { const l = last.filter(x => x.g === gid && (!recFlagOnly || x.flag === 'Y')), w = l.filter(x => x.hit).length; return [w, l.length - w]; };
  const picker = `<div class="ln-pick" role="group" aria-label="Game">${ids.map(gid => { const t = teamsOf(gid), r = wl(gid);
    return `<button type="button" class="ln-chip" data-recgame="${esc(gid)}" aria-pressed="${gid === recGame}">${t.map(c => logo(c)).join('')}<b>${esc(t.join(' @ '))}</b><span>${r[0]}–${r[1]}</span></button>`; }).join('')}</div>`;
  const rows = last.filter(x => x.g === recGame && (!recFlagOnly || x.flag === 'Y'));
  const mk = { ML: 'ML', SPREAD: 'Spread', 'GAME TOTAL': 'Total', 'TEAM TOTAL': 'Team total', '1H SPREAD': '1H spread', '1H TOTAL': '1H total' };
  const pick = x => {
    if (x.t === 'P') return `${x.side === 'OVER' ? 'O' : 'U'} ${x.line} ${x.m}`;
    if (x.m === 'ML') return `${x.side} ${x.odds > 0 ? '+' : ''}${x.odds}`;
    if (/SPREAD/.test(x.m)) return `${x.side} ${x.line > 0 ? '+' : ''}${x.line}`;
    return `${x.m === 'TEAM TOTAL' ? x.who + ' ' : ''}${x.side === 'OVER' ? 'Over' : 'Under'} ${x.line}`;
  };
  const clv = c => c === 'B' ? '<span class="cv b" title="Beat the closing line">▲</span>' : c === 'W' ? '<span class="cv w" title="Worse than the closing line">▼</span>' : c === 'S' ? '<span class="cv s" title="Same as the close">=</span>' : '';
  const sorted = rows.sort((a, b) => (a.t === 'P') - (b.t === 'P') || String(a.who).localeCompare(String(b.who)) || ['PTS', 'REB', 'AST', '3PM', 'PRA'].indexOf(a.m) - ['PTS', 'REB', 'AST', '3PM', 'PRA'].indexOf(b.m));
  const table = sorted.length ? `<div class="ln-wrap"><table class="data ln-t"><thead><tr><th>Pick</th><th class="num">Actual</th><th class="num hide-sm">Edge</th><th class="num">Close</th><th class="num">Result</th></tr></thead><tbody>
      ${sorted.map(x => `<tr class="${x.flag === 'Y' ? 'fl' : ''}"><td>${x.t === 'P'
          ? `<b>${esc(x.who)}</b><small>${esc(pick(x))} · ${esc(x.tm)}${x.flag === 'C' ? ' · check' : x.flag === 'Y' ? ' · flagged' : ''}</small>`
          : `<b>${esc(pick(x))}</b><small>${x.t === 'A' ? 'NBA ALGO' : 'PLAYER ALGO'} · ${esc(mk[x.m] || x.m)}</small>`}</td>
        <td class="num">${x.act == null ? '—' : x.t !== 'P' && x.m !== 'GAME TOTAL' && x.m !== 'TEAM TOTAL' && x.m !== '1H TOTAL' ? sgn(x.act, 0) : esc(Math.round(x.act * 10) / 10)}</td>
        <td class="num hide-sm">${x.edge == null ? '' : sgn(x.edge * 100, 1) + '%'}</td><td class="num">${clv(x.close)}</td>
        <td class="num">${badge({ grade: x.hit ? 'W' : 'L', soft: x.flag !== 'Y', title: x.flag === 'Y' ? 'Flagged pick' : 'Tracked, not flagged' })}</td></tr>`).join('')}
      </tbody></table></div>` : `<p class="muted">No flagged picks in this game.</p>`;
  return picker + table;
}
/* ---------- 10-27b: top edges each night, props by game, what's hitting ---------- */
const PG_MK_L = [['ALL', 'All'], ['ML', 'ML'], ['SPREAD', 'Spread'], ['GAME TOTAL', 'Total'], ['TEAM TOTAL', 'Team total'], ['1H', '1H']];
const clvMark = c => c === 'B' ? '<span class="cv b" title="Beat the closing line">▲</span>' : c === 'W' ? '<span class="cv w" title="Worse than the closing line">▼</span>' : c === 'S' ? '<span class="cv s" title="Same as the close">=</span>' : '';
const oddsTxt = o => o == null ? '' : (o > 0 ? '+' : '−') + Math.abs(o);
const lineTxt = x => x.m === 'ML' ? `${x.side} ${oddsTxt(x.odds)}` : /SPREAD/.test(x.m) ? `${x.side} ${x.line > 0 ? '+' : ''}${x.line}${x.m === '1H SPREAD' ? ' 1H' : ''}`
  : `${x.m === 'TEAM TOTAL' ? x.tm + ' ' : ''}${x.side === 'OVER' ? 'Over' : 'Under'} ${x.line}${x.m === '1H TOTAL' ? ' 1H' : ''}`;
const lineMk = { ML: 'Moneyline', SPREAD: 'Spread', 'GAME TOTAL': 'Game total', 'TEAM TOTAL': 'Team total', '1H SPREAD': '1H spread', '1H TOTAL': '1H total' };
function pgRows(R) {
  const pg = R.pg || { d: [], g: {}, p: [], l: [] };
  return { pg,
    p: pg.p.map(r => ({ g: r[0], who: r[1], tm: r[2], m: r[3], line: r[4], side: r[5], odds: r[6], edge: recPricing === 'rp' && r[12] != null ? r[12] : r[7], proj: r[8], act: r[9], hit: r[10], close: r[11] })),
    l: pg.l.map(r => ({ g: r[0], tm: r[1], m: r[2], line: r[3], side: r[4], odds: r[5], edge: r[6], act: r[7], hit: r[8], close: r[9] })) };
}
const unitsOf = x => x.hit ? (x.odds == null ? 100 / 110 : x.odds > 0 ? x.odds / 100 : 100 / Math.abs(x.odds)) : -1;
const md2 = d => { const t = new Date(d + 'T12:00:00'); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][t.getDay()] + ' ' + d.slice(5).replace('-', '/'); };

function recRankCard(R, P, h) {
  const RK = P.rk || {};
  const ROWS = [['1', '#1 of the night'], ['3', 'Top 3'], ['5', 'Top 5'], ['G1', 'Each game’s #1']];
  const allP = REC_PM.reduce((a, [k]) => { const v = P.pm[k]; if (v) for (let i = 0; i < 4; i++) a[i] += v[i]; return a; }, [0, 0, 0, 0]);
  const allG = Object.keys(P.sl || {}).filter(k => /^Gms\|/.test(k)).reduce((a, k) => { const v = P.sl[k]; for (let i = 0; i < 4; i++) a[i] += v[i]; return a; }, [0, 0, 0, 0]);
  const block = (pre, all, allName) => {
    const rows = ROWS.map(([k, n]) => ({ n, v: RK[pre + k] })).filter(x => x.v && x.v[0]);
    if (!rows.length) return '<p class="muted">Nothing graded in this period.</p>';
    const line = (n, v, cls) => { const c = v[0], hit = v[1] / c, need = v[3] / c;
      return `<tr class="${cls || (c < SMALL ? 'thin' : '')}"><td class="l">${n}</td><td>${h.hb(hit, need, hit >= need ? 'up' : 'dn')}</td><td>${v[1]}–${c - v[1]}</td><td><b>${pct(hit)}</b></td>${h.uC(v[2])}</tr>`; };
    return h.tbl(['Each night', 'Hit vs needed', 'Record', 'Hit', 'Units'], rows.map(x => line(x.n, x.v)).concat(all[0] ? [line(allName, all, 'tot')] : []));
  };
  // last night's #1 of each kind
  const { pg, p, l } = pgRows(R), d0 = pg.d[0];
  const top = xs => xs.filter(x => pg.g[x.g] && pg.g[x.g][0] === d0).sort((a, b) => b.edge - a.edge)[0];
  const tp = top(p), tl = top(l);
  const lastTop = (x, txt) => x ? `<p class="rfoot pg-top">Last night’s #1: <b>${txt}</b> · ${sgn(x.edge * 100, 1)}% edge · ${badge({ grade: x.hit ? 'W' : 'L', soft: true })}</p>` : '';
  const n1 = (RK.P1 || [0])[0];
  let tk = '';
  if (n1 && n1 < 15) tk = h.take('e', 'Early', `${n1} night${n1 === 1 ? '' : 's'} so far, so the #1 pick has only ${n1} tries. These rows mean something after a few weeks; top 5 and each game’s #1 settle faster.`);
  else if (n1) {
    const m = v => v && v[0] ? v[1] / v[0] - v[3] / v[0] : null, mt = m(RK.P5), ma = m(allP);
    tk = mt != null && ma != null && mt - ma >= 0.03 ? h.take('g', 'Good sign', `The top 5 props each night beat break-even by <b>${Math.round(mt * 100)} points</b>, ahead of props overall (${sgn(ma * 100, 0)}). Ranking by edge is sorting winners to the top.`)
      : mt != null && ma != null && mt <= ma ? h.take('r', 'Problem', 'The top-ranked props are doing <b>no better</b> than props overall. The biggest edges aren’t the best picks yet.')
      : h.take('w', 'Watch', 'The top-ranked props are only slightly ahead of props overall.');
  }
  return h.card('Top edges each night', 'Every graded pick ranked by edge within its night. Does the model’s #1 pick do better than the rest? Player props and game lines are ranked separately. Check-marked props are left out.',
    tk + `<div class="rk-2"><div><h4 class="rh4">Player props</h4>${block('P', allP, 'All props')}${lastTop(tp, tp ? esc(tp.who) + ' ' + (tp.side === 'OVER' ? 'O' : 'U') + ' ' + tp.line + ' ' + tp.m : '')}</div>
      <div><h4 class="rh4">Game lines · NBA ALGO</h4>${block('G', allG, 'All game lines')}${lastTop(tl, tl ? esc(lineTxt(tl)) : '')}</div></div>`
    + h.foot('Every line with a model side counts here, flagged or not, at 1 unit (−110 unless it’s a moneyline). “Each game’s #1” = the single biggest edge in every game.'), true);
}

function recPropsByGame(R, h) {
  const { pg, p, l } = pgRows(R);
  if (!pg.d.length) return h.card('Props by game', '', '<p class="muted">Nothing graded yet.</p>', true);
  if (!pg.d.includes(pgDate)) pgDate = pg.d[0];
  const ids = Object.keys(pg.g).filter(g => pg.g[g][0] === pgDate).sort((a, b) => a < b ? -1 : 1);
  if (!ids.includes(pgGame)) pgGame = ids[0] || '';
  const isP = pgKind === 'p', src = (isP ? p : l).filter(x => x.g === pgGame);
  const mkOk = x => pgMk === 'ALL' || (isP ? x.m === pgMk : pgMk === '1H' ? /^1H/.test(x.m) : x.m === pgMk);
  const ord = { B: 0, S: 1, W: 2 };
  const rows = src.filter(mkOk).sort(pgSort === 'hit' ? (a, b) => b.hit - a.hit || b.edge - a.edge
    : pgSort === 'close' ? (a, b) => (ord[a.close] ?? 3) - (ord[b.close] ?? 3) || b.edge - a.edge : (a, b) => b.edge - a.edge);
  const shown = pgAll ? rows : rows.slice(0, 5);
  const gTop5 = gid => { const xs = (isP ? p : l).filter(x => x.g === gid).sort((a, b) => b.edge - a.edge).slice(0, 5), w = xs.filter(x => x.hit).length; return [w, xs.length - w]; };
  const dates = `<div class="pg-chips" role="group" aria-label="Night">${pg.d.map(d => `<button type="button" class="chip" data-pgdate="${d}" aria-pressed="${d === pgDate}">${md2(d)}</button>`).join('')}</div>`;
  const games = `<div class="ln-pick" role="group" aria-label="Game">${ids.map(gid => { const t = pg.g[gid].slice(1).filter(Boolean), r = gTop5(gid);
    return `<button type="button" class="ln-chip" data-pggame="${esc(gid)}" aria-pressed="${gid === pgGame}">${t.map(c => logo(c)).join('')}<b>${esc(t.join(' @ '))}</b><span title="Top 5 by edge">${r[0]}–${r[1]}</span></button>`; }).join('')}</div>`;
  const kinds = `<span class="seg-s" role="group" aria-label="Kind">${[['p', 'Player props'], ['l', 'Game lines']].map(([k, n]) => `<button type="button" data-pgkind="${k}" aria-pressed="${k === pgKind}">${n}</button>`).join('')}</span>`;
  const mks = (isP ? [['ALL', 'All']].concat(REC_PM.map(([k]) => [k, k])) : PG_MK_L).map(([k, n]) => `<button type="button" class="chip sm" data-pgmk="${k}" aria-pressed="${k === pgMk}">${n}</button>`).join('');
  const sorts = `<span class="pg-sort">Sort ${[['edge', 'Edge'], ['hit', 'Hit'], ['close', 'Beat close']].map(([k, n]) => `<button type="button" data-pgsort="${k}" aria-pressed="${k === pgSort}">${n}</button>`).join('')}</span>`;
  const row = (x, i) => isP
    ? `<div class="pg-row"><span class="pg-n">${i + 1}</span><div class="pg-who"><b>${esc(x.who)}</b> <em>${esc(x.m)}</em><small>${x.side === 'OVER' ? 'Over' : 'Under'} ${x.line} · ${oddsTxt(x.odds)} · ${esc(x.tm)} ${clvMark(x.close)}</small></div>
        <span class="pg-e ${x.edge > 0 ? 'pos' : 'mut'}">${sgn(x.edge * 100, 1)}%</span><span class="pg-pa">${x.proj == null ? '—' : f1(x.proj)} → <b>${x.act == null ? '—' : esc(x.act)}</b></span>${badge({ grade: x.hit ? 'W' : 'L', soft: true })}</div>`
    : `<div class="pg-row"><span class="pg-n">${i + 1}</span><div class="pg-who"><b>${esc(lineTxt(x))}</b><small>${esc(lineMk[x.m] || x.m)}${x.m !== 'ML' ? ' · −110' : ''} ${clvMark(x.close)}</small></div>
        <span class="pg-e ${x.edge > 0 ? 'pos' : 'mut'}">${sgn(x.edge * 100, 1)}%</span><span class="pg-pa">${x.act == null ? '—' : `<b>${/TOTAL/.test(x.m) ? esc(x.act) : sgn(x.act, 0)}</b>`}</span>${badge({ grade: x.hit ? 'W' : 'L', soft: true })}</div>`;
  const w = shown.filter(x => x.hit).length, u = shown.reduce((a, x) => a + unitsOf(x), 0);
  const older = pgDate !== pg.d[0] && isP;
  const more = rows.length > 5 ? `<button type="button" class="chip sm" data-pgall>${pgAll ? 'Show top 5' : `Show all ${rows.length}${older ? ' kept' : ''}`}</button>` : '';
  const list = shown.length ? `<div class="pg-list"><div class="pg-row pg-h"><span></span><span>${isP ? 'Player · pick' : 'Pick'}</span><span>Edge</span><span>${isP ? 'Proj → act' : 'Result'}</span><span></span></div>${shown.map(row).join('')}</div>
    <div class="pg-foot"><span>${pgAll ? 'Shown' : 'Top ' + shown.length}: <b>${w}–${shown.length - w}</b> · ${recU(u)}u</span>${more}</div>${older && rows.length >= 10 && pgAll ? h.foot('Older nights keep each game’s top 10 props by edge; last night keeps all of them.') : ''}`
    : '<p class="muted">Nothing graded for this filter.</p>';
  return h.card('Props by game', 'Each game’s picks ranked by edge, top 5 first. Pick a night and a game, filter by type, or re-sort. Every graded pick counts at 1 unit, flagged or not.',
    dates + games + `<div class="pg-tools">${kinds}<span class="pg-mks">${mks}</span>${sorts}</div>` + list, true);
}

const WH_DIMS = {
  p: [['ms', 'Market + side'], ['eg', 'Edge'], ['pr', 'Price'], ['gp', 'Projection vs line'], ['mn', 'Minutes vs usual'], ['df', 'Opponent defense'], ['to', 'Teammates out'],
    ['sp', 'Spread'], ['tt', 'Game total'], ['mv', 'Line move since 8 AM'], ['ha', 'Home / away'], ['rs', 'Rest'], ['mo', 'Model vs market'], ['bc', 'Beat close']],
  g: [['ms', 'Market'], ['eg', 'Edge'], ['sp', 'Spread'], ['tt', 'Game total'], ['ha', 'Home / away'], ['rs', 'Rest'], ['to', 'Teammates out'], ['bc', 'Beat close']] };
const WH_NAMES = {
  eg: { u3: 'under 3%', b3: '3–5%', b5: '5–8%', b8: '8–12%', b12: '12%+', n0: 'below 0 (other side)', r0: '0–1%', r1: '1–2%', r2: '2–3%', r3: '3%+' }, pr: { fav: 'Favorite (−130 or shorter)', even: 'Near even', dog: 'Underdog (+110 or longer)' },
  gp: { a: 'under 5% apart', b: '5–10% apart', c: '10–20% apart', d: '20%+ apart' }, mn: { up: '3+ more minutes', same: 'about his usual', down: '3+ fewer minutes' },
  df: { soft: 'soft (4%+ easier)', avg: 'about average', tough: 'tough (4%+ harder)' }, to: { none: 'nobody out', some: 'under 25 min out', major: '25+ min out' },
  sp: { close: 'under 5', mid: '5 to 9.5', big: '10 or more' }, tt: { low: 'under 220', mid: '220 to 234.5', high: '235 or more' },
  mv: { with: 'moved our way', none: 'didn’t move', against: 'moved against us' }, ha: { H: 'Home', A: 'Away' }, rs: { b2b: 'back-to-back', one: '1 day off', two: '2+ days off' },
  mo: { a: 'model ≈ blend (<5 pts)', b: '5–12 pts apart', c: '12+ pts apart' }, bc: { B: 'beat the close', S: 'same as close', W: 'worse than close' } };
const WH_NOTE = { mn: 'Projected minutes against his usual minutes.', df: 'Opponent against his position for this stat (1.00 = average).', to: 'Usual minutes of teammates ruled out.',
  sp: 'His team’s spread, either side.', mv: 'This prop’s line at lock against its 8 AM line.', mo: 'How far the model alone was from the market-blended chance.', gp: 'How far the projection sat from the line.' };
const WH_NEW = ['mn', 'df', 'to', 'sp', 'tt', 'mv', 'ha', 'rs'];
function recWhatsHitting(P, h) {
  const SL = P.sl || {}, pre = whKind === 'g' ? 'G' : '';
  const dims = WH_DIMS[whKind];
  if (!dims.some(([k]) => k === whDim)) whDim = 'ms';
  let rows;
  if (whDim === 'eg' && whKind === 'p') rows = Object.keys(WH_NAMES.eg).filter(k => P.pe[k]).map(k => ({ n: WH_NAMES.eg[k], v: P.pe[k] }));
  else {
    const keys = Object.keys(SL).filter(k => k.indexOf(pre + whDim + '|') === 0);
    const nm = WH_NAMES[whDim] || {};
    rows = keys.map(k => { const b = k.split('|')[1]; return { b, n: nm[b] || (whDim === 'ms' ? (() => { const sd = (b.match(/ (OVER|UNDER)$/) || [])[1], mk = sd ? b.slice(0, -sd.length - 1) : b;
      return (whKind === 'g' ? (lineMk[mk] || mk) : mk) + (sd ? ' ' + sd.toLowerCase() + 's' : ''); })() : b), v: SL[k] }; });
    const order = Object.keys(nm);
    rows.sort(whDim === 'ms' ? (a, b) => (b.v[1] / b.v[0] - b.v[3] / b.v[0]) - (a.v[1] / a.v[0] - a.v[3] / a.v[0]) : (a, b) => order.indexOf(a.b) - order.indexOf(b.b));
  }
  const kinds = `<span class="seg-s" role="group" aria-label="Kind">${[['p', 'Player props'], ['g', 'Game lines']].map(([k, n]) => `<button type="button" data-whkind="${k}" aria-pressed="${k === whKind}">${n}</button>`).join('')}</span>`;
  const chips = `<div class="pg-chips">${dims.map(([k, n]) => `<button type="button" class="chip sm" data-whdim="${k}" aria-pressed="${k === whDim}">${n}</button>`).join('')}</div>`;
  const body = rows.length ? rows.map(x => { const c = x.v[0], hit = x.v[1] / c, need = x.v[3] / c;
      return recBar(esc(x.n), hit, need, `<b>${pct(hit)}</b> <small class="mut">${c}</small> ${recU(x.v[2])}`, hit >= need ? 'up' : 'dn', c); }).join('')
    : `<p class="muted">${WH_NEW.includes(whDim) ? 'Logged with each pick starting 10/28. This fills in as those picks are graded.' : 'Nothing graded in this period.'}</p>`;
  const note = WH_NOTE[whDim] ? `<p class="rfoot">${WH_NOTE[whDim]}</p>` : '';
  return h.card('What’s hitting', 'Every graded pick grouped by its situation. The bar is how often it hit; the tick is break-even for the prices taken. Small number = picks, then units at 1 each. Faded rows have fewer than ' + SMALL + '.',
    `<div class="pg-tools">${kinds}</div>` + chips + `<div class="wh-bars">${body}</div>` + note
    + h.foot('Situations are saved when each pick is logged, before tip, so nothing here uses hindsight. A few hundred picks per row before trusting a gap of a few points.'), true);
}

/* season record in one place: flagged game picks W–L and units, beat-the-close share (masthead, Record hero) */
function recSummary(per) {
  const R = B.rec;
  if (!R || R.error || !R.lastDay) return null;
  const P = R.periods[per || 'season'] || R.periods.season;
  const tot = keys => keys.reduce((a, k) => { (P.gm[k] || []).forEach((v, i) => { a[i] = (a[i] || 0) + v; }); return a; }, [0, 0, 0]);
  const g = tot(REC_MK.map(x => x[0])), cl = P.cl.ALL || [0, 0, 0];
  return { w: g[0], l: g[1], u: g[2], n: g[0] + g[1], beat: cl[0], worse: cl[2], clPct: cl[0] + cl[2] ? cl[0] / (cl[0] + cl[2]) : null, P };
}
const recPickTxt = x => x.t === 'P' ? `${x.side === 'OVER' ? 'O' : 'U'} ${x.line} ${x.m}`
  : x.m === 'ML' ? `${x.side} ${x.odds > 0 ? '+' : ''}${x.odds}`
  : /SPREAD/.test(x.m) ? `${x.side} ${x.line > 0 ? '+' : ''}${x.line}${x.m === '1H SPREAD' ? ' 1H' : ''}`
  : `${x.m === 'TEAM TOTAL' ? x.who + ' ' : ''}${x.side === 'OVER' ? 'Over' : 'Under'} ${x.line}${x.m === '1H TOTAL' ? ' 1H' : ''}`;
/* half-circle gauge: filled to the model's chance, a dark tick at what the price needs, the edge in the middle */
// edge dial: every dial on the page uses the same 0–15% scale, so a fuller arch is always a bigger edge
const DIAL_MAX = 0.15;
function edgeDial(edge, title) {
  if (edge == null) return '<span class="ag"></span>';
  const R = 30, cx = 38, cy = 36, pt = f => { const a = Math.PI * (1 - Math.max(0, Math.min(1, f))); return [(cx + R * Math.cos(a)).toFixed(1), (cy - R * Math.sin(a)).toFixed(1)]; };
  const [x1, y1] = pt(0), [x2, y2] = pt(1), f = Math.min(1, Math.abs(edge) / DIAL_MAX), [xf, yf] = pt(f);
  return `<span class="ag"${title ? ` title="${esc(title)}"` : ''}><svg viewBox="0 0 76 42" aria-hidden="true">
    <path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${x2} ${y2}" class="ag-bg"/>
    ${f > 0.005 ? `<path d="M${x1} ${y1} A${R} ${R} 0 0 1 ${xf} ${yf}" class="ag-f${edge >= 0 ? '' : ' neg'}"/>` : ''}</svg>
    <b class="${edge >= 0 ? 'pos' : 'neg'}">${sgn(edge * 100, 1)}%</b><small>edge</small></span>`;
}
// a call's chances, break-even and edge (edge = how far the lower model clears break-even)
// (one-model flags: the edge is the flagging model's, since the other model may sit on the same side without clearing the flag)
function callNums(c) {
  const pr = (c.probs || []).filter(Boolean), raw = c.score - (c.both ? 1 : 0);
  const low = pr.length ? Math.min(...pr.map(x => x[1])) : null, be = low != null ? low - raw : null;
  if (c.both || be == null) return { pr, edge: raw, be };
  const mine = pr.find(x => x[0] === (c.model === 'NBA ALGO' ? 'a' : 'p'));
  return { pr, edge: mine ? mine[1] - be : raw, be };
}
const bigEdgeOf = () => recPricing === 'rp' && B && B.rec && B.rec.rp && B.rec.rp.has ? B.rec.rp.big || 0.02 : (B && B.propFlag) || 0.03;
function renderRecordPage() {
  const R = B.rec;
  const howto = `<h2 class="h2b">Reading The Slate</h2>
    <div class="howto">
      <div><h3>The two models</h3><p><i class="dot a"></i><b>NBA ALGO</b> builds each score from team ratings. <i class="dot p"></i><b>PLAYER ALGO</b> builds it from the players expected to play. They're built different ways, so the games where they agree are the ones worth a look.</p></div>
      <div><h3>Flagged vs tracked</h3><p>Every line and prop is logged before tip and graded. <b>Flagged</b> ones cleared the edge threshold (solid W/L); the rest are tracked (outlined) so the model's whole record is visible.</p></div>
      <div><h3>Closing line</h3><p>The line at tip. Getting a better number than the close (▲) is the earliest sign an edge is real, long before the win-loss record settles.</p></div>
      <div><h3>Private</h3><p>This page is built from a cached workbook snapshot. Use Refresh at the top to rebuild it. Keep web-app access restricted to yourself.</p></div>
    </div>`;
  if (!R || R.error || !R.lastDay) return `<section id="record"><h2>Record</h2>${trackingNote()}
    <div class="empty"><b>${R && R.error ? 'The record could not be built: ' + esc(R.error) : 'No graded games yet.'}</b> Every line is logged about an hour before tip and graded the next morning.</div>${howto}</section>`;
  const P0 = R.periods[recPer] || R.periods.season;
  const rpOn = recPricing === 'rp' && R.rp && R.rp.has;
  const P = rpOn ? Object.assign({}, P0, R.rp.periods[recPer] || R.rp.periods.season) : P0;
  const tot = (o, keys) => keys.reduce((a, k) => { (o[k] || []).forEach((v, i) => { a[i] = (a[i] || 0) + v; }); return a; }, []);
  const g = tot(P.gm, REC_MK.map(x => x[0])), pr = tot(P.pm, REC_PM.map(x => x[0])), cl = P.cl.ALL || [0, 0, 0], pts = P.pj.PTS || [0, 0, 0, 0];
  const gN = (g[0] || 0) + (g[1] || 0), prN = pr[0] || 0;
  const S = recSummary(recPer), lastFl = (R.last || []).filter(x => x.t === 'A' && x.flag === 'Y');
  // 10-27d: hero props cards = flagged props and the top 5 each night ([n, hit, units, break-even sum])
  const heroCard = (title, v, chip) => { const n = v ? v[0] : 0, h = n ? v[1] / n : null, need = n ? v[3] / n : null;
    return `<div class="rh-card"><small>${title}</small><b>${n ? pct(h) : '—'}</b><em>${n ? `${v[1]}–${n - v[1]} · needed ${pct(need)} · ${recU(v[2])}u` : 'none graded yet'}</em>
      <div class="rh-chips">${chip ? `<span>${chip}</span>` : ''}${n ? (Math.abs(h - need) < 0.01 ? '<span>about break-even</span>' : `<span class="${h >= need ? 'pos' : 'neg'}">${Math.round(Math.abs(h - need) * 100)} pts ${h >= need ? 'over' : 'under'} break-even</span>`) : ''}</div></div>`; };
  const ring = S && S.clPct != null ? `<span class="rring" style="--p:${(S.clPct * 100).toFixed(1)}"><b>${pct(S.clPct)}</b></span>` : `<span class="rring" style="--p:0"><b>—</b></span>`;
  const hero = `<div class="rhero">
    <div class="rh-big"><small>Flagged game picks · ${recPer === 'season' ? 'season' : recPer === 'd7' ? 'last 7 days' : 'last night'}</small>
      <div class="rh-wl">${gN ? `<span class="w">${g[0]}</span>–<span class="l">${g[1]}</span>` : '—'}</div>
      <div class="rh-sub">${gN ? `${recU(g[2])} units · ROI ${sgn(g[2] / gN * 100, 0)}%` : 'none graded yet'}</div>
      ${lastFl.length ? `<div class="rh-strip" title="Last night's flagged game picks">${lastFl.map(x => `<i class="${x.hit ? 'w' : 'l'}" title="${esc(recPickTxt(x))}">${x.hit ? 'W' : 'L'}</i>`).join('')}<span>last night</span></div>` : ''}</div>
    ${heroCard('Flagged props', P.pf && P.pf.ALL, rpOn ? `edge ${pct(B.propFlag || 0.02)}+ · today’s pricing` : 'flagged when logged')}
    ${heroCard('Top 5 each night', P.rk && P.rk.P5, S && S.beat + S.worse ? `beat the close ${pct(S.clPct)}` : 'props, ranked by edge')}
  </div>`;
  const tiles = `<div class="rtiles" hidden>
    <div class="rtile"><small>Flagged game picks</small><b>${gN ? `${g[0]}–${g[1]}` : '—'}</b><em>${gN ? `${recU(g[2])} units · ROI ${sgn(g[2] / gN * 100, 0)}%` : 'none graded yet'}</em></div>
    <div class="rtile"><small>Every graded prop</small><b>${prN ? pct(pr[1] / prN) : '—'}</b><em>${prN ? `${pr[1]} of ${prN} hit · break-even ${pct(pr[3] / prN)}` : 'none graded yet'}</em></div>
    <div class="rtile"><small>Beat the closing line</small><b>${cl[0] + cl[2] ? pct(cl[0] / (cl[0] + cl[2])) : '—'}</b><em>${cl[0] + cl[2] ? `${cl[0]} beat, ${cl[2]} worse · props` : 'closes fill in each morning'}</em></div>
    <div class="rtile"><small>Points projection miss</small><b>${pts[0] ? f1(pts[1] / pts[0]) : '—'}</b><em>${pts[2] && pts[3] ? `${(1 - (pts[1] / pts[0]) / (pts[3] / pts[2])) >= 0 ? '<span class="pos">' + pct(1 - (pts[1] / pts[0]) / (pts[3] / pts[2])) + ' better</span>' : '<span class="neg">' + pct((pts[1] / pts[0]) / (pts[3] / pts[2]) - 1) + ' worse</span>'} than baseline · ${pts[0]} players` : 'per player who played'}</em></div>
  </div>`;
  // ---- the analysis cards: a plain question, a takeaway written from the numbers, then a table ----
  const EARLY = 30;   // fewer picks than this: the takeaway says it's too early to read
  const take = (tone, label, html) => `<div class="tk ${tone}"><i>${label}</i><span>${html}</span></div>`;
  const early = (n, what) => take('e', 'Early', `Only ${n} ${what} so far. Give it ${EARLY - n} more before reading much into ${n === 1 ? 'it' : 'them'}.`);
  const tbl = (head, rows) => `<div class="rt-wrap"><table class="rtb"><thead><tr>${head.map((h, i) => `<th${i ? '' : ' class="l"'}>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const hb = (frac, mark, tone) => `<span class="hb"><i class="${tone}" style="width:${(Math.max(0, Math.min(1, frac || 0)) * 100).toFixed(1)}%"></i>${mark != null ? `<s style="left:${(Math.max(0, Math.min(1, mark)) * 100).toFixed(1)}%"></s>` : ''}</span>`;
  const uC = u => `<td class="${u > 0.005 ? 'pos' : u < -0.005 ? 'neg' : 'mut'}">${sgn(u, 2)}</td>`;
  const roiC = (u, n) => n ? `<td class="${u > 0.005 ? 'pos' : u < -0.005 ? 'neg' : 'mut'}">${sgn(u / n * 100, 0)}%</td>` : '<td class="mut">—</td>';
  const nameList = xs => xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1];

  const pa = P.pa, paN = pa[0] + pa[1];
  // units over time (always the whole season)
  const series = (rpOn && R.rp.units) || R.units || [];
  const pk = series.length && series[0][3] != null ? 3 : 2;   // flagged props (older servers: every prop)
  const nights = series.map((s0, i) => [s0[0], i ? (s0[1] - series[i - 1][1]) + (s0[pk] - series[i - 1][pk]) : s0[1] + s0[pk]]);
  const lastU = series.length ? series[series.length - 1] : null;
  let unitsTake = '';
  if (!lastU || series.length < 3) unitsTake = take('e', 'Early', `${series.length || 'No'} graded night${series.length === 1 ? '' : 's'} so far. The trend means more after a week.`);
  else {
    const gU = lastU[1], pU = lastU[3] != null ? lastU[3] : lastU[2];
    unitsTake = gU >= 0 && pU >= 0 ? take('g', 'Good sign', `Both are up: flagged game picks <b>${sgn(gU, 1)}u</b>, flagged props <b>${sgn(pU, 1)}u</b>.`)
      : gU < 0 && pU < 0 ? take('r', 'Problem', `Both are down: flagged game picks <b>${sgn(gU, 1)}u</b>, flagged props <b>${sgn(pU, 1)}u</b>.`)
      : take('w', 'Mixed', `<b>${pU > gU ? 'Flagged props are' : 'Game picks are'} carrying the season</b> at ${sgn(Math.max(gU, pU), 1)} units; ${pU > gU ? 'flagged game picks are' : 'flagged props are'} at ${sgn(Math.min(gU, pU), 1)}. Together: ${sgn(gU + pU, 1)}.`);
  }
  const best = nights.slice().sort((x, y) => y[1] - x[1])[0], worst = nights.slice().sort((x, y) => x[1] - y[1])[0];
  const md = d => d ? d.slice(5).replace('-', '/') : '';
  const unitStats = lastU ? `<div class="rstats"><div>Season total<b class="${lastU[1] + lastU[pk] >= 0 ? 'pos' : 'neg'}">${sgn(lastU[1] + lastU[pk], 1)}u</b></div>
      <div>Best night<b>${sgn(best[1], 1)}u</b>${md(best[0])}</div><div>Worst night<b>${sgn(worst[1], 1)}u</b>${md(worst[0])}</div>
      <div>Winning nights<b>${nights.filter(x => x[1] > 0).length} of ${nights.length}</b></div></div>` : '';

  // game picks by market
  const gmList = REC_MK.filter(([k]) => P.gm[k]).map(([k, n]) => { const v = P.gm[k], c = v[0] + v[1]; return { n, w: v[0], l: v[1], u: v[2], c, need: v[3] != null && c ? v[3] / c : 0.524 }; })
    .sort((x, y) => (y.c ? y.u / y.c : -9) - (x.c ? x.u / x.c : -9));
  const gTot = gmList.reduce((a, x) => [a[0] + x.w, a[1] + x.l, a[2] + x.u], [0, 0, 0]), gC = gTot[0] + gTot[1];
  let gmTake;
  if (!gC) gmTake = '';
  else if (gC < EARLY) gmTake = early(gC, 'flagged game picks');
  else {
    const up = gmList.filter(x => x.c >= 5 && x.u / x.c > 0.02), dn = gmList.filter(x => x.c >= 5 && x.u / x.c < -0.02).reverse();
    const upT = up.length ? `Working: ${up.map(x => `<b>${x.n}</b> (${x.w}–${x.l}, ${sgn(x.u, 1)}u)`).join(', ')}.` : 'No game market is in the black yet.';
    const dnT = dn.length ? ` Dragging: ${dn.map(x => `<b>${x.n}</b> (${x.w}–${x.l}, ${sgn(x.u, 1)}u)`).join(', ')}.` : '';
    const roi = gTot[2] / gC;
    gmTake = roi > 0.02 ? take('g', 'Good sign', upT + dnT) : roi < -0.1 ? take('r', 'Problem', upT + dnT) : take('w', 'Mixed', upT + dnT);
  }
  const gmTbl = gmList.length ? tbl(['Market', 'Win vs needed', 'Record', 'Win', 'Units', 'ROI'], gmList.map(x => `<tr class="${x.c < SMALL ? 'thin' : ''}"><td class="l">${x.n}</td><td>${hb(x.c ? x.w / x.c : 0, x.need, x.c && x.w / x.c >= x.need ? 'up' : 'dn')}</td><td>${x.w}–${x.l}</td><td><b>${x.c ? pct(x.w / x.c) : '—'}</b></td>${uC(x.u)}${roiC(x.u, x.c)}</tr>`)
    .concat(gmList.length > 1 ? [`<tr class="tot"><td class="l">All game picks</td><td></td><td>${gTot[0]}–${gTot[1]}</td><td><b>${gC ? pct(gTot[0] / gC) : '—'}</b></td>${uC(gTot[2])}${roiC(gTot[2], gC)}</tr>`] : [])) : '';

  // props by market
  const pmList = REC_PM.filter(([k]) => P.pm[k]).map(([k, n]) => { const v = P.pm[k]; return { n, c: v[0], h: v[1], u: v[2], need: v[3] / v[0] }; })
    .sort((x, y) => y.u / y.c - x.u / x.c);
  const pTot = pmList.reduce((a, x) => [a[0] + x.c, a[1] + x.h, a[2] + x.u, a[3] + x.need * x.c], [0, 0, 0, 0]);
  let pmTake = '';
  if (pTot[0] && pTot[0] < EARLY) pmTake = early(pTot[0], 'graded props');
  else if (pTot[0]) {
    const up = pmList.filter(x => x.c >= 20 && x.u / x.c > 0.02 && x.h / x.c > x.need), dn = pmList.filter(x => x.c >= 20 && x.u / x.c < -0.02).reverse();
    const upT = up.length ? `Winning: ${up.map(x => `<b>${x.n}</b> (${pct(x.h / x.c)}, ${sgn(x.u, 1)}u)`).join(', ')}.` : 'No prop market is clearly winning yet.';
    const dnT = dn.length ? ` Below break-even: ${dn.map(x => `<b>${x.n}</b> (${pct(x.h / x.c)}, ${sgn(x.u, 1)}u)`).join(', ')}.` : '';
    pmTake = pTot[2] / pTot[0] > 0.02 ? take('g', 'Good sign', upT + dnT) : pTot[2] / pTot[0] < -0.05 ? take('r', 'Problem', upT + dnT) : take('w', 'Mixed', upT + dnT);
  }
  const pmTbl = pmList.length ? tbl(['Market', 'Hit vs needed', 'Record', 'Hit', 'Units', 'ROI'], pmList.map(x => `<tr class="${x.c < SMALL ? 'thin' : ''}"><td class="l">${x.n}</td><td>${hb(x.h / x.c, x.need, x.h / x.c >= x.need ? 'up' : 'dn')}</td><td>${x.h}–${x.c - x.h}</td><td><b>${pct(x.h / x.c)}</b></td>${uC(x.u)}${roiC(x.u, x.c)}</tr>`)
    .concat([`<tr class="tot"><td class="l">All props</td><td>${hb(pTot[1] / pTot[0], pTot[3] / pTot[0], pTot[1] / pTot[0] >= pTot[3] / pTot[0] ? 'up' : 'dn')}</td><td>${pTot[1]}–${pTot[0] - pTot[1]}</td><td><b>${pct(pTot[1] / pTot[0])}</b></td>${uC(pTot[2])}${roiC(pTot[2], pTot[0])}</tr>`])) : '';

  // is the model honest? (calibration)
  const CB_NAME = { c0: 'under 50%', c50: '50–55%', c55: '55–60%', c60: '60–65%', c65: '65–70%', c70: '70–80%', c80: '80%+' }, TOL = 0.03;
  const cal = REC_CB.filter(k => P.pc[k] && P.pc[k][0] > 0).map(k => { const v = P.pc[k]; return { k, name: CB_NAME[k], n: v[0], said: v[2] / v[0], hit: v[1] / v[0] }; });
  const calN = cal.reduce((a, x) => a + x.n, 0);
  const verdictOf = x => { const d = x.hit - x.said; return Math.abs(d) <= TOL ? '<td class="pos">on target</td>' : `<td class="neg">${Math.round(Math.abs(d) * 100)} pts too ${d < 0 ? 'high' : 'low'}</td>`; };
  let calTake = '';
  if (calN && calN < 100) calTake = take('e', 'Early', `${calN} graded props so far. Calibration needs a few hundred to settle.`);
  else if (calN) {
    const solid = cal.filter(x => x.n >= 20), off = solid.filter(x => Math.abs(x.hit - x.said) > TOL);
    const over = off.filter(x => x.hit < x.said), under = off.filter(x => x.hit > x.said);
    if (!off.length) calTake = take('g', 'Good sign', 'Honest across the board: in every group with 20+ props, what the model said and how often it hit are within 3 points.');
    else if (over.length && over.every(x => x.said >= 0.6) && solid.some(x => x.said < 0.6 && Math.abs(x.hit - x.said) <= TOL)) {
      const first = over.slice().sort((x, y) => x.said - y.said)[0], worstO = over.slice().sort((x, y) => (x.hit - x.said) - (y.hit - y.said))[0];
      calTake = take('w', 'Watch', `Honest up to about <b>${Math.round(first.said * 100 / 5) * 5}%</b>. Above that it's <b>overconfident</b>: props it called ${worstO.name} hit only ${pct(worstO.hit)}.`);
    } else calTake = take(off.length > solid.length / 2 ? 'r' : 'w', off.length > solid.length / 2 ? 'Problem' : 'Watch',
      `${over.length ? `<b>Overconfident</b> in ${nameList(over.map(x => x.name))}` : ''}${over.length && under.length ? '; ' : ''}${under.length ? `<b>underconfident</b> in ${nameList(under.map(x => x.name))}` : ''}.`);
  }
  const calTbl = cal.length ? tbl(['Model said', 'Hit', 'Props', 'Verdict'], cal.map(x => `<tr class="${x.n < 20 ? 'thin' : ''}"><td class="l">${x.name}</td><td><b>${pct(x.hit)}</b></td><td>${x.n}</td>${verdictOf(x)}</tr>`)) : '';

  // does a bigger edge win more?
  const cap = (P_ => (P_ && P_.propCap) || 0.15)(B.params);
  const EB_NAME = { u3: 'under 3%', b3: '3–5%', b5: '5–8%', b8: '8–12%', b12: `12–${Math.round(cap * 100)}%`, n0: 'below 0 (other side)', r0: '0–1%', r1: '1–2%', r2: '2–3%', r3: '3%+', chk: `Over ${Math.round(cap * 100)}% or minutes off` };
  const ebList = REC_EB.filter(([k]) => P.pe[k]).map(([k]) => { const v = P.pe[k]; return { k, name: EB_NAME[k], c: v[0], h: v[1], u: v[2], need: v[3] / v[0] }; });
  let ebTake = '';
  const ebN = ebList.filter(x => x.k !== 'chk').reduce((a, x) => a + x.c, 0);
  if (ebN && ebN < 100) ebTake = take('e', 'Early', `${ebN} graded props so far. Each edge group needs a few dozen before the pattern means much.`);
  else if (ebN) {
    const top = ebList.filter(x => (x.k === 'b12' || x.k === 'b8' || x.k === 'r3') && x.c >= 20), low = ebList.filter(x => (x.k === 'u3' || x.k === 'b3' || x.k === 'n0' || x.k === 'r0') && x.c >= 20);
    const margin = xs => { const c = xs.reduce((a, x) => a + x.c, 0); return c ? xs.reduce((a, x) => a + (x.h / x.c - x.need) * x.c, 0) / c : null; };
    const mt = margin(top), ml = margin(low), t12 = ebList.find(x => x.k === 'b12') || ebList.find(x => x.k === 'r3');
    if (mt != null && ml != null && mt - ml >= 0.03) ebTake = take('g', 'Good sign', t12 && t12.c >= 20 ? `Edges of <b>${t12.name}</b> hit <b>${pct(t12.h / t12.c)}</b> when they needed ${pct(t12.need)}. Small edges are close to a coin flip after the juice.` : 'The bigger edge groups are clearing break-even by more than the small ones.');
    else if (mt != null && mt < 0) ebTake = take('r', 'Problem', 'The biggest edges are hitting <b>below</b> what their prices needed. The edge number may be overstating the model.');
    else ebTake = take('w', 'Watch', 'Bigger edges aren\'t clearly winning more yet. The groups are hitting about the same against what they needed.');
  }
  const ebTbl = ebList.length ? tbl(['Edge', 'Hit vs needed', 'Hit', 'Needed', 'Record', 'Units'], ebList.map(x => `<tr class="${x.c < SMALL ? 'thin' : ''}${x.k === 'chk' ? ' chk' : ''}"><td class="l">${x.name}</td><td>${hb(x.h / x.c, x.need, x.k === 'chk' ? 'gray' : x.h / x.c >= x.need ? 'up' : 'dn')}</td><td><b>${pct(x.h / x.c)}</b></td><td>${pct(x.need)}</td><td>${x.h}–${x.c - x.h}</td>${uC(x.u)}</tr>`)) : '';

  // beating the closing line
  const clList = REC_PM.filter(([k]) => P.cl[k]).map(([k, n]) => ({ n, v: P.cl[k] })).concat(P.cl.GAME ? [{ n: 'Game lines', v: P.cl.GAME }] : []);
  const clAll = clList.reduce((a, x) => [a[0] + x.v[0], a[1] + x.v[1], a[2] + x.v[2]], [0, 0, 0]), clC = clAll[0] + clAll[2];
  let clTake = '';
  if (clC && clC < 100) clTake = take('e', 'Early', `${clC} picks with a closing line so far. This is the quickest stat to settle, but give it 100 or so.`);
  else if (clC) {
    const rate = clAll[0] / clC, ranked = clList.filter(x => x.v[0] + x.v[2] >= 30).map(x => ({ n: x.n, r: x.v[0] / (x.v[0] + x.v[2]) })).sort((a, b2) => b2.r - a.r);
    const lead = ranked.slice(0, 2).map(x => `${x.n.toLowerCase()} (<b>${pct(x.r)}</b>)`), lag = ranked.length > 2 ? ranked[ranked.length - 1] : null;
    const tail = `${lead.length ? ' ' + lead.join(' and ').replace(/^./, c => c.toUpperCase()) + ' lead' : ''}${lag && lag.r < 0.53 ? `; ${lag.n.toLowerCase()} ${lag.r < 0.5 ? 'are moving against us' : 'are a coin flip'}` : ''}.`;
    clTake = rate >= 0.55 ? take('g', 'Good sign', `We beat the close on <b>${pct(rate)}</b> of picks.${tail}`)
      : rate >= 0.5 ? take('w', 'Mixed', `We beat the close on <b>${pct(rate)}</b> of picks, a little better than a coin flip.${tail}`)
      : take('r', 'Problem', `The line moves <b>against</b> us more often than for us (${pct(rate)} beat).${tail}`);
  }
  const clTbl = clList.length ? tbl(['Market', 'Beat', 'Same', 'Worse', 'Beat %'], clList.map(x => { const c = x.v[0] + x.v[2], r = c ? x.v[0] / c : null;
    return `<tr class="${x.v[0] + x.v[1] + x.v[2] < SMALL ? 'thin' : ''}"><td class="l">${x.n}</td><td>${x.v[0]}</td><td>${x.v[1]}</td><td>${x.v[2]}</td><td class="${r == null ? 'mut' : r > 0.52 ? 'pos' : r < 0.48 ? 'neg' : 'mut'}"><b>${r == null ? '—' : pct(r)}</b></td></tr>`; })) : '';

  // CLV scoreboard: is the market coming to the MODEL, or just drifting toward one side? Same side, big vs small edge.
  const CV = P.cv || {}, cvRate = v => v && v[0] + v[2] ? v[0] / (v[0] + v[2]) : null, cvN = v => v ? v[0] + v[2] : 0;
  const cvRows = REC_PM.filter(([k]) => CV[k + '|OVER|big'] || CV[k + '|UNDER|big']).concat([['ALL', 'All props']]).reduce((out, [k, n]) => {
    ['UNDER', 'OVER'].forEach(sd => { const b = CV[k + '|' + sd + '|big'], sm = CV[k + '|' + sd + '|small'];
      if (cvN(b) + cvN(sm)) out.push({ k, n: n + ' ' + sd.toLowerCase() + 's', b: cvRate(b), bn: cvN(b), s: cvRate(sm), sn: cvN(sm) }); });
    return out; }, []);
  const lift = x => x.b != null && x.s != null ? x.b - x.s : null;
  let cvTake = '';
  const cvAll = cvRows.filter(x => x.k === 'ALL'), cvMoves = cvAll.reduce((a, x) => a + x.bn + x.sn, 0);
  if (cvMoves && cvMoves < 100) cvTake = take('e', 'Early', `${cvMoves} line moves so far. This needs a few hundred moves before the gap means much.`);
  else if (cvMoves) {
    const ls = cvAll.filter(x => lift(x) != null && x.bn >= 30 && x.sn >= 30), avg = ls.length ? ls.reduce((a, x) => a + lift(x), 0) / ls.length : null;
    cvTake = avg == null ? '' : avg >= 0.05 ? take('g', 'Good sign', `On the same side, lines move toward the model <b>${Math.round(avg * 100)} points more often</b> when its edge is ${pct(bigEdgeOf())}+ than when it's small. The market is coming to the model, not just drifting.`)
      : avg > 0 ? take('w', 'Watch', `Bigger edges draw slightly more line movement than small ones on the same side (<b>+${Math.round(avg * 100)} points</b>). Most of the movement is the side's normal drift.`)
      : take('r', 'Problem', 'Bigger edges draw <b>no more</b> line movement than small ones on the same side. Any beat-the-close rate is the side\'s normal drift, not the model.');
  }
  const cvTbl = cvRows.length ? tbl(['Market + side', `Edge ${pct(bigEdgeOf())}+`, 'Small edge', 'Adds'], cvRows.map(x => { const l = lift(x);
    return `<tr class="${x.k === 'ALL' ? (x.n.endsWith('unders') ? 'tot' : 'cvall') : x.bn + x.sn < SMALL ? 'thin' : ''}"><td class="l">${x.n}</td><td>${x.b == null ? '—' : `<b>${pct(x.b)}</b> <small class="mut cvn">${x.bn}</small>`}</td><td>${x.s == null ? '—' : `${pct(x.s)} <small class="mut cvn">${x.sn}</small>`}</td><td class="${l == null ? 'mut' : l > 0.03 ? 'pos' : l < -0.03 ? 'neg' : 'mut'}">${l == null ? '—' : sgn(l * 100, 0) + ' pts'}</td></tr>`; })) : '';

  // projection accuracy
  const pjList = [['MIN', 'Minutes'], ['PTS', 'Points'], ['REB', 'Rebounds'], ['AST', 'Assists'], ['3PM', 'Threes']].filter(([k]) => P.pj[k]).map(([k, n]) => { const v = P.pj[k];
    return { k, n, c: v[0], ours: v[1] / v[0], base: v[2] ? v[3] / v[2] : null, bias: v[4] != null ? v[4] / v[0] : null }; });
  const leanTxt = x => x.bias == null ? '—' : Math.abs(x.bias) < (x.k === 'PTS' || x.k === 'MIN' ? 0.25 : 0.08) ? '<span class="mut">even</span>' : `${f1(Math.abs(x.bias))} ${x.bias > 0 ? 'high' : 'low'}`;
  let pjTake = '';
  const pPts = pjList.find(x => x.k === 'PTS');
  if (pPts && pPts.c < 100) pjTake = take('e', 'Early', `${pPts.c} player-games graded so far. Give it a few hundred.`);
  else if (pPts) {
    const worse = pjList.filter(x => x.base != null && x.ours > x.base);
    const ptsVs = pPts.base ? (pPts.ours <= pPts.base ? `<b>${pct(1 - pPts.ours / pPts.base)} closer</b> than the baseline` : `<b>${pct(pPts.ours / pPts.base - 1)} worse</b> than the baseline`) : '';
    const lean = pPts.bias != null && Math.abs(pPts.bias) >= 0.25 ? `, leaning ${f1(Math.abs(pPts.bias))} ${pPts.bias > 0 ? 'high' : 'low'}` : ', with almost no lean high or low';
    pjTake = worse.length ? take(worse.some(x => x.k === 'PTS') ? 'r' : 'w', worse.some(x => x.k === 'PTS') ? 'Problem' : 'Watch', `Points miss by <b>${f1(pPts.ours)}</b> on average${ptsVs ? ', ' + ptsVs : ''}. <b>${nameList(worse.map(x => x.n))}</b> ${worse.length === 1 ? 'is' : 'are'} doing worse than the simple baseline.`)
      : take('g', 'Good sign', `Points miss by <b>${f1(pPts.ours)}</b> on average${ptsVs ? ', ' + ptsVs : ''}${lean}.`);
  }
  const pjTbl = pjList.length ? tbl(['Stat', 'Our miss', 'Baseline', 'vs baseline', 'Leans'], pjList.map(x => `<tr><td class="l">${x.n}</td><td><b>${f1(x.ours)}</b></td><td class="${x.base == null ? 'mut' : ''}">${x.base == null ? '—' : f1(x.base)}</td>${x.base == null ? '<td class="mut">—</td>' : `<td class="${x.ours <= x.base ? 'pos' : 'neg'}">${x.ours <= x.base ? pct(1 - x.ours / x.base) + ' closer' : pct(x.ours / x.base - 1) + ' worse'}</td>`}<td>${leanTxt(x)}</td></tr>`)) : '';
  const tpS = [['player', 'PLAYER ALGO', 'p'], ['algo', 'NBA ALGO', 'a'], ['market', 'Vegas', 'gray']].filter(([k]) => P.tp[k] && P.tp[k][0]).map(([k, n, c]) => [k, n, c, P.tp[k][1] / P.tp[k][0], P.tp[k][0]]);
  const tpMax = Math.max(1, ...tpS.map(x => x[3]));
  const tpRows = tpS.sort((a, b) => a[3] - b[3]).map(([k, n, c, m, cnt]) => recBar(n, m / tpMax, null, `${f1(m)} off`, c, cnt)).join('');
  const perLabel = { season: 'the whole season', d7: 'the last 7 game days', last: 'last night (' + R.lastDay.slice(5).replace('-', '/') + ')' }[recPer];
  const card = (title, sub, body, wide) => `<div class="rcard${wide ? ' wide' : ''}"><h3>${title}</h3>${sub ? `<p class="rq">${sub}</p>` : ''}${body}</div>`;
  const foot = t => `<p class="rfoot">${t}</p>`;
  const H10 = { tbl, hb, uC, roiC, take, card, foot };
  return `<section id="record"><h2>Record</h2>
    ${trackingNote()}
    <div class="tools"><span class="seg-s" role="group" aria-label="Period">${[['season', 'Season'], ['d7', 'Last 7 days'], ['last', 'Last night']].map(([k, n]) => `<button type="button" data-recper="${k}" aria-pressed="${k === recPer}">${n}</button>`).join('')}</span><span class="muted-s">Showing ${perLabel}. Faded rows have fewer than ${SMALL} picks.</span></div>
    ${R.rp && R.rp.has ? `<div class="tools rp-tools"><span class="seg-s" role="group" aria-label="Prop edges">${[['rp', 'Today’s pricing'], ['log', 'As logged']].map(([k, n]) => `<button type="button" data-recpricing="${k}" aria-pressed="${k === recPricing}">${n}</button>`).join('')}</span><span class="muted-s">${rpOn
      ? 'Prop edges before 10/27 are recalculated on today’s pricing (25% model, 75% market, no under lean) from the projection, line and price saved at the time, so the whole season is on one scale. Results and sides never change.'
      : 'Prop edges exactly as logged. Before 10/27 they came from the old pricing and run about four times bigger, so edge groups mix two scales.'}</span></div>` : ''}
    ${hero}
    ${recRankCard(R, P, H10)}
    ${recPropsByGame(R, H10)}
    ${recWhatsHitting(P, H10)}
    ${card('Units over time', 'Running profit at 1 unit a pick, night by night, for the whole season: flagged game picks, flagged props and the top 5 props each night. Tracking only, not real bets. Season total and best/worst nights count flagged game picks plus flagged props.', unitsTake + unitsChart(series) + unitStats, true)}
    <div class="rgrid">
      ${card('Game picks by market', 'Flagged NBA ALGO picks on spreads, totals and moneylines. “Needed” is the win rate the prices required to break even (52.4% at −110).',
        ((gmTake + gmTbl) || '<p class="muted">No flagged game picks graded.</p>') + (paN ? foot(`PLAYER ALGO test picks: ${pa[0]}–${pa[1]}, ${sgn(pa[2], 2)} units (not counted above).`) : ''))}
      ${card('Props by market', 'Every graded prop without a check mark, flagged or not, at 1 unit each: a check on the model, not a betting record. “Needed” is the break-even for the prices actually taken; at these prices, playing every prop gives up about 3–4 points to the juice even when the model is neutral.', (pmTake + pmTbl) || '<p class="muted">No graded props.</p>')}
      ${card('Is the model honest?', 'When the model says a prop has a 70% chance, it should hit about 70% of the time. This checks that, grouped by what the model said.',
        calTake + calibChart(P.pc) + calTbl + (cal.length ? foot('“On target” = within 3 points. Dots on the dashed line are honest; below it the model was too sure of itself, above it not sure enough. Faded rows have fewer than 20 props.') : ''))}
      ${card('Does a bigger edge win more?', 'Edge = how far the model’s chance beats what the price needs. If the model is right, bigger edges should hit more often and make more money.',
        (ebTake + ebTbl + (ebList.length ? foot(`“${EB_NAME.chk}” = props with a check mark: an edge above ${Math.round(cap * 100)}% (usually a projection problem) or minutes well under his usual. They’re graded but never flagged, so they’re kept apart.`) : '')) || '<p class="muted">No graded props.</p>')}
      ${card('Beating the closing line', 'After we log a pick, the line keeps moving until tip. If it moves toward our side, the betting market came around to our view. Over a season, that’s the best sign an edge is real, even before the wins show up.',
        (clTake + clTbl + (clList.length ? foot('Beat % leaves out “same”. 50% is a coin flip; 55% or better over a few hundred picks is strong.') : '')) || '<p class="muted">Closing lines fill in each morning.</p>')}
      ${card('Is the market coming to the model?', 'Lines tend to drift toward one side before tip no matter what we think (lately, toward unders). The fair test: on the <i>same side</i>, does the line move our way more often when the model’s edge is big than when it’s small? That gap is what the model knows that the market doesn’t yet.',
        (cvTake + cvTbl + (cvRows.length ? foot('Each cell = share of moved lines that moved toward the model (same lines left out); the small number is how many moved. “Adds” = big-edge rate minus small-edge rate: what the model adds beyond the side’s drift.') : '')) || '<p class="muted">Closing lines fill in each morning.</p>')}
      ${card('Projection accuracy', 'How far off our numbers were for players who played, against a simple baseline: last season’s minutes × his per-minute rate, with no matchup, rotation or injury adjustments.',
        (pjTake + pjTbl + (pjList.length ? foot('“Our miss” = average distance between our number and what he did. “Leans” = whether we tend to project too high or too low. Minutes and assists have no baseline to compare against.') : '') || '<p class="muted">No graded players.</p>')
        + (tpRows ? `<h4 class="rh4">Team points: which number lands closest</h4>${tpRows}` : ''))}
    </div>
    <div class="rcard"><div class="ln-head"><h3>Last night, pick by pick</h3><button type="button" class="chip" data-recflag aria-pressed="${recFlagOnly}">${recFlagOnly ? '✓ ' : ''}Flagged only</button></div>
      <p class="muted">${R.lastDay.slice(5).replace('-', '/')}: pick a game to see every graded pick. Solid W/L = flagged, outlined = tracked. ▲ beat the closing line, ▼ worse, = same.</p>
      ${recLastList(R.last, R.games)}</div>
    ${howto}
  </section>`;
}

/* ---------- games ---------- */
function renderGame(g) {
  const A = g.algo || {}, PL = g.player || {};
  const a = A.away || {}, h = A.home || {}, pa = PL.away || {}, ph = PL.home || {};
  const vegasHomeMargin = h.spread != null ? -h.spread : null;
  const vegasAway = vegasHomeMargin != null && a.ou != null ? (a.ou - vegasHomeMargin) / 2 : null;
  const vegasHome = vegasAway != null ? a.ou - vegasAway : null;
  const sc = spreadCall(g), tc = totalCall(g), mc = mlCall(g);
  const sv = verdict(sc.algo, sc.player, c => c.team + ' ' + line(c.line));
  const tv = verdict(tc.algo, tc.player, c => c.side + ' ' + c.line);
  const sRes = sv.call ? graded(g.id, sv.cls === 'both' || sv.call === sc.algo ? 'algo' : 'player', 'SPREAD', sv.call.team) : null;
  const tRes = tv.call ? graded(g.id, tv.cls === 'both' || tv.call === tc.algo ? 'algo' : 'player', 'GAME TOTAL', tv.call.side.toUpperCase()) : null;
  let mlText = '';
  if (mc.algo && mc.player && mc.algo.team === mc.player.team) mlText = `Moneyline: <b>both models like ${esc(mc.algo.team)} ${odds(mc.algo.ml)}</b> (NBA ALGO ${pct(mc.algo.win)}, PLAYER ALGO ${pct(mc.player.win)} to win; Vegas ${pct(mc.algo.mkt)}). ${badge(graded(g.id, 'algo', 'ML', mc.algo.team))}`;
  else if (mc.algo || mc.player) { const m = mc.algo ? ['NBA ALGO', mc.algo, 'algo'] : ['PLAYER ALGO', mc.player, 'player']; mlText = `Moneyline: ${m[0]} likes <b>${esc(m[1].team)} ${odds(m[1].ml)}</b> (${pct(m[1].win)} to win vs Vegas ${pct(m[1].mkt)}). ${badge(graded(g.id, m[2], 'ML', m[1].team))}`; }
  const flags = [a.flags, h.flags].join(' ').match(/OUT \d+/g);
  const outCount = flags ? flags.map(x => +x.split(' ')[1]).reduce((s, n) => s + n, 0) : 0;
  // which model is furthest from Vegas on the margin
  const gapA = h.margin != null && vegasHomeMargin != null ? h.margin - vegasHomeMargin : null;
  const gapP = ph.margin != null && vegasHomeMargin != null ? ph.margin - vegasHomeMargin : null;
  const far = gapA == null || gapP == null ? '' : Math.abs(gapA) >= Math.abs(gapP) ? 'a' : 'p';
  const gapTxt = d => d == null ? '' : Math.abs(d) < 0.05 ? 'matches Vegas' : `${Math.abs(d).toFixed(1)} pts more on ${d > 0 ? g.home : g.away}`;
  const logged = (B.logged || {})[g.id], fin = (B.finals || {})[g.id];
  const finTxt = fin && g.away in fin && g.home in fin ? `<span class="final">Final ${esc(g.away)} ${fin[g.away]}, ${esc(g.home)} ${fin[g.home]}</span>` : '';
  const tipTxt = finTxt || (tipCT(g.tip) + (logged ? ` · logged ${ctTime(logged.at)}` : ''));
  const spreadRows = [
    { cls: 'a', diff: sc.algo ? sc.algo.diff : null, label: sc.algo ? `${sc.algo.team} ${line(sc.algo.modelLine)}` : '', prob: sc.algo ? sc.algo.cover : null },
    { cls: 'p', diff: sc.player ? sc.player.diff : null, label: sc.player ? `${sc.player.team} ${line(sc.player.modelLine)}` : '', prob: sc.player ? sc.player.cover : null },
  ];
  const totalRows = [
    { cls: 'a', diff: tc.algo ? tc.algo.diff : null, label: tc.algo ? f1(tc.algo.total) : '', prob: tc.algo ? tc.algo.prob : null },
    { cls: 'p', diff: tc.player ? tc.player.diff : null, label: tc.player ? f1(tc.player.total) : '', prob: tc.player ? tc.player.prob : null },
  ];
  return `
    ${bottomLine(g)}
    <div class="klegend"><span><i class="dot v"></i>Vegas line</span><span><i class="dot a"></i>NBA ALGO (team ratings)</span><span><i class="dot p"></i>PLAYER ALGO (built from players)</span></div>
    <div class="game-top">
      <div class="matchup">
        <table class="score">
          <thead><tr><th>Projected score</th><th>${esc(g.away)}</th><th>${esc(g.home)}</th><th>Total</th></tr></thead>
          <tbody>
            <tr class="${far === 'a' ? 'far a' : ''}"><td><i class="dot a"></i>NBA ALGO${gapA != null ? `<span class="gap">${esc(gapTxt(gapA))}</span>` : ''}</td><td class="n">${f1(a.pts)}</td><td class="n">${f1(h.pts)}</td><td class="n">${f1(a.total)}</td></tr>
            <tr class="${far === 'p' ? 'far p' : ''}"><td><i class="dot p"></i>PLAYER ALGO${gapP != null ? `<span class="gap">${esc(gapTxt(gapP))}</span>` : ''}</td><td class="n">${f1(pa.pts)}</td><td class="n">${f1(ph.pts)}</td><td class="n">${f1(pa.total)}</td></tr>
            <tr><td><i class="dot v"></i>Vegas</td><td class="n">${f1(a.tt != null ? a.tt : vegasAway)}</td><td class="n">${f1(h.tt != null ? h.tt : vegasHome)}</td><td class="n">${f1(a.ou)}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="lines">
        ${h.spread != null ? `
        <div>
          <div class="strip-head"><h3>Spread</h3><span class="verdict ${sv.cls}">${esc(sv.text)}${badge(sRes)}</span></div>
          ${strip(spreadRows, g.away + ' side', g.home + ' side', 'Vegas ' + g.home + ' ' + line(h.spread))}
        </div>
        <div>
          <div class="strip-head"><h3>Total</h3><span class="verdict ${tv.cls}">${esc(tv.text)}${badge(tRes)}</span></div>
          ${strip(totalRows, 'Under', 'Over', 'Vegas ' + String(a.ou))}
        </div>
        ${mlText ? `<p class="ml-line">${mlText}</p>` : ''}` :
        `<p class="empty">No Vegas lines for this game yet. They arrive with the morning odds pull, or you can type them on BOOK LINES.</p>`}
      </div>
    </div>`;
}

/* ---------- game page: banner, the four-way switch, one tab at a time ---------- */
const GAME_TABS = [['overview', 'Overview', 'Overview'], ['matchup', 'Matchup', 'Matchup'], ['props', 'Props', 'Props'], ['rot', 'Rotations', 'Rotations']];
const gameProps = g => (B.props || []).filter(p => p.team === g.away || p.team === g.home);
function renderGamePage(g, tab) {
  const A = g.algo || {}, a = A.away || {}, h = A.home || {};
  const fin = (B.finals || {})[g.id], logged = (B.logged || {})[g.id];
  const np = gameProps(g).length;
  const tabs = GAME_TABS.map(([k, big, small]) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${k === tab}"><span class="lg">${big}</span><span class="sm">${small}</span>${k === 'props' && np ? `<i class="ct">${np}</i>` : ''}</button>`).join('');
  const games = B.games || [];
  const sw = games.length > 1 ? `<div class="gswitch" role="group" aria-label="Other games">${games.map(x => `<button type="button" class="chip" data-go="g/${esc(x.id)}${tab !== GTAB ? '/' + tab : ''}" aria-pressed="${x.id === g.id}"><span class="sw-l">${logo(x.away)}${logo(x.home)}</span>${esc(x.away)} @ ${esc(x.home)}</button>`).join('')}</div>` : '';
  return `<div class="gp">
    <div class="gp-nav"><button type="button" class="back" data-go="">‹ All games</button>${sw}</div>
    <article class="game">
      ${banner(g, a, h, fin, logged)}
      <div class="seg-tabs" role="tablist" aria-label="Game sections">${tabs}</div>
      <div class="gp-body" id="gpBody">${gameTab(g, tab)}</div>
    </article>
  </div>`;
}
function gameTab(g, tab) {
  if (tab === 'props') {
    const ps = gameProps(g);
    if (!ps.length) return `<p class="empty pad">No prop lines for these two teams yet. They arrive with the morning odds pull.</p>`;
    return `<div class="pad">${propTable(ps, 'game')}</div>`;
  }
  if (tab === 'rot') return `<div class="detail">${rotation(g.away)}${rotation(g.home)}</div>`;
  if (tab === 'matchup') return matchupTab(g);
  return overview(g);
}

/* ---------- game Overview ---------- */
const fav = (g, M) => M == null ? '—' : Math.abs(M) < 0.05 ? 'Pick’em' : `${M > 0 ? g.home : g.away} −${Math.abs(M).toFixed(1).replace(/\.0$/, '')}`;
const byTxt = (g, M) => M == null ? '—' : Math.abs(M) < 0.05 ? 'a tie' : `${M > 0 ? g.home : g.away} by ${Math.abs(M).toFixed(1)}`;
function overview(g) {
  const A = g.algo || {}, PL = g.player || {}, a = A.away || {}, h = A.home || {}, pa = PL.away || {}, ph = PL.home || {};
  const calls = gameCalls(g), live = calls.filter(c => !c.pass);
  const vm = h.spread != null ? -h.spread : null;
  const read = readBlock(g, a, h, pa, ph, vm, live);
  const main = marketCards(g, calls, ['spread', 'ml', 'total']).join('');
  // team totals and 1st half: cards with a lean show; the passes fold away
  const extra = marketCards(g, calls, ['tt-away', 'tt-home', 'h1spread', 'h1total']);
  const live2 = extra.filter(c => !/class="mcard (pass|split)"/.test(c)), quiet = extra.filter(c => /class="mcard (pass|split)"/.test(c));
  const names = quiet.map(c => (c.match(/<h4>([^<]*)<\/h4>/) || [])[1]).filter(Boolean);
  const more = !extra.length ? '' : `${live2.length ? `<div class="mk-grid">${live2.join('')}</div>` : ''}${quiet.length ? `<details class="mk-more"${live2.length ? '' : ' open'}><summary>${live2.length ? `${quiet.length} more with no lean: ${names.join(', ')}` : `No lean on these: ${names.join(', ')}`}</summary><div class="mk-grid">${quiet.join('')}</div></details>` : ''}`;
  return `<div class="ov">
    ${read}
    <h3 class="ov-h">Game lines</h3>
    ${main ? `<div class="mk-grid">${main}</div>` : `<p class="empty">No Vegas lines for this game yet. They arrive with the morning odds pull, or you can type them on BOOK LINES.</p>`}
    ${more ? `<h3 class="ov-h">Team totals & 1st half</h3>${more}` : ''}
    <p class="mk-key"><span><i class="lk v"></i>Vegas</span><span><i class="dot a"></i>NBA ALGO (team ratings)</span><span><i class="dot p"></i>PLAYER ALGO (built from players)</span><span>Each dot is where that model sets the number; the farther from the Vegas mark, the bigger the disagreement.</span></p>
    ${bestProps(g)}
    ${watchList(g)}
  </div>`;
}

/* The read: three verdict tiles (who wins, the total, what both models flag), team injury cards, and a projected-score
   scoreboard. Flag chips scroll to their game-line card. */
const byWord = (g, M) => M == null ? '—' : Math.abs(M) < 0.05 ? 'a tie' : `${M > 0 ? g.home : g.away} by ${Math.abs(M).toFixed(1)}`;
function readBlock(g, a, h, pa, ph, vm, live) {
  const mA = h.margin, mP = ph.margin, tA = a.total, tP = pa.total, ou = a.ou;
  const sideOf = m => m == null ? 0 : m > 0.05 ? 1 : m < -0.05 ? -1 : 0;
  const sa = sideOf(mA), sp = sideOf(mP);
  const winBig = mA == null && mP == null ? '—' : sa && sa === sp ? (sa > 0 ? g.home : g.away) : sa === 0 && sp === 0 ? 'Toss-up' : 'Split';
  const winSub = sa && sa === sp ? 'both models' : 'models disagree';
  const tside = t => t == null || ou == null ? 0 : t > ou ? 1 : t < ou ? -1 : 0;
  const ta = tside(tA), tp = tside(tP);
  const totBig = ou == null ? '—' : ta && ta === tp ? (ta > 0 ? 'Over' : 'Under') : 'Split';
  const row = (cls, txt) => `<span class="rd-l"><i class="${cls === 'v' ? 'lk v' : 'dot ' + cls}"></i>${txt}</span>`;
  const both = live.filter(c => c.both), one = live.filter(c => !c.both);
  const kid = c => 'mk-' + (c.kind === 'tt' ? 'tt-' + c.where : c.kind);
  const chip = c => `<button type="button" class="rd-chip${c.both ? '' : ' one'}" data-mkgo="${esc(kid(c))}"><em>${esc(KIND_SHORT[c.kind])}</em>${esc(c.bet)}${c.both ? '' : `<small>${c.model === 'NBA ALGO' ? 'NBA' : 'PLAYER'}</small>`}</button>`;
  const tiles = `<div class="rd-tiles">
      <div class="rd-tile"><small>Who wins</small><b>${esc(winBig)}</b><em>${esc(winSub)}</em>${row('a', 'NBA: ' + esc(byWord(g, mA)))}${row('p', 'PLAYER: ' + esc(byWord(g, mP)))}${vm != null ? row('v', 'Vegas: ' + esc(byWord(g, vm))) : ''}</div>
      <div class="rd-tile"><small>Total vs Vegas</small><b>${esc(totBig)}</b><em>${ou != null ? 'Vegas ' + esc(ou) : 'no line yet'}</em>${row('a', 'NBA: ' + f1(tA))}${row('p', 'PLAYER: ' + f1(tP))}${ou != null ? row('v', 'Vegas: ' + esc(ou)) : ''}</div>
      <div class="rd-tile fl${both.length ? '' : ' none'}"><small>Both models flag</small><b>${both.length ? both.length + (both.length === 1 ? ' pick' : ' picks') : 'Nothing'}</b><em>${both.length ? 'tap one for its card' : `nothing clears ${pct(P().flag)} with both`}</em>${one.length ? `<span class="rd-l">+ ${one.length} from one model only</span>` : ''}</div>
    </div>`;
  const chips = live.length ? `<div class="rd-chips">${both.map(chip).join('')}${one.map(chip).join('')}</div>` : '';
  // injuries by team, plus the other notes (stacked roster, back-to-back)
  const notes = [];
  const inj = [g.away, g.home].map(code => {
    const ps = (B.players || []).filter(p => p.team === code);
    const out = ps.filter(p => /Out/.test(p.status)).map(p => p.name), iffy = ps.filter(p => /Questionable|Doubtful/.test(p.status));
    const pool = (B.pool || {})[code];
    if (pool && pool.factor != null && pool.factor <= 0.92) notes.push(`<b>${esc(code)}</b> stacked roster: PLAYER ALGO trims each player ${Math.round((1 - pool.factor) * 100)}%`);
    const m = code === g.away ? a : h, rest = m.rest === 'OPENER' || m.rest === '' || m.rest == null ? null : Number(m.rest);
    if (rest === 0) notes.push(`<b>${esc(code)}</b> on a back-to-back`);
    const cnt = [out.length ? out.length + ' out' : '', iffy.length ? iffy.length + ' questionable' : ''].filter(Boolean).join(' · ') || 'nobody listed';
    return `<div class="rd-inj"><div class="rd-ih" style="background:${esc(tcolor(code))}"><span class="rd-il">${bgLogo(code)}</span>${esc(code)}<small>${esc(cnt)}</small></div>
      ${out.length ? `<div class="rd-ir"><span class="o">OUT</span>${esc(out.join(', '))}</div>` : ''}
      ${iffy.length ? `<div class="rd-ir"><span class="q">${iffy.some(p => /Doubtful/.test(p.status)) && !iffy.some(p => /Questionable/.test(p.status)) ? 'D' : 'Q'}</span>${iffy.map(p => esc(p.name) + (/Doubtful/.test(p.status) ? ' (doubtful)' : '')).join(', ')}</div>` : ''}
      ${!out.length && !iffy.length ? '<div class="rd-ir none">No one out or questionable</div>' : ''}</div>`;
  }).join('');
  // projected score: team-colour headers, each row's leader dark, margin under the source, the total in its own column
  const vA = a.tt != null ? a.tt : (vm != null && ou != null ? (ou - vm) / 2 : null), vH = h.tt != null ? h.tt : (vA != null && ou != null ? ou - vA : null);
  const srow = (cls, name, x, y, marg) => { const lead = x != null && y != null ? (x > y ? 'a' : y > x ? 'h' : '') : '';
    const mm = marg !== undefined ? marg : x != null && y != null ? y - x : null;   // Vegas: the spread says who's favoured, not the two team totals
    return `<div class="sb-r"><span class="sb-n"><span><i class="${cls === 'v' ? 'lk v' : 'dot ' + cls}"></i>${name}</span><small>${mm != null ? esc(byWord(g, mm)) : '—'}</small></span><b class="${lead === 'a' ? 'w' : ''}">${f1(x)}</b><b class="${lead === 'h' ? 'w' : ''}">${f1(y)}</b><b class="t">${x != null && y != null ? f1(x + y) : '—'}</b></div>`; };
  const board = `<div class="sb"><div class="sb-h"><span>Projected</span><span class="tm" style="background:${esc(tcolor(g.away))}">${bgLogo(g.away)}${esc(g.away)}</span><span class="tm" style="background:${esc(tcolor(g.home))}">${bgLogo(g.home)}${esc(g.home)}</span><span class="tt">Total</span></div>
    ${srow('a', 'NBA ALGO', a.pts, h.pts)}${srow('p', 'PLAYER ALGO', pa.pts, ph.pts)}${srow('v', 'Vegas', vA, vH, vm != null ? vm : undefined)}</div>`;
  return `<div class="read rd">
    <div class="rd-main"><h3>The read</h3>${tiles}${chips}<div class="rd-injs">${inj}</div>${notes.length ? `<div class="rd-notes">${notes.map(n => `<span>${n}</span>`).join('')}</div>` : ''}</div>
    ${board}
  </div>`;
}

// a number line centred on the Vegas number, one lane per model
function numLine(center, pts, leftLab, rightLab, tickFmt) {
  const vals = pts.filter(x => x.v != null);
  const far = Math.max(1.5, ...vals.map(x => Math.abs(x.v - center)));
  const raw = far * 1.35, steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25];
  const step = steps.find(st => raw / st <= 3) || 25, half = Math.ceil(raw / step) * step;
  const lo = center - half, hi = center + half, X = v => ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo) * 100).toFixed(2) + '%';
  const ticks = []; for (let t = Math.ceil(lo / step) * step; t <= hi + 1e-9; t += step) ticks.push(Math.round(t * 100) / 100);
  const lane = (x, i) => { if (x.v == null) return ''; const l = Math.min(x.v, center), r = Math.max(x.v, center);
    return `<span class="np-bar ${x.cls}" style="top:${i ? 62 : 30}%;left:${X(l)};width:calc(${X(r)} - ${X(l)})"></span><span class="np-dot ${x.cls}" style="top:${i ? 62 : 30}%;left:${X(x.v)}"></span>`; };
  return `<div class="np" aria-hidden="true">
      ${ticks.map(t => `<span class="np-t" style="left:${X(t)}"><em>${esc(tickFmt(t))}</em></span>`).join('')}
      <span class="np-v" style="left:${X(center)}"></span>${pts.map(lane).join('')}
    </div><div class="np-ends"><span>← ${esc(leftLab)}</span><span>${esc(rightLab)} →</span></div>`;
}
function mkCard(title, c, np, head, rows) {   // verdict first: the call and its edge dial, then who sets the number where, then the number line
  const trk = TR().lines;
  const state = !c ? 'pass' : c.pass ? 'split' : c.both ? 'both' : 'one';
  const chip = { both: trk ? 'Both models · tracking' : 'Both models', one: 'One model', split: 'Models split', pass: 'Pass' }[state];
  const live = state === 'both' || state === 'one';
  let verdict;
  if (live) {
    const { pr, edge, be } = callNums(c);
    const what = c.kind === 'ml' ? 'to win' : /spread/.test(c.kind) ? 'to cover' : 'chance';
    const who = c.both ? (trk ? 'Both models like' : 'Both models: bet') : `${esc(c.model)} ${trk ? 'likes' : 'leans'}`;
    verdict = `<div class="mv"><span><small>${who}</small><b>${esc(c.bet)}</b><em>${pr.map(x => pct(x[1])).join(' · ')} ${what}${be != null ? ` · break-even ${pct(be)}` : ''}</em></span>${edgeDial(edge, 'How far the lower model clears break-even')}</div>`;
  } else verdict = `<div class="mv pass"><span><small>${state === 'split' ? 'Models split' : 'No lean'}</small><b>Pass</b><em>${state === 'split' ? 'One model flags it, the other leans the other way.' : 'Neither model is far enough from Vegas.'}</em></span></div>`;
  const tile = r => `<div class="mw ${r[0]}${r[4] ? ' fl' : ''}"><small>${r[1]}</small><b>${r[2]}</b>${r[0] === 'v' ? `<span>${esc(head[0])}</span>` : `<span>${r[3] ? 'takes ' + r[3] : 'no take'}</span>`}</div>`;
  const foot = live ? `<div class="mk-f"><span>${trk ? 'would bet to' : 'bet to'} <b>${esc(c.prices[0])}</b></span><span>lean to <b>${esc(c.prices[1])}</b></span>${badge(c.result)}</div>` : '';
  return `<div class="mcard ${state}">
    <div class="mk-h"><h4>${esc(title)}</h4><span class="mk-chip ${state}">${chip}</span></div>
    ${verdict}
    <div class="mwho">${rows.map(tile).join('')}</div>
    ${np}
    ${foot}
  </div>`;
}
function marketCards(g, calls, kinds) {
  const A = g.algo || {}, PL = g.player || {}, a = A.away || {}, h = A.home || {}, pa = PL.away || {}, ph = PL.home || {};
  const find = (kind, where) => calls.find(x => x.kind === kind && (!where || x.where === where));
  const take = (c, txt) => c ? `${txt}` : '';
  const flagOf = c => c && c.flagged;
  const out = [];
  const push0 = out.push.bind(out);
  kinds.forEach(k => {
    out.push = html => push0(html.replace('<div class="mcard ', `<div id="mk-${k === 'total' ? 'total' : k}" class="mcard `));
    if (k === 'spread' && h.spread != null) {
      const vm = -h.spread, sc = spreadCall(g);
      const tk = c => c ? `${esc(c.team)} ${esc(line(c.line))} <small>${pct(c.cover)}</small>` : '';
      out.push(mkCard('Spread', find('spread'), numLine(vm, [{ cls: 'a', v: h.margin }, { cls: 'p', v: ph.margin }], g.away + ' side', g.home + ' side', t => t === 0 ? 'even' : (t > 0 ? g.home : g.away) + ' ' + Math.abs(t)),
        ['Their line', 'Takes · chance to cover'],
        [['v', 'Vegas', esc(fav(g, vm)), ''], ['a', 'NBA ALGO', esc(fav(g, h.margin)), tk(sc.algo), flagOf(sc.algo)], ['p', 'PLAYER ALGO', esc(fav(g, ph.margin)), tk(sc.player), flagOf(sc.player)]]));
    }
    if (k === 'ml' && h.mkt != null && h.win != null) {
      const tk = (H, W) => { if (!H || H.win == null || H.mkt == null) return ''; const home = H.win - H.mkt >= (W.win != null && W.mkt != null ? W.win - W.mkt : -9); const S = home ? H : W; return `${esc(S.team)} ${esc(odds(S.ml))} <small>${pct(S.win)}</small>`; };
      const mc = mlCall(g);
      out.push(mkCard('Moneyline', find('ml'), numLine(h.mkt * 100, [{ cls: 'a', v: h.win * 100 }, { cls: 'p', v: ph.win != null ? ph.win * 100 : null }], g.away + ' more likely', g.home + ' more likely', t => Math.round(t) + '%'),
        [g.home + ' wins', 'Best value · chance to win'],
        [['v', 'Vegas <small>(no vig)</small>', pct(h.mkt), ''], ['a', 'NBA ALGO', pct(h.win), tk(h, a), !!mc.algo], ['p', 'PLAYER ALGO', pct(ph.win), tk(ph, pa), !!mc.player]]));
    }
    if (k === 'total' && a.ou != null) {
      const tc = totalCall(g), tk = c => c ? `${c.side} ${esc(c.line)} <small>${pct(c.prob)}</small>` : '';
      out.push(mkCard('Game total', find('total'), numLine(a.ou, [{ cls: 'a', v: a.total }, { cls: 'p', v: pa.total }], 'Under', 'Over', t => String(t)),
        ['Their total', 'Takes · chance'],
        [['v', 'Vegas', esc(a.ou), ''], ['a', 'NBA ALGO', f1(a.total), tk(tc.algo), flagOf(tc.algo)], ['p', 'PLAYER ALGO', f1(pa.total), tk(tc.player), flagOf(tc.player)]]));
    }
    if (/^tt-/.test(k)) {
      const where = k.slice(3), m = A[where] || {}, pm = PL[where] || {};
      if (m.tt == null) return;
      const cc = ttCall(g, where), tk = c => c ? `${c.side} ${esc(c.line)} <small>${pct(c.prob)}</small>` : '';
      out.push(mkCard(`${m.team || (where === 'away' ? g.away : g.home)} team total`, find('tt', where), numLine(m.tt, [{ cls: 'a', v: m.pts }, { cls: 'p', v: pm.pts }], 'Under', 'Over', t => String(t)),
        ['Their points', 'Takes · chance'],
        [['v', 'Vegas', esc(m.tt), ''], ['a', 'NBA ALGO', f1(m.pts), tk(cc.algo), flagOf(cc.algo)], ['p', 'PLAYER ALGO', f1(pm.pts), tk(cc.player), flagOf(cc.player)]]));
    }
    if (k === 'h1spread' && h.h1sp != null) {
      const vm = -h.h1sp, hs = h1SpreadCall(g);
      const mm = m => m && m.h1ats != null && m.h1sp != null ? m.h1ats - m.h1sp : null;
      const tk = c => c ? `${esc(c.team)} ${esc(line(c.line))} <small>${pct(c.cover)}</small>` : '';
      out.push(mkCard('1st half spread', find('h1spread'), numLine(vm, [{ cls: 'a', v: mm(h) }, { cls: 'p', v: mm(ph) }], g.away + ' side', g.home + ' side', t => t === 0 ? 'even' : (t > 0 ? g.home : g.away) + ' ' + Math.abs(t)),
        ['Their line', 'Takes · chance to cover'],
        [['v', 'Vegas', esc(fav(g, vm)), ''], ['a', 'NBA ALGO', esc(fav(g, mm(h))), tk(hs.algo), flagOf(hs.algo)], ['p', 'PLAYER ALGO', esc(fav(g, mm(ph))), tk(hs.player), flagOf(hs.player)]]));
    }
    if (k === 'h1total' && a.h1ou != null) {
      const ht = h1TotalCall(g), tk = c => c ? `${c.side} ${esc(c.line)} <small>${pct(c.prob)}</small>` : '';
      const mt = m => m && m.h1ouDiff != null ? a.h1ou + m.h1ouDiff : null;
      out.push(mkCard('1st half total', find('h1total'), numLine(a.h1ou, [{ cls: 'a', v: mt(a) }, { cls: 'p', v: mt(pa) }], 'Under', 'Over', t => String(t)),
        ['Their total', 'Takes · chance'],
        [['v', 'Vegas', esc(a.h1ou), ''], ['a', 'NBA ALGO', f1(mt(a)), tk(ht.algo), flagOf(ht.algo)], ['p', 'PLAYER ALGO', f1(mt(pa)), tk(ht.player), flagOf(ht.player)]]));
    }
  });
  return out;
}
// the game's five best prop edges (guarded ones left out)
function bestProps(g) {
  const ps = gameProps(g).filter(p => !p.guard && p.edge != null).sort((x, y) => y.edge - x.edge).slice(0, 5);
  if (!ps.length) return '';
  const n = gameProps(g).length;
  return `<div class="ov-sec"><div class="ov-hrow"><h3 class="ov-h">Best props in this game</h3><button type="button" class="link" data-tab="props">All ${n} props ›</button></div>
    <div class="pboard">${ps.map((p, i) => propRow(p, i + 1)).join('')}</div></div>`;
}
// top projected players on each side
function watchList(g) {
  // after the final: the same players, with what they actually did (big) over what we projected (small)
  const fin = (B.finals || {})[g.id], final = !!(fin && g.away in fin && g.home in fin);
  const actOf = p => (p.log || []).find(l => l.gid ? l.gid === g.id : l.date === B.date) || null;
  const tone = (a, pj, close) => a == null || pj == null ? '' : a - pj >= close ? 'hi' : pj - a >= close ? 'lo' : '';
  const mu = (p, k) => { const m = posMult(p, k); if (m == null || final) return ''; return m >= 1.015 ? '<i class="mu up">▲</i>' : m <= 0.985 ? '<i class="mu dn">▼</i>' : ''; };
  const col = code => {
    const ps = (B.players || []).filter(p => p.team === code && p.expMin > 0).sort((x, y) => (y.pts || 0) - (x.pts || 0)).slice(0, 4);
    if (!ps.length) return '';
    return `<div class="wl"><h4 style="background:${esc(tcolor(code))}"><span class="wl-lg">${bgLogo(code)}</span>${esc(team(code).name || code)}</h4>${ps.map(p => {
      const pr = bestPropOf(p);
      const a = final ? actOf(p) : null, dnp = final && !a;
      const stat = (k, K, lab, close) => final
        ? `<span class="pr-st"><b class="${dnp ? '' : tone(a[k], p[k], close)}">${dnp ? '–' : Math.round(a[k])}</b><small>${lab} · ${f1(p[k])}</small></span>`
        : `<span class="pr-st"><b>${f1(p[k])}</b><small>${lab}${mu(p, K)}</small></span>`;
      const tag = pr ? `${esc(pr.side === 'Over' ? 'O' : 'U')} ${esc(pr.line)} ${esc(pr.market)}${final && pr.actual !== '' && pr.actual != null ? ' · ' + esc(pr.actual) : ''}` : '';
      const minTxt = final ? (dnp ? `DNP · proj ${f1(p.expMin)} min` : `${Math.round(a.min)} min · proj ${f1(p.expMin)}`) : `${f1(p.expMin)} min`;
      return `<button type="button" class="wl-row pl${final ? ' fin' : ''}" data-pid="${esc(p.id)}"${pr ? ` data-mkt="${esc(pr.market)}"` : ''} style="--tc:${esc(tcolor(p.team))}">${hsDot(p, 'sm')}
        <span class="wl-n"><b>${esc(p.name)}</b><small>${minTxt}${showStatus(p.status) ? ' · ' + esc(p.status) : ''}</small></span>
        ${stat('pts', 'PTS', 'pts', 4)}${stat('reb', 'REB', 'reb', 2)}${stat('ast', 'AST', 'ast', 2)}
        ${pr ? `<span class="wl-p${pr.flagged ? ' fl' : ''}"><i>best prop</i>${tag}${final ? badge(propRes(pr)) : ''}</span>` : ''}</button>`;
    }).join('')}</div>`;
  };
  return final
    ? `<div class="ov-sec"><h3 class="ov-h">How they did</h3><p class="sub">The same players we picked to watch. Big number = what he did, small = what we projected. <span class="hi">Green</span> beat the projection, <span class="lo">red</span> fell short. The tag is his best prop edge and how it went.</p><div class="wl-grid">${col(g.away)}${col(g.home)}</div></div>`
    : `<div class="ov-sec"><h3 class="ov-h">Players to watch</h3><p class="sub">Top projected scorers. <span class="mu up">▲</span> / <span class="mu dn">▼</span> under a stat: an easier / tougher matchup for his position (already in the number). Tap a player for his card.</p><div class="wl-grid">${col(g.away)}${col(g.home)}</div></div>`;
}

/* ---------- team profiles: matchup tab, Teams screen, position defense ----------
   B.teamStats = { season, cur, teams: {BOS: {off: {L5:{…}, L10:{…}, SZN:{…}, gp}, def: {…}}}, dvp: {BOS: {G:{PTS,REB,AST,'3PM'}, F, C}} }
   Last season until the typical team has 3+ games this season; the server makes that call for every team at once. */
const TS = () => B.teamStats || null;
const TSTAT = [
  { k: 'pts', name: 'Points', d: 1, dec: 1 }, { k: 'reb', name: 'Rebounds', d: 1, dec: 1 }, { k: 'ast', name: 'Assists', d: 1, dec: 1 },
  { k: 'tpm', name: 'Threes made', short: '3PM', d: 1, dec: 1 }, { k: 'fg', name: 'FG%', d: 1, pct: true }, { k: 'tp', name: '3P%', d: 1, pct: true },
  { k: 'oreb', name: 'Off. rebounds', short: 'OREB', d: 1, dec: 1 }, { k: 'tov', name: 'Turnovers', short: 'TOV', d: -1, dec: 1 } ];
const W_NAME = { L3: 'Last 3', L5: 'Last 5', L10: 'Last 10', SZN: 'Season' };
let teamWin = 'SZN', teamSide = 'off', teamSort = 'pts', teamOpen = '', teamDir = 'desc';
const seasonLabel = () => { const t = TS(); return !t ? '' : t.cur ? `${t.season} season` : 'last season (2025–26)'; };
// windows with real data for most stats (last season's tabs only split points by last 10)
function teamWindows() {
  const t = TS(); if (!t) return ['SZN'];
  const any = Object.values(t.teams)[0] || {};
  return ['L5', 'L10', 'SZN'].filter(w => any.off && any.off[w] && Object.keys(any.off[w]).filter(k => any.off[w][k] != null).length >= 4);
}
// value for a team, side ('off' | 'def'), window, stat; falls back to the season number when the window lacks that stat
function tval(code, side, w, k) {
  const s = ((TS() || {}).teams || {})[code]; const o = s && s[side];
  if (!o) return { v: null };
  if (o[w] && o[w][k] != null) return { v: o[w][k] };
  return o.SZN && o.SZN[k] != null ? { v: o.SZN[k], fb: w !== 'SZN' } : { v: null };
}
function leagueAvg(side, w, k) {
  const vals = Object.keys((TS() || {}).teams || {}).map(c => tval(c, side, w, k).v).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
// rank 1 = best: offense high (low for turnovers); defense = allows least (forces most turnovers)
function trank(code, side, w, stat) {
  const me = tval(code, side, w, stat.k).v; if (me == null) return null;
  const better = side === 'off' ? stat.d : -stat.d;
  return 1 + Object.keys(TS().teams).filter(c => { const v = tval(c, side, w, stat.k).v; return v != null && (better > 0 ? v > me : v < me); }).length;
}
const fmtT = (stat, v) => v == null ? '—' : stat.pct ? (v * 100).toFixed(1) + '%' : v.toFixed(stat.dec);
const ordn = n => n == null ? '' : n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
const winSwitch = (attr) => { const ws = teamWindows(); return ws.length > 1 ? `<span class="seg-s" role="group" aria-label="Window">${ws.map(w => `<button type="button" ${attr}="${w}" aria-pressed="${w === teamWin}">${W_NAME[w]}</button>`).join('')}</span>` : ''; };

/* game page › Matchup tab: each offense against the other defense, in plain columns with one edge meter per stat */
const NOUN = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', fg: 'FG%', tp: '3-point %', oreb: 'offensive rebounds', tov: 'turnovers' };
function edgeOf(O, D, st) {
  const o = tval(O, 'off', teamWin, st.k), d = tval(D, 'def', teamWin, st.k), lg = leagueAvg('off', teamWin, st.k), lgD = leagueAvg('def', teamWin, st.k);
  if (o.v == null || d.v == null || !lg || !lgD) return null;
  const est = o.v + d.v - lgD;                 // the offense's number moved by how far this defense sits from average
  return { O, D, st, o, d, lg, est, e: (est / lg - 1) * st.d, ro: trank(O, 'off', teamWin, st), rd: trank(D, 'def', teamWin, st) };
}
const EVEN = 0.02, FULL = 0.12;
function edgeMeter(x) {
  const off = x.e > 0, w = Math.min(1, Math.abs(x.e) / FULL) * 50, even = Math.abs(x.e) < EVEN;
  const who = even ? 'Even' : off ? `${x.O} offense` : `${x.D} defense`;
  return `<span class="em" title="${esc(who)}: about ${fmtT(x.st, x.est)} expected vs league ${fmtT(x.st, x.lg)}">
      <span class="em-track"><span class="em-fill ${off ? 'r' : 'l'}" style="${off ? 'left' : 'right'}:50%;width:${even ? 0 : w}%;background:${esc(tcolor(off ? x.O : x.D))}"></span><span class="em-mid"></span></span>
      <span class="em-lab ${even ? 'even' : ''}">${even ? 'Even' : `<b>${esc(off ? x.O : x.D)}</b> ${off ? 'O' : 'D'} +${Math.round(Math.abs(x.e) * 100)}%`}</span></span>`;
}
// one sentence about a big edge, in plain words (ranks: 1st = best in the league)
function edgeSentence(x) {
  const n = NOUN[x.st.k], cap = n.charAt(0).toUpperCase() + n.slice(1);
  const winner = x.e > 0 ? `${x.O} offense` : `${x.D} defense`;
  return `<li><span class="ke-who" style="--c:${esc(tcolor(x.e > 0 ? x.O : x.D))}">${esc(winner)}</span><span><b>${esc(cap)}:</b> ${esc(x.O)}'s offense ranks ${ordn(x.ro)} in the league, ${esc(x.D)}'s defense ranks ${ordn(x.rd)}. Expect about ${fmtT(x.st, x.est)} (league average ${fmtT(x.st, x.lg)}).</span></li>`;
}
function matchupTab(g) {
  if (!TS() || !TS().teams[g.away] || !TS().teams[g.home]) return `<p class="empty pad">Team profiles aren't loaded yet. They come from NBA OFFENSE, NBA DEFENSE and the live moving averages.</p>`;
  if (!teamWindows().includes(teamWin)) teamWin = 'SZN';
  const sides = [[g.away, g.home], [g.home, g.away]].map(([O, D]) => ({ O, D, rows: TSTAT.map(st => edgeOf(O, D, st)).filter(Boolean) }));
  const big = sides.flatMap(s => s.rows).filter(x => Math.abs(x.e) >= 0.03).sort((a, b) => Math.abs(b.e) - Math.abs(a.e)).slice(0, 3);
  const anyFb = sides.some(s => s.rows.some(x => x.o.fb || x.d.fb));
  const panel = s => `<div class="hh">
      <h4>${logo(s.O)}${esc(s.O)} offense <span class="vs">vs</span> ${esc(s.D)} defense</h4>
      <div class="hh-row hh-headrow"><span></span><span>${esc(s.O)} gets</span><span>${esc(s.D)} allows</span><span>Edge</span></div>
      ${s.rows.map(x => `<div class="hh-row">
        <span class="hh-stat">${esc(x.st.name)}</span>
        <span class="hh-v"><b>${fmtT(x.st, x.o.v)}${x.o.fb ? '*' : ''}</b><small>${ordn(x.ro)} of 30</small></span>
        <span class="hh-v"><b>${fmtT(x.st, x.d.v)}${x.d.fb ? '*' : ''}</b><small>${ordn(x.rd)} of 30</small></span>
        ${edgeMeter(x)}</div>`).join('')}
    </div>`;
  return `<div class="ov">
    <div class="ov-hrow"><h3 class="ov-h">How they match up</h3><span class="ov-ctl"><small>Stats over</small>${winSwitch('data-twin')}</span></div>
    <p class="sub">Each team's offense against the other team's defense, per game, ${esc(seasonLabel())}. A rank of 1st is the best in the league: the most points scored, or the fewest allowed.</p>
    ${big.length ? `<div class="keyedges"><h4>Biggest edges</h4><ul>${big.map(edgeSentence).join('')}</ul></div>` : `<div class="keyedges"><h4>Biggest edges</h4><p class="muted">No stat where either side is more than 3% better than average. An evenly matched game on paper.</p></div>`}
    <div class="tt-grid">${sides.map(panel).join('')}</div>
    <p class="mk-key em-key"><span class="em em-demo"><span class="em-track"><span class="em-fill l" style="right:50%;width:30%;background:var(--ink-3)"></span><span class="em-mid"></span><span class="em-fill r" style="left:50%;width:18%;background:var(--ink-2)"></span></span></span><span>The bar grows toward whoever has the edge: left for the defense, right for the offense. Full length = 12% better than league average. Hover or tap a bar for the expected number.${anyFb ? ' * = season figure (last season\'s tabs only split points by recent games).' : ''}</span></p>
    <h3 class="ov-h">Who they face by position</h3>
    <p class="sub">How each defense has done against guards, forwards and centers (${DVP_WHEN}), compared with league average. <span class="dvchip soft">+8%</span> means it gave up 8% more than average to that position, which is good for the scorer; <span class="dvchip tough">−8%</span> means 8% less.</p>
    <div class="pm-grid">${posMatch(g.away, g.home)}${posMatch(g.home, g.away)}</div>
  </div>`;
}
// one defense's position profile, with the attacking players at each position
function dvpGrid(D, attackers) {
  const dv = ((TS() || {}).dvp || {})[D]; if (!dv) return '<p class="muted">No position data.</p>';
  const cell = f => { if (f == null) return '<td>—</td>'; const p = Math.round((f - 1) * 100), cls = p >= 4 ? 'soft' : p <= -4 ? 'tough' : '';
    return `<td class="dv ${cls}">${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%</td>`; };
  return `<table class="dvp"><thead><tr><th></th><th>PTS</th><th>REB</th><th>AST</th><th>3PM</th>${attackers ? '<th class="hide-sm">Faces tonight</th>' : ''}</tr></thead><tbody>
    ${[['G', 'Guards'], ['F', 'Forwards'], ['C', 'Centers']].map(([pos, nm]) => `<tr><th>${nm}</th>${['PTS', 'REB', 'AST', '3PM'].map(s => cell(dv[pos] && dv[pos][s])).join('')}
      ${attackers ? `<td class="faces hide-sm">${attackers.filter(p => String(p.pos || '').charAt(0) === pos).slice(0, 3).map(p => plBtn(p, p.name.split(' ').slice(-1)[0])).join(', ') || '—'}</td>` : ''}</tr>`).join('')}
  </tbody></table>`;
}
function posMatch(O, D) {
  const att = (B.players || []).filter(p => p.team === O && p.expMin > 0).sort((a, b) => (b.pts || 0) - (a.pts || 0));
  const pos = { G: [], F: [], C: [] }; att.forEach(p => { const k = String(p.pos || '').charAt(0); if (pos[k]) pos[k].push(p); });
  return `<div class="pm"><h4>${logo(O)}${esc(O)} vs ${esc(D)}'s defense</h4>${dvpGrid(D, att)}
    <p class="pm-ph">${['G', 'F', 'C'].map(k => pos[k].length ? `<span><b>${k}</b> ${pos[k].slice(0, 3).map(p => plBtn(p, p.name.split(' ').slice(-1)[0])).join(', ')}</span>` : '').join('')}</p></div>`;
}

/* Teams screen: offense, defense or position defense; every column sorts both ways; shaded by percentile like the sheet tabs */
const POSCOLS = ['G', 'F', 'C'].flatMap(p => ['PTS', 'REB', 'AST', '3PM'].map(s => ({ k: p + '|' + s, pos: p, s, name: s })));
const posVal = (c, key) => { const [p, s] = key.split('|'), d = (((TS() || {}).dvp || {})[c] || {})[p]; return d && d[s] != null ? (d[s] - 1) * 100 : null; };
/* position matchups for today's players. The model already applies these: ROTATION ENGINE multiplies each player's share by
   1 + strength × (DEF VS POSITION factor − 1), so the board shows his projection as-is and only says how much of it the matchup is worth. */
const POSN = { G: 'guards', F: 'forwards', C: 'centers' }, SNAME = { PTS: 'points', REB: 'rebounds', AST: 'assists', '3PM': 'threes' };
let posCell = '', posToday = true, bestStat = 'ALL', bestSide = 'help', bestSort = 'mu', bestDir = 'desc';
function posMult(p, s) {   // the multiplier the model used for this player and stat tonight
  if (p.pa && p.pa[s] != null) return p.pa[s];
  const d = (((TS() || {}).dvp || {})[p.opp] || {})[String(p.pos || '').charAt(0)];
  return d && d[s] != null ? 1 + 0.5 * (d[s] - 1) : null;   // older server: the sheet's default strength (0.5)
}
function posRow(p, s) {
  const pos = String(p.pos || '').charAt(0), d = (((TS() || {}).dvp || {})[p.opp] || {})[pos];
  const proj = ifPlays(p, s), m = posMult(p, s), pr = propFor(p, s);
  if (!d || d[s] == null || proj == null || !(p.expMin > 0)) return null;
  return { p, s, pos, mu: (d[s] - 1) * 100, proj, bump: m ? proj - proj / m : null, line: pr ? pr.line : null, vsl: pr && pr.line != null ? proj - pr.line : null };
}
const sgnP = (v, dec) => { if (v == null) return '—'; const d = dec == null ? 1 : dec, r = +v.toFixed(d); return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r).toFixed(d)}`; };
const muChip = v => `<span class="dvchip ${v >= 3 ? 'soft' : v <= -3 ? 'tough' : ''}">${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}${Math.abs(Math.round(v))}%</span>`;
const vslChip = v => v == null ? '<span class="muted-s">—</span>' : `<span class="dvchip ${v >= 0 ? 'soft' : 'tough'}">${sgnP(v)}</span>`;
function plRows(rows, withMatch) {
  return rows.map(x => `<tr><td class="who"><span class="txt"><button type="button" class="pl lnk" data-pid="${esc(x.p.id)}" data-mkt="${esc(x.s)}">${esc(x.p.name)}</button><span class="meta">${esc(x.p.team)} · ${esc(x.pos)}${withMatch ? ' vs ' + esc(x.p.opp) : ''}${x.p.status ? ' · ' + esc(x.p.status) : ''}</span></span></td>
    ${withMatch ? `<td>${esc(x.s)}</td><td>${muChip(x.mu)}</td>` : ''}
    <td class="num"><b>${x.proj.toFixed(1)}</b></td><td class="num${withMatch ? ' hide-sm' : ''}">${x.bump == null ? '—' : sgnP(x.bump)}</td><td class="num${withMatch ? ' hide-sm' : ''}">${x.line == null ? '<span class="muted-s">none</span>' : x.line.toFixed(1)}</td><td class="num">${vslChip(x.vsl)}</td></tr>`).join('');
}
// panel under a tapped cell in "Defense by position": D's defense, position P, stat S
function posPanel(D, key) {
  const [P, S] = key.split('|'), g = (B.games || []).find(x => x.away === D || x.home === D);
  if (!g) return '';
  const O = g.away === D ? g.home : g.away, f = posVal(D, key), up = f >= 0;
  const rows = (B.players || []).filter(p => p.team === O && String(p.pos || '').charAt(0) === P).map(p => posRow(p, S)).filter(Boolean)
    .sort((a, b) => up ? (b.bump || 0) - (a.bump || 0) || b.proj - a.proj : (a.bump || 0) - (b.bump || 0) || b.proj - a.proj);
  return `<div class="pp-panel">
    <div class="pp-h">${muChip(f)}<b>${esc(O)} ${POSN[P]} vs ${esc(D)} today · ${SNAME[S]}</b><button type="button" class="chip" data-go="g/${esc(g.id)}/matchup">${esc(g.away)} @ ${esc(g.home)} matchup ›</button></div>
    <p class="muted">${esc(D)} gave up ${Math.abs(Math.round(f))}% ${up ? 'more' : 'fewer'} ${SNAME[S]} than average to ${POSN[P]} (${DVP_WHEN}). ${up ? 'These are the players it helps most.' : 'These are the players it hurts most.'}</p>
    ${rows.length ? `<div class="table-wrap"><table class="data pp-t"><thead><tr><th>Player</th><th class="num">Projection</th><th class="num" title="How much of the projection comes from this matchup">From matchup</th><th class="num">Line</th><th class="num">Proj vs line</th></tr></thead><tbody>${plRows(rows, false)}</tbody></table></div>`
      : `<p class="muted">No ${POSN[P]} projected to play for ${esc(O)} today.</p>`}
    <p class="muted-s">Projection is the model's number if he plays; it already includes this matchup, so nothing is added on top. "From matchup" is roughly how much of it the matchup is worth. Tap a name for his card.</p>
  </div>`;
}
// Teams › Best matchups today: every player-stat on the slate, ranked by how soft (or tough) his position matchup is
const BESTCOLS = [['mu', 'Matchup'], ['proj', 'Projection vs line']];
const DVP_WHEN = 'this season, blended with last season while the sample is small';
const BEST_MIN = { PTS: 8, REB: 3, AST: 2, '3PM': 1 };
function renderBest() {
  const stats = bestStat === 'ALL' ? ['PTS', 'REB', 'AST', '3PM'] : [bestStat];
  let rows = (B.players || []).filter(p => p.expMin >= 15).flatMap(p => stats.map(s => posRow(p, s))).filter(x => x && x.proj >= BEST_MIN[x.s]);
  rows = rows.filter(x => bestSide === 'help' ? x.mu >= 3 : x.mu <= -3);
  const dflt = bestSide === 'help' ? 'desc' : 'asc';
  if (!BESTCOLS.some(c => c[0] === bestSort)) bestSort = 'mu';
  const v = x => bestSort === 'proj' ? x.vsl : x[bestSort];
  rows.sort((a, b) => { const va = v(a), vb = v(b); if (va == null || vb == null) return (va == null) - (vb == null); return bestDir === 'desc' ? vb - va : va - vb; });
  const shown = rows.slice(0, 40);
  const arrow = k => k === bestSort ? (bestDir === 'desc' ? ' ▼' : ' ▲') : '';
  const meter = v => { const w = Math.min(50, Math.abs(v) / 20 * 50), up = v >= 0;
    return `<span class="bm-m"><span class="bm-t"><i class="${up ? 'up' : 'dn'}" style="${up ? 'left' : 'right'}:50%;width:${w.toFixed(1)}%"></i></span><span class="bm-k"><span>tougher</span><b class="${up ? 'up' : 'dn'}">${up ? '+' : '−'}${Math.abs(Math.round(v))}% ${up ? 'easier' : 'tougher'}</b><span>easier</span></span></span>`; };
  const vsl = x => x.line == null ? `<span class="bm-v"><b>${x.proj.toFixed(1)}</b><small>no line tonight</small></span>`
    : `<span class="bm-v"><b>${x.proj.toFixed(1)}</b> vs ${x.line.toFixed(1)}<small class="${x.vsl >= 0 ? 'up' : 'dn'}">${Math.abs(x.vsl).toFixed(1)} ${x.vsl >= 0 ? 'over' : 'under'} the line</small></span>`;
  return `<div class="tools"><span class="seg-s" role="group" aria-label="Which matchups">${[['help', 'Soft matchups'], ['hurt', 'Tough matchups']].map(([k, n]) => `<button type="button" data-bside="${k}" aria-pressed="${k === bestSide}">${n}</button>`).join('')}</span>
      <span class="seg-s" role="group" aria-label="Stat">${[['ALL', 'All'], ['PTS', 'PTS'], ['REB', 'REB'], ['AST', 'AST'], ['3PM', '3PM']].map(([k, n]) => `<button type="button" data-bstat="${k}" aria-pressed="${k === bestStat}">${n}</button>`).join('')}</span></div>
    ${shown.length ? `<div class="plist bmlist"><div class="bm bm-h"><span>#</span><span></span><span>Player</span><span>Stat</span>${BESTCOLS.map(([k, n]) => `<button type="button" class="th-sort${k === bestSort ? ' on' : ''}" data-bsort="${k}">${n}${arrow(k)}</button>`).join('')}</div>
      ${shown.map((x, i) => `<button type="button" class="bm pl" data-pid="${esc(x.p.id)}" data-mkt="${esc(x.s)}" style="--tc:${esc(tcolor(x.p.team))}">
        <span class="bm-rk">${i + 1}</span>${hsDot(x.p)}
        <span class="pr-nm"><b>${esc(x.p.name)}</b><small>${esc(x.p.team)} ${esc(x.pos)} ${(B.games || []).some(g => g.away === x.p.team) ? '@' : 'vs'} ${esc(x.p.opp)}${showStatus(x.p.status) ? ' · ' + esc(x.p.status) : ''}</small></span>
        <span class="bm-s">${esc(x.s)}</span>${meter(x.mu)}${vsl(x)}</button>`).join('')}</div>
      ${rows.length > shown.length ? `<p class="muted-s">Showing the top ${shown.length} of ${rows.length}.</p>` : ''}`
      : `<div class="empty">No ${bestSide === 'help' ? 'soft' : 'tough'} position matchups today${bestStat === 'ALL' ? '' : ' for ' + SNAME[bestStat]}.</div>`}
    <p class="muted-s">Players expected to play 15+ minutes whose opponent is at least 3% ${bestSide === 'help' ? 'softer' : 'tougher'} than average against their position (${DVP_WHEN}). The meter runs from 20% tougher to 20% easier. Projections already include the matchup, so nothing is added on top.</p>`;
}
function renderTeams() {
  const t = TS();
  if (!t || !Object.keys(t.teams).length) return `<section><h2>Teams</h2><div class="empty">Team profiles aren't loaded yet.</div></section>`;
  if (!teamWindows().includes(teamWin)) teamWin = 'SZN';
  const sideSw = `<span class="seg-s" role="group" aria-label="View">${[['off', 'Offense'], ['def', 'Defense'], ['pos', 'Vs position'], ['best', 'Best matchups']].map(([k, n]) => `<button type="button" data-tside="${k}" aria-pressed="${k === teamSide}">${n}</button>`).join('')}</span>`;
  if (teamSide === 'best') return `<section id="teams"><h2>Teams</h2>
    <p class="sub">Today's players whose position matchup is softest or toughest, from how each defense has done against guards, forwards and centers (${DVP_WHEN}). Green helps him, red hurts. Tap a column to sort; tap it again to flip the order. Tap a name for his card.</p>
    <div class="tools">${sideSw}</div>${renderBest()}</section>`;
  const pos = teamSide === 'pos';
  const cols = pos ? POSCOLS : TSTAT;
  if (!cols.some(c => c.k === teamSort)) { teamSort = cols[0].k; teamDir = 'desc'; }
  const val = (c, k) => pos ? { v: posVal(c, k) } : tval(c, teamSide, teamWin, k);
  const codes = Object.keys(t.teams).filter(c => !pos || (t.dvp || {})[c]);
  const tonight = {}; (B.games || []).forEach(g => { tonight[g.away] = g; tonight[g.home] = g; });
  codes.sort((a, b) => { if (pos && posToday && !tonight[a] !== !tonight[b]) return tonight[a] ? -1 : 1;
    const va = val(a, teamSort).v, vb = val(b, teamSort).v; if (va == null || vb == null) return (va == null) - (vb == null); return teamDir === 'desc' ? vb - va : va - vb; });
  // orange = higher than most teams, teal = lower (same key as the sheet tabs)
  const sorted = {}; cols.forEach(c => { sorted[c.k] = codes.map(x => val(x, c.k).v).filter(v => v != null).sort((a, b) => a - b); });
  const shade = (k, v) => { const vals = sorted[k]; if (v == null || vals.length < 5) return ''; const q = vals.filter(x => x < v).length / (vals.length - 1);
    return q >= 0.9 ? 'h3' : q >= 0.75 ? 'h2' : q >= 0.6 ? 'h1' : q <= 0.1 ? 'l3' : q <= 0.25 ? 'l2' : q <= 0.4 ? 'l1' : ''; };
  const fmtC = (c, v) => v == null ? '—' : pos ? `${v > 0.5 ? '+' : v < -0.5 ? '−' : ''}${Math.abs(Math.round(v))}%` : fmtT(c, v);
  const arrow = k => k === teamSort ? (teamDir === 'desc' ? ' ▼' : ' ▲') : '';
  const label = c => pos ? c.s : (c.short || c.name.replace('Rebounds', 'REB').replace('Assists', 'AST').replace('Points', 'PTS'));
  const rows = codes.map((c, i) => {
    const g = tonight[c], open = teamOpen === c;
    const cells = cols.map(col => { const x = val(c, col.k), ck = c + '|' + col.k; return `<td class="${shade(col.k, x.v)}${col.k === teamSort ? ' on' : ''}${pos && col.s === 'PTS' && col.pos !== 'G' ? ' grp' : ''}${pos ? (g ? ' pc' : ' dim') : ''}${posCell === ck ? ' sel' : ''}"${pos && g ? ` data-cell="${esc(ck)}" title="${esc(c)} vs ${POSN[col.pos]}, ${SNAME[col.s]}: tap for today's players"` : ''}>${fmtC(col, x.v)}${x.fb ? '<sup>s</sup>' : ''}${!pos && x.v != null && sorted[col.k].length > 1 ? `<i class="tbar" style="width:${Math.round(14 + 86 * (x.v - sorted[col.k][0]) / ((sorted[col.k][sorted[col.k].length - 1] - sorted[col.k][0]) || 1))}%"></i>` : ''}</td>`; }).join('');
    return `<tr class="trow${g ? ' tonight' : ''}${open ? ' open' : ''}" data-team="${esc(c)}" style="--tc:${esc(tcolor(c))}"><td class="rk">${i + 1}</td><td class="who">${logo(c, 'table-team-logo')}<span class="txt"><b>${esc(c)}</b><span class="meta">${g ? `tonight ${g.away === c ? '@ ' + esc(g.home) : 'vs ' + esc(g.away)}` : esc(team(c).name || '')}</span></span></td>${cells}</tr>
      ${pos && posCell.startsWith(c + '|') ? `<tr class="tdet"><td colspan="${cols.length + 2}">${posPanel(c, posCell.slice(c.length + 1))}</td></tr>` : ''}
      ${open && !(pos && posCell.startsWith(c + '|')) ? `<tr class="tdet"><td colspan="${cols.length + 2}"><div class="tdet-in">${pos ? '' : `<div><h4>${esc(team(c).name || c)} defense by position</h4><p class="muted">Against league average per minute (${DVP_WHEN}).</p>${dvpGrid(c, null)}</div>`}
        ${g ? `<div class="tdet-go"><button type="button" class="chip" data-go="g/${esc(g.id)}/matchup">Tonight: ${esc(g.away)} @ ${esc(g.home)} matchup ›</button></div>` : `<p class="muted">No game tonight.</p>`}</div></td></tr>` : ''}`;
  }).join('');
  const intro = pos
    ? `How each defense has done against guards, forwards and centers (${DVP_WHEN}), compared with league average per minute. Orange = gave up more than average, teal = less. For teams playing today, tap a number to see the players it affects most.`
    : `All 30 teams, ${esc(seasonLabel())}, per game. Orange = higher than most teams, teal = lower.${t.cur ? '' : ' Switches to this season automatically once teams have three games.'}`;
  return `<section id="teams"><h2>Teams</h2>
    <p class="sub">${intro} Tap a column to sort; tap it again to flip the order. Tap a team for more.</p>
    <div class="tools">${sideSw}${pos ? `<button type="button" class="chip" data-ptoday aria-pressed="${posToday}">${posToday ? '✓ ' : ''}Today's teams first</button>` : winSwitch('data-twin')}</div>
    <div class="table-wrap teams-wrap"><table class="data tlg${pos ? ' tpos' : ''}">
      <thead>${pos ? `<tr class="grp-row"><th></th><th></th><th colspan="4">Guards</th><th colspan="4" class="grp">Forwards</th><th colspan="4" class="grp">Centers</th></tr>` : ''}
        <tr><th>#</th><th>Team</th>${cols.map(c => `<th${pos && c.s === 'PTS' && c.pos !== 'G' ? ' class="grp"' : ''}><button type="button" class="th-sort${c.k === teamSort ? ' on' : ''}" data-tsort="${c.k}" aria-label="Sort by ${esc(pos ? c.pos + ' ' + c.s : c.name)}">${esc(label(c))}${arrow(c.k)}</button></th>`).join('')}</tr></thead>
      <tbody>${rows}</tbody></table></div>
  </section>`;
}
function redrawTeamBits() {
  if (VIEW.name === 'teams') { $('#main').innerHTML = renderTeams(); }
  else if (VIEW.name === 'game' && VIEW.tab === 'matchup') { const g = (B.games || []).find(x => x.id === VIEW.id); if (g) $('#gpBody').innerHTML = matchupTab(g); }
}

/* player card: opponent's defense against his position, for the chosen stat */
function dvpFor(p, k) {
  const dv = ((TS() || {}).dvp || {})[p.opp], pos = String(p.pos || '').charAt(0);
  if (!dv || !dv[pos]) return null;
  const parts = PARTS[k] || [k];
  if (parts.some(s => dv[pos][s] == null)) return null;
  const w = parts.map(s => ifPlays(p, s) || 1), f = parts.reduce((a, s, i) => a + dv[pos][s] * w[i], 0) / w.reduce((a, b) => a + b, 0);
  const all = Object.keys(TS().dvp).map(c => { const d = TS().dvp[c][pos]; const ws = parts.map((s, i) => w[i]); return d ? parts.reduce((a, s, i) => a + d[s] * ws[i], 0) / ws.reduce((a, b) => a + b, 0) : null; }).filter(x => x != null);
  return { f, rank: 1 + all.filter(x => x < f).length, n: all.length, pos: { G: 'guards', F: 'forwards', C: 'centers' }[pos] };
}
// L3 / L5 / L10 / season for a stat: this season once he has 3 games, else last season
function formFor(p, k) {
  const F = p.form || {}, src = F.cur && F.cur.gp >= 3 ? F.cur : F.last, cur = src === F.cur;
  if (!src) return null;
  const parts = PARTS[k] || [k];
  if (parts.some(s => !src[s])) return null;
  const vals = [0, 1, 2, 3].map(i => { const xs = parts.map(s => src[s][i]); return xs.some(x => x == null) ? null : xs.reduce((a, b) => a + b, 0); });
  return { vals, cur, gp: src.gp };
}

/* ---------- Today: the lean cards, then one slim row per game ---------- */
const KIND_SHORT = { spread: 'Spread', ml: 'ML', total: 'Total', tt: 'Team total', h1spread: '1H spread', h1total: '1H total' };
function gameRow(g) {   // a mini version of the game header: team colors, projected (or final) score, win chance, the leans
  const A = g.algo || {}, PL = g.player || {}, a = A.away || {}, h = A.home || {}, ph = PL.home || {};
  const fin = (B.finals || {})[g.id], logged = (B.logged || {})[g.id];
  const final = !!(fin && g.away in fin && g.home in fin);
  const live = !final && /IN PROGRESS|HALFTIME|END/.test(String(g.status || '').toUpperCase());
  const calls = gameCalls(g).filter(c => !c.pass).sort((x, y) => (y.both ? 1 : 0) - (x.both ? 1 : 0) || y.score - x.score);
  const shown = calls.slice(0, 3), extra = calls.length - shown.length;
  const outs = [g.away, g.home].map(code => {
    const n = (B.players || []).filter(p => p.team === code && /Out/.test(p.status)).length;
    return n ? `<span class="gc-out">${esc(code)} ${n} out</span>` : '';
  }).join('');
  const wins = [h.win, ph.win].filter(x => x != null), hw = wins.length ? wins.reduce((s, x) => s + x, 0) / wins.length : null;
  const awP = hw == null ? null : Math.round((1 - hw) * 100);
  const side = (code, m, home) => `<span class="gc-t${home ? ' r' : ''}"><span class="gc-lg">${bgLogo(code)}</span><span><b>${esc(code)}</b><em>${final ? esc(fin[code]) : f1(m && m.pts)}</em></span></span>`;
  const mid = `<span class="gc-mid"><b>${final ? 'Final' : live ? 'In progress' : esc(tipCT(g.tip))}</b><small>${h.spread != null ? `${esc(g.home)} ${esc(line(h.spread))} · O/U ${esc(a.ou)}` : 'No line yet'}</small><small class="pj">${final ? (logged ? 'logged ' + esc(ctTime(logged.at)) : '') : 'projected'}</small></span>`;
  const leanLine = c => { const e = callNums(c).edge;
    return `<span class="gc-ln"><span><em>${KIND_SHORT[c.kind]}</em><b>${esc(c.bet)}</b>${c.both ? '' : `<small>${esc(c.model)} only</small>`}</span>${c.result ? badge(c.result) : `<span class="gc-ed${e >= 0 ? '' : ' neg'}">${sgn(e * 100, 1)}%</span>`}</span>`; };
  return `<div class="grow gcard" role="link" tabindex="0" data-go="g/${esc(g.id)}" aria-label="${esc(g.away)} at ${esc(g.home)}">
    <div class="gc-hd" style="background:linear-gradient(115deg, ${esc(tcolor(g.away))} 0 50%, ${esc(tcolor(g.home))} 50% 100%)">${side(g.away, a, false)}${mid}${side(g.home, h, true)}</div>
    <div class="gc-bd">
      ${awP != null ? `<div class="gc-wp"><span>${esc(g.away)} ${awP}%</span><span>${final ? 'pregame ' : ''}model win chance</span><span>${100 - awP}% ${esc(g.home)}</span></div>
      <div class="gc-bar"><i style="width:${awP}%;background:${esc(tcolor(g.away))}"></i><i style="background:${esc(tcolor(g.home))}"></i></div>` : ''}
      <div class="gc-lh">Model leans</div>
      ${shown.length ? shown.map(leanLine).join('') : '<span class="gc-ln none">No leans. Both models are close to the numbers.</span>'}
      <div class="gc-ft"><span class="gc-more">${extra > 0 ? `+${extra} more ›` : 'Open game ›'}</span><span>${outs}</span></div>
    </div>
  </div>`;
}
// scoreboard strip at the top of Today: every game one tap away, with its score or tip time and the model's top lean
function gameTile(g) {
  const fin = (B.finals || {})[g.id], final = !!(fin && g.away in fin && g.home in fin);
  const live = !final && /IN PROGRESS|HALFTIME|END/.test(String(g.status || '').toUpperCase());
  const A = g.algo || {}, pa = (A.away || {}).pts, ph = (A.home || {}).pts;
  const top = gameCalls(g).filter(c => !c.pass).sort((x, y) => (y.both ? 1 : 0) - (x.both ? 1 : 0) || y.score - x.score)[0];
  const lead = final ? (fin[g.away] > fin[g.home] ? g.away : g.home) : pa != null && ph != null ? (pa >= ph ? g.away : g.home) : '';
  const side = code => `<span class="gt-t${code === lead ? ' lead' : ''}${final && code !== lead ? ' lost' : ''}">${logo(code)}<b>${esc(code)}</b><em>${final ? fin[code] : f1(code === g.away ? pa : ph)}</em></span>`;
  const edge = top ? top.score - (top.both ? 1 : 0) : null;
  return `<button type="button" class="gt" data-go="g/${esc(g.id)}" aria-label="${esc(g.away)} at ${esc(g.home)}">
    <span class="gt-bar"><i style="background:${esc(tcolor(g.away))}"></i><i style="background:${esc(tcolor(g.home))}"></i></span>
    <span class="gt-in">${side(g.away)}${side(g.home)}
      <span class="gt-st ${final ? 'fin' : live ? 'live' : ''}"><span>${final ? 'Final' : live ? 'Live' : esc(tipCT(g.tip))}</span><span class="gt-pj">${final ? 'final' : 'proj'}</span></span></span>
    <span class="gt-l">${top ? `<b>${esc(top.bet)}</b>${top.result ? badge(top.result) : `<em class="${edge >= 0 ? 'pos' : ''}">${sgn(edge * 100, 1)}%</em>`}` : '<span class="none">No lean</span>'}</span>
  </button>`;
}
function renderToday() {
  const games = B.games || [];
  if (!games.length) return `<section><div class="empty"><b>No games on this date.</b> The page follows the date in SLATE B8; the morning job moves it to the next game day.</div></section>`;
  return `<nav class="gstrip" aria-label="Today's games">${games.map(gameTile).join('')}</nav>
    ${renderSpots()}
    <section id="board"><h2>Games</h2>
      <p class="sub">Tap a game for its lines, team totals and 1st half, props and rotations.</p>
      <div class="slate">${games.map(gameRow).join('')}</div>
    </section>`;
}

/* team totals and first half: Vegas number next to each model's number */
function extraLines(g) {
  const A = g.algo || {}, PL = g.player || {}, rows = [];
  ['away', 'home'].forEach(w => {
    const a = A[w] || {}, p = PL[w] || {};
    if (a.tt == null) return;
    rows.push([`${esc(a.team)} team total`, f1(a.tt), f1(a.pts), f1(p.pts)]);
  });
  const h = A.home || {}, ph = PL.home || {}, aw = A.away || {}, pa = PL.away || {};
  if (h.h1sp != null) {
    const ml = m => m && m.h1ats != null && m.h1sp != null ? line(-(m.h1ats - m.h1sp)) : '—';
    rows.push([`1st half ${esc(h.team)} spread`, line(h.h1sp), ml(h), ml(ph)]);
  }
  if (aw.h1ou != null) rows.push(['1st half total', f1(aw.h1ou), aw.h1ouDiff != null ? f1(aw.h1ou + aw.h1ouDiff) : '—', pa.h1ouDiff != null ? f1(aw.h1ou + pa.h1ouDiff) : '—']);
  if (!rows.length) return '';
  return `<table class="mini"><thead><tr><th></th><th>Vegas</th><th><i class="dot a"></i>NBA ALGO</th><th><i class="dot p"></i>PLAYER ALGO</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${r[0]}</td><td class="n">${r[1]}</td><td class="n">${r[2]}</td><td class="n">${r[3]}</td></tr>`).join('')}</tbody></table>`;
}
/* game header: team colors split on a diagonal, logos in white, projected (or final) score by the seam, the Vegas line in
   the middle; underneath, Vegas vs the model, the model's win chance and the lock status */
function banner(g, a, h, fin, logged) {
  const final = fin && g.away in fin && g.home in fin;
  const live = !final && /IN PROGRESS|HALFTIME|END/.test(String(g.status || '').toUpperCase());
  const lockedAt = (logged && logged.at) || g.locked || '';
  const half = (code, m, home) => {
    const t = team(code), rest = m && m.rest;
    const restTxt = rest === '0' || rest === 0 ? 'Back-to-back' : rest && rest !== 'OPENER' ? rest + (rest === '1' ? ' day rest' : ' days rest') : '';
    const img = t.logo ? `<img src="${esc(t.logo)}" alt="" onerror="this.remove()">` : '';
    // the full-colour logo; ESPN's dark-background version first (made to sit on dark colours), the regular one if that's missing
    const dark = t.logo && /\/500\//.test(t.logo) ? t.logo.replace('/500/', '/500-dark/') : '';
    const main = t.logo ? `<img src="${esc(dark || t.logo)}" alt="" onerror="${dark ? `if(this.src.indexOf('500-dark')>0){this.src='${esc(t.logo)}'}else{this.remove()}` : 'this.remove()'}">` : '';
    const won = final && fin[code] > fin[home ? g.away : g.home];
    return `<div class="bn-half ${home ? 'home' : 'away'}" style="--tc:${esc(tcolor(code))}">
      ${main ? `<span class="bn-wm" aria-hidden="true">${main}</span>` : ''}
      <span class="bn-logo">${main || `<b>${esc(code)}</b>`}</span>
      <span class="bn-name"><b>${esc(code)}</b><small>${esc(t.name || '')}</small>${restTxt ? `<small class="rest">${esc(restTxt)}</small>` : ''}</span>
      <span class="bn-score${final && !won ? ' lost' : ''}"><small>${final ? 'final' : 'proj'}</small>${final ? esc(fin[code]) : f1(m && m.pts)}</span>
    </div>`;
  };
  const vm = h.spread != null ? -h.spread : null;
  const pill = final ? `<b>Final</b><span>proj ${f1(a.pts)} – ${f1(h.pts)}</span>`
    : `<b>${live ? 'Live' : esc(tipCT(g.tip))}</b><span>${h.spread != null ? `${esc(fav(g, vm))} · O/U ${esc(a.ou)}` : 'no line yet'}</span>`;
  const chip = (lab, v, m) => `<span class="bn-chip"><em>${lab}</em><b>${v}</b>${m ? `<span class="m">model ${m}</span>` : ''}</span>`;
  const chips = [h.spread != null ? chip('Spread', esc(fav(g, vm)), h.margin != null ? esc(fav(g, h.margin)) : '') : '',
    a.ou != null && a.ou !== '' ? chip('Total', esc(a.ou), a.total != null ? f1(a.total) : '') : ''].join('');
  const wa = a.win, wh = h.win, hasWin = wa != null && wh != null && wa + wh > 0;
  const awayPct = hasWin ? Math.round(100 * wa / (wa + wh)) : 0;   // the two sides always add to 100
  const win = hasWin ? `<div class="bn-win"><div class="bn-wt"><span>${esc(g.away)} ${awayPct}%</span><span>model win chance</span><span>${100 - awayPct}% ${esc(g.home)}</span></div>
      <div class="bn-wp"><i style="width:${(100 * wa / (wa + wh)).toFixed(1)}%;background:${esc(tcolor(g.away))}"></i><i style="flex:1;background:${esc(tcolor(g.home))}"></i></div></div>` : '<div></div>';
  const badge = final ? `<span class="bn-lock fin">Final${lockedAt ? ' · graded' : ''}</span>`
    : lockedAt ? `<button type="button" class="bn-lock" data-lockinfo title="What does locked mean?">Locked ${esc(ctTime(lockedAt))}</button>`
    : live ? `<span class="bn-lock open">In progress</span>`
    : `<span class="bn-lock open">Locks about an hour before tip</span>`;
  return `<div class="bn">
    <div class="bn-top">${half(g.away, a, false)}${half(g.home, h, true)}<div class="bn-pill">${pill}</div></div>
    <div class="bn-tape"><div class="bn-chips">${chips}</div>${win}<div class="bn-right">${badge}</div></div>
    ${lockedAt && !final ? `<p class="bn-note" hidden>These are the pregame numbers that were tracked at ${esc(ctTime(lockedAt))} and get graded. The sheet's live tabs keep moving after the lock, so they won't match this page.</p>` : ''}
  </div>`;
}
/* one plain line per game: what to do with the spread, moneyline and total */
function blItem(g) {
  const calls = gameCalls(g), trk = TR().lines;
  return (kind, name, where) => {
    const c = calls.find(x => x.kind === kind && (!where || x.where === where));
    if (!c) return `<span class="bl pass"><em>${name}</em>Pass</span>`;
    if (c.pass) return `<span class="bl pass"><em>${name}</em>Pass, ${esc(c.pass)}</span>`;
    const verb = trk ? (c.both ? 'Likes' : 'Leans') : (c.both ? 'Bet' : 'Lean');
    const note = c.both ? (trk ? 'would bet to ' : 'good to ') + esc(c.prices[0]) : esc(c.model) + ' only';
    return `<span class="bl ${c.both ? 'bet' : 'lean'}${trk ? ' trk' : ''}"><em>${name}</em>${verb} ${esc(c.bet)}<small>${note}</small>${badge(c.result)}</span>`;
  };
}
function bottomLine(g) {
  const item = blItem(g);
  return `<div class="bottomline">${item('spread', 'Spread')}${item('ml', 'Moneyline')}${item('total', 'Total')}</div>`;
}
function bottomMore(g) {
  const item = blItem(g);
  const A = (g.algo || {}), has = (k, w) => w ? A[w] && A[w][k] != null : A.away && A.away[k] != null;
  const more = [has('tt', 'away') ? item('tt', g.away + ' team total', 'away') : '', has('tt', 'home') ? item('tt', g.home + ' team total', 'home') : '',
    has('h1sp') ? item('h1spread', '1st half spread') : '', has('h1ou') ? item('h1total', '1st half total') : ''].join('');
  return more ? `<div class="bottomline more-lines">${more}</div>` : '';
}
/* who's out, who's iffy, rest edges and stacked rosters — visible without opening the card */
function contextChips(g, a, h) {
  const chips = [];
  [g.away, g.home].forEach(code => {
    const ps = (B.players || []).filter(p => p.team === code);
    const out = ps.filter(p => /Out/.test(p.status)).map(p => p.name);
    const iffy = ps.filter(p => /Questionable|Doubtful/.test(p.status)).map(p => p.name + ' (' + p.status.toLowerCase() + ')');
    if (out.length) chips.push(`<span class="chip-c out"><b>${esc(code)} out</b> ${esc(out.join(', '))}</span>`);
    if (iffy.length) chips.push(`<span class="chip-c q"><b>${esc(code)}</b> ${esc(iffy.join(', '))}</span>`);
    const pool = (B.pool || {})[code];
    if (pool && pool.factor != null && pool.factor <= 0.92) chips.push(`<span class="chip-c"><b>${esc(code)}</b> stacked roster: PLAYER ALGO trims each player ${Math.round((1 - pool.factor) * 100)}%</span>`);
  });
  const r = x => x === 'OPENER' || x === '' || x == null ? null : Number(x);
  const ra = r(a.rest), rh = r(h.rest);
  if (ra === 0 && rh !== 0) chips.push(`<span class="chip-c"><b>${esc(g.away)}</b> on a back-to-back</span>`);
  if (rh === 0 && ra !== 0) chips.push(`<span class="chip-c"><b>${esc(g.home)}</b> on a back-to-back</span>`);
  return chips.length ? `<div class="context">${chips.join('')}</div>` : '';
}

function rotation(code) {
  const t = team(code), color = tcolor(code);
  const ps = (B.players || []).filter(p => p.team === code);
  const playing = ps.filter(p => p.expMin > 0).sort((x, y) => y.expMin - x.expMin);
  const out = ps.filter(p => !(p.expMin > 0));
  const total = playing.reduce((s, p) => s + p.expMin, 0);
  const pool = (B.pool || {})[code];
  const bar = playing.map((p, i) => `<i class="${/Questionable|Doubtful/.test(p.status) ? 'q' : ''}" style="flex:${p.expMin} 1 0;background:${color};opacity:${i < 5 ? 1 : 0.6}" title="${esc(p.name)} ${f1(p.expMin)} min"></i>`).join('');
  let poolNote = '';
  if (pool && pool.factor != null && Math.abs(pool.factor - 1) >= 0.03) {
    const d = Math.round(Math.abs(1 - pool.factor) * 100);
    poolNote = pool.factor < 1
      ? `<p class="note">Shared scoring: this rotation has a lot of high-usage players, so PLAYER ALGO trims each one's points by <b>${d}%</b>.</p>`
      : `<p class="note">Shared scoring: this rotation is light on shot-takers, so PLAYER ALGO raises each player's points by <b>${d}%</b>.</p>`;
  }
  // once the game is final: what he actually played and scored, with the projection underneath
  const g = (B.games || []).find(x => x.away === code || x.home === code), fin = g && (B.finals || {})[g.id];
  const final = !!(fin && g.away in fin && g.home in fin);
  const actOf = p => (p.log || []).find(l => l.gid ? l.gid === g.id : l.date === B.date) || null;
  const tone = (a, pj, close) => a == null || pj == null ? '' : a - pj >= close ? 'hi' : pj - a >= close ? 'lo' : '';
  const finCell = (a, pj, close, unit) => `<b class="${tone(a, pj, close)}">${a == null ? 'DNP' : Math.round(a) + unit}</b><small>proj ${pj == null ? '—' : f1(pj)}</small>`;
  const row = (p, gone) => {
    const a = final ? actOf(p) : null, dnp = final && !a;
    const pjMin = gone ? null : p.expMin, pjPts = gone ? null : p.pts;
    return `<li class="${gone && !a ? 'gone' : ''}${final ? ' fin' : ''}">${face(p, 'sm')}
    <span class="nm"><span class="n">${plBtn(p)}</span>${showStatus(p.status) ? ` <span class="st ${stCls(p.status)}">${esc(p.status)}</span>` : ''}</span>
    <span class="mb" aria-hidden="true"><i style="width:${Math.min(100, (final ? (a ? a.min : 0) : gone ? (p.usual || 0) : p.expMin) / 40 * 100)}%;background:${gone && !a ? '#B8BEC6' : color}"></i></span>
    ${final ? (gone && !a ? `<span class="m">${p.usual ? f1(p.usual) : '—'}</span><span class="pt"></span>`
      : `<span class="m">${finCell(dnp ? null : a.min, pjMin, 4, '')}</span><span class="pt">${finCell(dnp ? null : a.pts, pjPts, 4, ' pts')}</span>`)
      : `<span class="m">${gone ? (p.usual ? f1(p.usual) : '—') : f1(p.expMin)}</span><span class="pt">${gone ? '' : f1(p.pts) + ' pts'}</span>`}</li>`;
  };
  return `<div class="rot">
    <h4>${esc(t.name || code)}</h4>
    <p class="meta">${final ? `Final: actual minutes and points, with what we projected underneath. <span class="hi">Green</span> = 4+ more than projected, <span class="lo">red</span> = 4+ fewer.` : `${playing.length} players share ${Math.round(total)} expected minutes${out.length ? `; ${out.length} not expected to play` : ''}`}</p>
    <div class="mins" role="img" aria-label="Expected minutes split">${bar}</div>
    ${poolNote}
    <ul class="rows">${out.map(p => row(p, true)).join('')}${playing.map(p => row(p, false)).join('')}</ul>
  </div>`;
}

/* ---------- players ---------- */
/* players as stat lines: headshot, minutes, tonight's numbers with a matchup arrow under each, and his best prop */
const bestPropOf = p => (B.props || []).filter(x => x.id === p.id && !x.guard && x.edge != null).sort((x, y) => y.edge - x.edge)[0] || null;
const PSORT = [['expMin', 'Min'], ['pts', 'Pts'], ['reb', 'Reb'], ['ast', 'Ast'], ['tpm', '3PM'], ['bp', 'Best prop']];
let plDir = 'desc';
const plVal = (p, k) => { if (k !== 'bp') return p[k]; const b = bestPropOf(p); return b ? b.edge : null; };
function playerRows(list) {
  if (!list.length) return '<div class="empty">No players to show.</div>';
  const mu = (p, k) => { const m = posMult(p, k); if (m == null) return '';
    const d = (m - 1) * 100, cls = m >= 1.015 ? 'up' : m <= 0.985 ? 'dn' : 'eq';
    return `<i class="mu ${cls}" title="Matchup: ${esc(p.opp)} vs ${POSN[String(p.pos || '').charAt(0)] || 'his position'}, ${SNAME[k]} ${d >= 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}% in the model">${cls === 'up' ? '▲' : cls === 'dn' ? '▼' : '•'}</i>`; };
  const arrow = k => k === sortKey ? (plDir === 'desc' ? ' ▼' : ' ▲') : '';
  const head = `<div class="prow ph" role="group" aria-label="Sort players"><i></i><span></span><span></span><span class="ph-n">Player</span>${PSORT.map(([k, n]) => `<button type="button" class="ph-s${k === sortKey ? ' on' : ''}${k === 'bp' ? ' bp' : ''}" data-psort="${k}">${n}${arrow(k)}</button>`).join('')}</div>`;
  return `<div class="plist">${head}${list.map(p => {
    const st = showStatus(p.status), best = bestPropOf(p);
    const stat = (k, f, lab) => `<span class="pr-st"><b>${f1(p[f])}</b><small>${lab}${mu(p, k)}</small></span>`;
    return `<button type="button" class="prow pl" data-pid="${esc(p.id)}"${best ? ` data-mkt="${esc(best.market)}"` : ''} style="--tc:${esc(tcolor(p.team))}">
      <i class="pr-e"></i>${hsDot(p)}${teamMark(p.team)}
      <span class="pr-nm"><b>${esc(p.name)}</b><small>${esc(p.pos)} · ${oppTxt(p.team, p.opp)}</small>
        <span class="pr-tags">${st ? `<span class="st ${stCls(p.status)}">${esc(p.status)}${p.play != null && p.play < 0.99 ? ' · ' + pct(p.play) : ''}</span>` : ''}<span class="cf conf-${esc(p.conf.split(' ')[0])}">${esc(p.conf.split(' ')[0])} confidence</span></span></span>
      <span class="pr-st mn"><b>${f1(p.expMin)}</b><small>min</small></span>${stat('PTS', 'pts', 'pts')}${stat('REB', 'reb', 'reb')}${stat('AST', 'ast', 'ast')}${stat('3PM', 'tpm', '3pm')}
      <span class="pr-bp">${best ? `<small>best prop</small><span class="bpc${best.flagged ? ' fl' : ''}">${esc(best.side === 'Over' ? 'O' : 'U')} ${esc(best.line)} ${esc(best.market)} <em>${sgn(best.edge * 100, 1)}%</em></span>` : '<small>no prop line</small>'}</span>
    </button>`; }).join('')}</div>`;
}
function renderPlayers() {
  const teams = [...new Set((B.games || []).flatMap(g => [g.away, g.home]))];
  const list = (B.players || []).filter(p => p.expMin > 0 && (teamFilter === 'ALL' || p.team === teamFilter))
    .sort((x, y) => { const a = plVal(x, sortKey), b = plVal(y, sortKey); if (a == null || b == null) return (a == null) - (b == null); return plDir === 'desc' ? b - a : a - b; });
  const shown = showAll || teamFilter !== 'ALL' ? list : list.slice(0, 20);
  const chips = ['ALL'].concat(teams).map(t => `<button class="chip" aria-pressed="${t === teamFilter}" data-team="${esc(t)}">${t === 'ALL' ? 'All teams' : esc(t)}</button>`).join('');
  return `
  <section id="players">
    <h2>Players</h2>
    <p class="sub">Expected numbers already count each player's chance of playing and his share of the 240 minutes. <span class="mu up">▲</span> / <span class="mu dn">▼</span> under a stat: tonight's opponent is easier / tougher than average on that stat for his position (already in the number). Tap a player for his card.</p>
    <div class="cf-key"><b>Confidence = how much to trust his minutes tonight.</b>
      <span><i class="cf conf-High">High</i>role and minutes check out, and he's listed active</span>
      <span><i class="cf conf-Medium">Medium</i>role checks out, but he isn't confirmed active yet or he's questionable</span>
      <span><i class="cf conf-Low">Low</i>something is shaky: a rookie projected from his draft slot, a new team or role the minutes model can't read yet, or a failed data check</span></div>
    <div class="tools">${chips}
      <label class="sort-dd">Sort by <select id="sort">
        ${[['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes'], ['expMin', 'Minutes'], ['bp', 'Best prop edge']].map(([k, n]) => `<option value="${k}" ${k === sortKey ? 'selected' : ''}>${n}</option>`).join('')}
      </select></label>
    </div>
    <div class="tools"><span class="seg-s" role="group" aria-label="View">${[['tonight', 'Tonight'], ['form', 'Form']].map(([k, n]) => `<button type="button" data-plview="${k}" aria-pressed="${k === plView}">${n}</button>`).join('')}</span>
      ${plView === 'form' ? `<span class="seg-s" role="group" aria-label="Stat">${FORM_STATS.map(([kk, n]) => `<button type="button" data-fstat="${kk}" aria-pressed="${kk === sortKey || (kk === 'pts' && !FORM_STATS.some(f => f[0] === sortKey))}">${n}</button>`).join('')}</span>` : ''}
      ${plView === 'form' ? `<span class="muted-s">${esc({ pts: 'Points', reb: 'Rebounds', ast: 'Assists', tpm: 'Threes', expMin: 'Minutes' }[sortKey] || 'Points')}: last 3, 5, 10 and season. This season once he has 3 games, last season before that.</span>` : ''}</div>
    ${plView === 'form' ? formTable(shown) : playerRows(shown)}
    ${'' && `<div class="table-wrap"><table class="data">
      <thead><tr><th>Player</th><th>Min</th><th>Pts</th><th>Reb</th><th>Ast</th><th>3PM</th><th class="hide-sm">Confidence</th></tr></thead>
      <tbody>${shown.map(p => `<tr>
        <td class="who">${logo(p.team, 'table-team-logo')}<span class="txt">${plBtn(p)}<span class="meta">${esc(p.team)} ${esc(p.pos)} vs ${esc(p.opp)}${showStatus(p.status) ? ` · <span class="st ${stCls(p.status)}">${esc(p.status)}</span>` : ''}</span></span></td>
        <td>${f1(p.expMin)}</td>
        <td class="big">${f1(p.pts)}${p.ptsHi ? `<span class="rng">${f1(p.ptsLo)}–${f1(p.ptsHi)}</span>` : ''}</td>
        <td>${f1(p.reb)}</td><td>${f1(p.ast)}</td><td>${f1(p.tpm)}</td>
        <td class="hide-sm conf-${esc(p.conf.split(' ')[0])}">${esc(p.conf)}</td></tr>`).join('')}</tbody>
    </table></div>`}
    ${!showAll && teamFilter === 'ALL' && list.length > 20 ? `<button class="show-all" id="showAll">Show all ${list.length} players</button>` : ''}
  </section>`;
}

/* ---------- props ---------- */
function propPrices(p) {
  const prob = p.side === 'Over' ? p.pOver : (p.pOver == null ? null : 1 - p.pOver);
  return prob == null ? ['—', '—'] : (pr => [odds(pr.bet), odds(pr.lean)])(mlPrices(prob, B.propFlag));
}
const propChance = p => p.side === 'Over' ? p.pOver : (p.pOver == null ? null : 1 - p.pOver);
// model vs line on a little number line: black tick = the line, green dot = the model
function mlLine(model, ln) {
  if (model == null || ln == null) return '<span class="mln"></span>';
  const pad = Math.max(0.6, Math.abs(model - ln) * 0.45), lo = Math.min(model, ln) - pad, hi = Math.max(model, ln) + pad;
  const X = v => ((v - lo) / (hi - lo) * 100).toFixed(1) + '%';
  return `<span class="mln"><span class="mln-t"><i style="left:${X(Math.min(model, ln))};width:calc(${X(Math.max(model, ln))} - ${X(Math.min(model, ln))})"></i><em class="l" style="left:${X(ln)}"></em><em class="m" style="left:${X(model)}"></em></span>
    <span class="mln-k">${model <= ln ? `<span>model <b>${f1(model)}</b></span><span>line <b>${ln}</b></span>` : `<span>line <b>${ln}</b></span><span>model <b>${f1(model)}</b></span>`}</span></span>`;
}
// one prop as a row; rank → the big ranked style used for the top picks
function propRow(p, rank) {
  const pl = BY_ID[p.id] || { name: p.player, team: p.team, id: p.id };
  const ch = propChance(p), be = ch != null && p.edge != null ? ch - p.edge : null, pr = propPrices(p);
  const opp = oppTxt(p.team, pl.opp);
  const act = p.actual !== undefined && p.actual !== '' && p.actual != null ? `<span class="pp-act">finished with ${esc(p.actual)}</span>` : '';
  const tags = `${p.play != null && p.play < 0.99 && p.play > 0 ? `<span class="pp-tg q">${pct(p.play)} to play</span>` : ''}${p.guard ? `<span class="pp-tg chk" title="${esc(p.guard)}">check: ${esc(p.guard.replace(/^CHECK /, '').toLowerCase())}</span>` : ''}${act}`;
  const big = rank != null, trk = TR().props;
  return `<button type="button" class="prp pl${big ? ' big' : ''}${p.flagged ? ' fl' : ''}" data-pid="${esc(pl.id)}" data-mkt="${esc(p.market)}" style="--tc:${esc(tcolor(p.team))}">
    <i class="pp-e"></i>${big ? `<span class="pp-rk">${rank}</span>` : ''}${hsDot(pl)}${teamMark(p.team)}
    <span class="pp-pk"><b>${esc(p.side)} ${p.line == null ? '' : esc(p.line)} ${esc(p.market)}</b><small>${esc(pl.name)}${opp ? ' · ' + opp : ''}</small>${tags ? `<span class="pp-tags">${tags}</span>` : ''}</span>
    ${mlLine(projIf(p), p.line)}
    ${big ? edgeDial(p.edge, 'How far the model chance clears break-even') : ''}
    <span class="pp-ch">${big ? '' : `<span class="lp ${p.edge != null && p.edge > 0 ? 'e' : 'n'}">${p.edge == null ? '—' : sgn(p.edge * 100, 1) + '%'} edge</span>`}<span class="lp n">${pct(ch)} chance</span>${be != null ? `<span class="lp n">break-even ${pct(be)}</span>` : ''}</span>
    <span class="pp-pr"><small>${trk ? 'would bet to' : 'bet to'}</small><b>${esc(pr[0])}</b><small>${big ? 'lean to ' + esc(pr[1]) : 'odds ' + esc(p.side === 'Over' ? p.overOdds : p.underOdds)}</small></span>
    <span class="pp-res">${badge(propRes(p))}</span>
  </button>`;
}
function renderProps() {
  const ps = B.props || [];
  if (!ps.length) return `
  <section id="props"><h2>Props</h2>
    <div class="empty"><b>No prop lines for this slate yet.</b> They fill in automatically from SportsGameOdds with the morning odds pull, or you can type your own on PROP EDGES (columns A–I). Lines entered later than about an hour before tip aren't graded.</div>
  </section>`;
  const top = ps.filter(p => p.flagged).slice(0, 5);
  return `
  <section id="props"><h2>Props</h2>
    <p class="sub">${TR().props ? '<b>Tracking only.</b> Logged and graded like bets, not bets yet. ' : ''}${top.length ? `The board is the ${top.length === 1 ? 'one prop' : 'top ' + top.length} that clear the ${pct(B.propFlag)} edge flag on PROP EDGES, best first.` : `None clear the ${pct(B.propFlag)} edge flag yet.`} On each row the black tick is the line and the green dot is the model; the dial is the edge, on the same 0–15% scale as Model leans. Rows marked <i>check</i> have a projection that looks off (minutes well under his usual, or an edge too big to believe); they're graded but never flagged.</p>
    ${top.length ? `<div class="pboard">${top.map((p, i) => propRow(p, i + 1)).join('')}</div><h3 class="ov-h pp-all">Every prop</h3>` : ''}
    ${propTable(ps, 'all')}
  </section>`;
}
// filter state kept separately for the Props screen ('all') and a game's Props tab ('game')
const PSTATE = { all: { mkt: 'ALL', side: 'ALL', more: false }, game: { mkt: 'ALL', side: 'ALL', more: false } };
const mkOf = p => String(p.market).toUpperCase();
function propTable(ps, scope) {
  const S = PSTATE[scope];
  const mk = ['ALL'].concat(['PTS', 'REB', 'AST', '3PM', 'PRA', 'PR', 'PA', 'RA'].filter(m => ps.some(p => mkOf(p) === m)));
  if (!mk.includes(S.mkt)) S.mkt = 'ALL';
  const list = ps.filter(p => (S.mkt === 'ALL' || mkOf(p) === S.mkt) && (S.side === 'ALL' || (S.side === 'FLAG' ? p.flagged : p.side === S.side)));
  const cap = scope === 'game' ? 15 : PROP_ROWS, shown = S.more ? list : list.slice(0, cap);
  const n = side => ps.filter(p => (S.mkt === 'ALL' || mkOf(p) === S.mkt) && p.side === side).length;
  const chips = (mk.length > 2 ? mk.map(m => `<button type="button" class="chip" data-pmkt="${m}" aria-pressed="${m === S.mkt}">${m === 'ALL' ? 'All' : m}</button>`).join('') : '') +
    `<span class="seg-s" role="group" aria-label="Side">${[['ALL', 'Both sides'], ['Over', 'Overs ' + n('Over')], ['Under', 'Unders ' + n('Under')], ['FLAG', 'Flagged']].map(([k, l]) => `<button type="button" data-pside="${k}" aria-pressed="${k === S.side}">${l}</button>`).join('')}</span>`;
  return `<div class="ptable" data-scope="${scope}">
    <div class="tools" role="group" aria-label="Filter props">${chips}</div>
    ${list.length ? `<div class="plist prlist">${shown.map(p => propRow(p)).join('')}</div>` : `<p class="empty">Nothing matches these filters.</p>`}
    ${!S.more && list.length > cap ? `<p class="more-row"><button type="button" class="chip" data-pmore="1">Show all ${list.length} props</button></p>` : ''}
  </div>`;
}
// one click handler for every prop table on screen; redraws just that table
function wirePropTables() {
  document.querySelectorAll('.ptable').forEach(box => box.onclick = e => {
    const b = e.target.closest('button'); if (!b || b.classList.contains('pl')) return;
    const scope = box.dataset.scope, S = PSTATE[scope];
    if (b.dataset.pmkt) { S.mkt = b.dataset.pmkt; S.more = false; }
    else if (b.dataset.pside) { S.side = b.dataset.pside; S.more = false; }
    else if (b.dataset.pmore) S.more = true;
    else return;
    const ps = scope === 'game' ? gameProps((B.games || []).find(g => g.id === VIEW.id) || {}) : (B.props || []);
    box.outerHTML = propTable(ps, scope);
    wirePropTables();
  });
}

/* ---------- player card: one stat switch drives the range, the line and the recent games ---------- */
const STATS = [
  { k: 'MIN', lab: 'minutes', name: 'Minutes', f: g => g.min },
  { k: 'PTS', lab: 'points', name: 'Points', f: g => g.pts },
  { k: 'REB', lab: 'rebounds', name: 'Rebounds', f: g => g.reb },
  { k: 'AST', lab: 'assists', name: 'Assists', f: g => g.ast },
  { k: '3PM', lab: 'threes made', name: 'Threes', f: g => g.tpm },
  { k: 'PRA', lab: 'pts + reb + ast', name: 'Pts + reb + ast', f: g => g.pts + g.reb + g.ast },
  { k: 'PR', lab: 'pts + reb', name: 'Pts + reb', f: g => g.pts + g.reb, combo: true },     // shown only when he has that prop tonight
  { k: 'PA', lab: 'pts + ast', name: 'Pts + ast', f: g => g.pts + g.ast, combo: true },
  { k: 'RA', lab: 'reb + ast', name: 'Reb + ast', f: g => g.reb + g.ast, combo: true },
];
const PARTS = { PRA: ['PTS', 'REB', 'AST'], PR: ['PTS', 'REB'], PA: ['PTS', 'AST'], RA: ['REB', 'AST'] };
let cardStat = 'PTS', cardN = 5, CARD_P = null;
try { cardStat = localStorage.getItem('slate.stat') || 'PTS'; cardN = Number(localStorage.getItem('slate.n')) || 5; } catch (e) {}
const saveCardPrefs = () => { try { localStorage.setItem('slate.stat', cardStat); localStorage.setItem('slate.n', String(cardN)); } catch (e) {} };
const mk = x => String(x.market || '').toUpperCase();
const cardStats = p => { const ps = (B.props || []).filter(x => x.id === p.id); return STATS.filter(s => !s.combo || ps.some(x => mk(x) === s.k)); };
const propFor = (p, k) => (B.props || []).find(x => x.id === p.id && mk(x) === k) || null;
// projection if he plays, for any stat
function ifPlays(p, k) {
  const back = p.minIf > 0 && p.expMin > 0 ? p.minIf / p.expMin : null;          // older snapshots only carry expected values
  const g = (v, e) => v != null ? v : (e != null && back ? Math.round(e * back * 10) / 10 : null);
  const v = { PTS: p.ptsIf, REB: g(p.rebIf, p.reb), AST: g(p.astIf, p.ast), '3PM': g(p.tpmIf, p.tpm), MIN: p.minIf || null };
  if (k in v) return v[k];
  const xs = (PARTS[k] || []).map(x => v[x]);
  return !xs.length || xs.some(x => x == null) ? null : Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;
}
function lastSeason(p, k) {
  const L = p.last; if (!L) return null;
  const v = { MIN: L.min, PTS: L.pts, REB: L.reb, AST: L.ast, '3PM': L.tpm };
  if (k in v) return v[k] == null ? null : v[k];
  const xs = (PARTS[k] || []).map(x => v[x]);
  return xs.some(x => x == null) ? null : xs.reduce((a, b) => a + b, 0);
}
// spread of outcomes: the same distributions PROP EDGES prices with (ROTATION SETTINGS rows 52–59)
const DIST0 = { PTS: { fam: 'N', a: 11.86, b: 2.26, shift: 0.41, scale: 0.97 }, PRA: { fam: 'N', a: 27.86, b: 1.854, shift: 0.4, scale: 0.981 },
  PR: { fam: 'N', a: 20.5, b: 2.044, shift: 0.45, scale: 0.969 }, PA: { fam: 'N', a: 16.49, b: 2.022, shift: 0.35, scale: 0.976 },
  REB: { fam: 'NB', d: 1.42 }, AST: { fam: 'NB', d: 1.24 }, RA: { fam: 'NB', d: 1.68 }, '3PM': { fam: 'NB', d: 1.22 } };
const distFor = k => (P().dist && P().dist[k]) || DIST0[k];
function nbQuantile(mu, d, q) {
  if (!(mu > 0)) return 0;
  let cdf = 0;
  if (!(d > 1.0001)) { let pmf = Math.exp(-mu); for (let x = 0; x < 400; x++) { cdf += pmf; if (cdf >= q) return x; pmf *= mu / (x + 1); } return Math.round(mu); }
  const r = mu / (d - 1), pp = 1 / d;
  let pmf = Math.pow(pp, r);
  for (let x = 0; x < 400; x++) { cdf += pmf; if (cdf >= q) return x; pmf *= (x + r) / (x + 1) * (1 - pp); }
  return Math.round(mu);
}
// middle half of outcomes if he plays: [low, high]
function statRange(p, k) {
  const m = ifPlays(p, k);
  if (m == null) return null;
  if (k === 'PTS' && p.ptsLo != null && p.ptsHi != null) return [p.ptsLo, p.ptsHi];
  if (k === 'MIN') {      // 2024–26 openers: starters run about 4 under to 3.5 over their projection; bench players swing wider and upward
    const o = m >= 28 ? [4.2, 3.3] : m >= 20 ? [4.8, 5.3] : [3.4, 7.5];
    return [Math.max(0, m - o[0]), Math.min(48, m + o[1])];
  }
  const D = distFor(k);
  if (!D) return null;
  if (D.fam === 'N') { const sd = D.scale * Math.sqrt(Math.max(0.01, D.a + D.b * m)), c = m - D.shift; return [Math.max(0, c - 0.6745 * sd), c + 0.6745 * sd]; }
  return [nbQuantile(m, D.d, 0.25), nbQuantile(m, D.d, 0.75)];
}
const fmtStat = (k, v) => v == null ? '—' : k === 'MIN' ? String(Math.round(v)) : f1(v);

function openCard(id, market) {
  const p = BY_ID[id];
  if (!p) return;
  CARD_P = p; VS_ALL = false;
  if (market && STATS.some(s => s.k === market.toUpperCase())) { cardStat = market.toUpperCase(); saveCardPrefs(); }
  const t = team(p.team), color = tcolor(p.team);
  const mates = (B.players || []).filter(x => x.team === p.team && x.expMin > 0);
  const teamPts = mates.reduce((s, x) => s + (x.pts || 0), 0);
  const rank = k => 1 + mates.filter(x => (x[k] || 0) > (p[k] || 0)).length;

  // role on the team tonight
  const share = (label, v, total, k, of) => `<div class="pc-sh"><span>${label}</span><span class="pc-bar"><i style="width:${Math.min(100, v / total * 100)}%;background:${esc(color)}"></i></span><b>${Math.round(v / total * 100)}%</b><small>${of}, ${ordn(rank(k))} on ${esc(p.team)}</small></div>`;
  const role = p.expMin > 0 ? `<section class="pc-sec"><h4 class="pc-h">Role tonight</h4>${share('Minutes', p.expMin, 48, 'expMin', 'of the game')}${teamPts ? share('Points', p.pts || 0, teamPts, 'pts', 'of the team') : ''}</section>` : '';

  const st = p.status ? (/Day-to-day/.test(p.status) ? 'Day-to-day, counted as playing' : p.status) : '';
  const cf = String(p.conf || '').split(' ')[0], mins = ifPlays(p, 'MIN');
  const bp = bestPropOf(p);
  const tags = [
    cf ? `<span class="pc-tag cf-${esc(cf)}" title="${esc(p.conf)}">${esc(cf)} confidence</span>` : '',
    p.play != null && p.play < 0.99 ? `<span class="pc-tag q">${pct(p.play)} to play</span>` : '',
    st ? `<span class="pc-tag ${/Out/.test(st) ? 'out' : /Questionable|Doubtful/.test(st) ? 'q' : ''}">${esc(st)}</span>` : '',
    bp && bp.edge > 0 ? `<button type="button" class="pc-tag bp" data-stat="${esc(mk(bp))}" title="His biggest prop edge tonight">Best prop <b>${esc(bp.side)} ${esc(bp.line)} ${esc(bp.market)}</b> ${sgn(bp.edge * 100, 1)}%</button>` : '',
  ].filter(Boolean).join('');
  $('#card').innerHTML = `
    <div class="hd" style="background:${heroBg(p.team)}">
      ${heroArt(p)}
      <button class="x" aria-label="Close" onclick="document.getElementById('card').close()">✕</button>
      <div class="id"><h3>${esc(p.name)}</h3>
        <p>${esc(t.name || p.team)} · ${esc(p.pos)}${p.opp ? ' · ' + oppTxt(p.team, p.opp) : ''}${mins ? ` · <b>${Math.round(mins)} min</b> if he plays` : ''}</p>
        ${tags ? `<div class="pc-tags">${tags}</div>` : ''}</div>
    </div>
    <div class="bd">
      <section class="pc-sec"><h4 class="pc-h">Tonight if he plays <small>tap a stat</small></h4><div class="tiles" role="group" aria-label="Stat"></div></section>
      <div id="statpanel" class="pc-stack"></div>
      <div id="vspos"></div>
      <div id="recent"></div>
      <div id="cprops"></div>
      ${role}
    </div>`;
  drawStat();
  const d = $('#card');
  if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  const bd = d.querySelector('.bd'); if (bd) bd.scrollTop = 0;
  d.scrollTop = 0;
}

// redraws everything that depends on the chosen stat
function drawStat() {
  const p = CARD_P; if (!p) return;
  const stats = cardStats(p);
  if (!stats.some(s => s.k === cardStat)) cardStat = 'PTS';
  const k = cardStat, S = STATS.find(s => s.k === k), color = tcolor(p.team);
  const props = (B.props || []).filter(x => x.id === p.id);

  // stat tiles: tonight's number if he plays, with the line (or last season) underneath; tapping one picks the stat
  document.querySelector('#card .tiles').innerHTML = stats.map(s => {
    const pr = propFor(p, s.k), ls = lastSeason(p, s.k);
    return `<button type="button" data-stat="${s.k}" aria-pressed="${s.k === k}"${pr && pr.flagged ? ' class="fl"' : ''}><b>${fmtStat(s.k, ifPlays(p, s.k))}</b><span>${s.k === '3PM' ? '3PM' : s.k.length > 3 ? s.k : s.k.toLowerCase()}</span><i>${pr && pr.line != null ? 'line ' + esc(pr.line) : ls != null ? fmtStat(s.k, ls) + ' last szn' : '&nbsp;'}</i></button>`;
  }).join('');

  // the prop: the pick, model vs line, chance vs break-even, the edge dial
  const proj = ifPlays(p, k), rg = statRange(p, k), prop = propFor(p, k), ls = lastSeason(p, k);
  let propSec = '';
  if (prop) {
    const ch = propChance(prop), be = ch != null && prop.edge != null ? ch - prop.edge : null;
    const res = prop.grade === 'W' || prop.grade === 'L' ? prop : null, trk = TR().props;
    const oddsTxt = [prop.overOdds !== '' && prop.overOdds != null ? 'O ' + prop.overOdds : '', prop.underOdds !== '' && prop.underOdds != null ? 'U ' + prop.underOdds : ''].filter(Boolean).join(' · ');
    const act = prop.actual !== undefined && prop.actual !== '' && prop.actual != null ? ` · finished with <b>${esc(prop.actual)}</b>` : '';
    propSec = `<section class="pc-sec pc-prop${prop.flagged ? ' fl' : ''}">
      <h4 class="pc-h">The prop <small>${esc(S.name)}${prop.locked ? ' · locked at capture' : ''}</small></h4>
      <div class="pc-pg">
        <div class="pc-pk"><small>Model side</small><b>${esc(prop.side)} ${esc(prop.line)} ${esc(prop.market)}</b><small>${esc(oddsTxt)}${act}</small>${res ? `<span class="pc-res">${badge(res)}</span>` : ''}</div>
        <div class="pc-ml">${mlLine(projIf(prop) != null ? projIf(prop) : proj, prop.line)}<span class="pp-ch"><span class="lp n">${pct(ch)} chance</span>${be != null ? `<span class="lp n">break-even ${pct(be)}</span>` : ''}${prop.mktOver != null && prop.mktOver !== '' ? `<span class="lp n">Vegas over ${pct(prop.mktOver)}</span>` : ''}</span></div>
        ${edgeDial(prop.edge, 'How far the model chance clears break-even')}
      </div>
      ${prop.flagged ? `<p class="tk g"><i>${trk ? 'Model lean' : 'Flagged'}</i><span><b>${esc(prop.side)} ${esc(prop.line)}</b>, ${trk ? 'would bet to' : 'good to'} <b>${esc(propPrices(prop)[0])}</b>. Clears the ${pct(B.propFlag)} edge flag.${trk ? ' Tracking only.' : ''}</span></p>` : ''}
      ${prop.guard ? `<p class="tk w"><i>Check ${esc(prop.guard.replace(/^CHECK /, '').toLowerCase())}</i><span>This projection looks off (${/MIN/.test(prop.guard) ? 'minutes well under his usual' : 'an edge too big to believe'}), so it's graded but never flagged.</span></p>` : ''}
    </section>`;
  } else if (k !== 'MIN') propSec = `<section class="pc-sec pc-prop none"><h4 class="pc-h">The prop <small>${esc(S.name)}</small></h4><p class="muted">No ${esc(S.lab)} line for him tonight${proj != null ? `. Projection if he plays: <b>${fmtStat(k, proj)}</b>` : ''}.</p></section>`;

  // range strip: middle half of outcomes, the projection, tonight's line, last season
  let outlook = '';
  if (proj != null && rg) {
    const lineV = prop && prop.line != null ? Number(prop.line) : null;
    const marks = [rg[0], rg[1], proj, lineV, ls].filter(v => v != null);
    const span0 = Math.max(...marks) - Math.min(...marks), pad = Math.max(k === 'MIN' ? 3 : 1, span0 * 0.18);
    const lo = Math.max(0, Math.floor(Math.min(...marks) - pad)), hi = Math.ceil(Math.max(...marks) + pad);
    const step = hi - lo <= 8 ? 1 : hi - lo <= 18 ? 2 : hi - lo <= 45 ? 5 : 10;
    const X = v => ((v - lo) / (hi - lo) * 100).toFixed(2) + '%';
    const ticks = []; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const lineRight = lineV != null && lineV > proj;
    outlook = `<section class="pc-sec"><h4 class="pc-h">Range if he plays <small>${esc(S.name)}</small></h4><div class="outlook">
        ${ticks.map(v => `<span class="tick" style="left:${X(v)}"><em>${v}</em></span>`).join('')}
        <span class="range" style="left:${X(rg[0])};width:calc(${X(rg[1])} - ${X(rg[0])});background:${esc(color)}"></span>
        <span class="mark proj ${lineRight ? 'lft' : 'rgt'}" style="left:${X(proj)}"><b>${fmtStat(k, proj)}</b></span>
        ${lineV != null ? `<span class="mark line ${lineRight ? 'rgt' : 'lft'}" style="left:${X(lineV)}"><b>Line ${esc(prop.line)}</b></span>` : ''}
        ${ls != null ? `<span class="mark ls" style="left:${X(ls)}" title="Last season ${fmtStat(k, ls)}"></span>` : ''}
      </div>
      <p class="pc-key"><span><i class="k-rg" style="background:${esc(color)}"></i>Middle half of outcomes, ${fmtStat(k, rg[0])}–${fmtStat(k, rg[1])}</span><span><i class="k-pj"></i>Projection ${fmtStat(k, proj)}</span>${lineV != null ? `<span><i class="k-ln"></i>Tonight's line</span>` : ''}${ls != null ? `<span><i class="k-ls"></i>Last season ${fmtStat(k, ls)}</span>` : ''}</p></section>`;
  } else outlook = `<section class="pc-sec"><h4 class="pc-h">Range if he plays</h4><p class="muted">No projection for ${esc(S.lab)} tonight.</p></section>`;

  // matchup (his position vs this defense) and form, side by side
  const fm = formFor(p, k), dv = k === 'MIN' ? null : dvpFor(p, k);
  const formBox = fm ? `<section class="pc-sec"><h4 class="pc-h">Form <small>${fm.cur ? `this season, ${fm.gp} games` : 'last season, 2025–26'}</small></h4>
      <div class="pc-form">${['Last 3', 'Last 5', 'Last 10', 'Season'].map((l, i) => `<div${i === 3 ? ' class="sz"' : ''}><b>${fmtStat(k, fm.vals[i])}</b><small>${l}</small></div>`).join('')}</div></section>` : '';
  const muBox = dv ? (() => {
    const v = (dv.f - 1) * 100, w = Math.min(50, Math.abs(v) / 20 * 50), up = v >= 0, pc = Math.round(v);
    const word = pc >= 4 ? 'Easier' : pc <= -4 ? 'Tougher' : 'About average';
    return `<section class="pc-sec"><h4 class="pc-h">Matchup <small>${esc(p.opp)} vs ${dv.pos}</small></h4>
      <p class="pc-mu"><b class="${pc >= 4 ? 'up' : pc <= -4 ? 'dn' : ''}">${word}</b><span>${ordn(dv.rank)} toughest of ${dv.n}</span></p>
      <span class="bm-m"><span class="bm-t"><i class="${up ? 'up' : 'dn'}" style="${up ? 'left' : 'right'}:50%;width:${w.toFixed(1)}%"></i></span><span class="bm-k"><span>tougher</span><b class="${up ? 'up' : 'dn'}">${up ? '+' : '−'}${Math.abs(pc)}%</b><span>easier</span></span></span>
      <p class="pc-fn">${esc(p.opp)} gave up ${Math.abs(pc)}% ${up ? 'more' : 'fewer'} ${esc(S.lab)} than average to ${dv.pos} (this season, blended with last while the sample is small).</p></section>`; })() : '';
  const two = muBox || formBox ? `<div class="pc-two${muBox && formBox ? '' : ' one'}">${muBox}${formBox}</div>` : '';
  $('#statpanel').innerHTML = propSec + outlook + two;

  drawVsPos();
  drawRecent();

  // all his props: tap a row to switch the card to that stat
  const cp = document.getElementById('cprops');
  cp.innerHTML = props.length ? `<section class="pc-sec"><h4 class="pc-h">His props tonight <small>tap one to switch</small></h4><div class="pc-props">${props.map(x => {
    const ch = propChance(x);
    return `<button type="button" class="pc-pr${x.flagged ? ' fl' : ''}" data-stat="${mk(x)}" aria-pressed="${mk(x) === k}"><span class="pc-prn"><b>${esc(x.side)} ${esc(x.line)} ${esc(x.market)}</b><small>${esc(x.side === 'Over' ? x.overOdds : x.underOdds)}${x.guard ? ' · check' : ''}</small></span>
      <span class="pc-bar"><i style="width:${(ch || 0) * 100}%"></i></span><span class="pc-prc"><b>${pct(ch)}</b><small>chance</small></span><span class="lp ${x.edge != null && x.edge > 0 ? 'e' : 'n'}">${x.edge == null ? '—' : sgn(x.edge * 100, 1) + '%'}</span><span class="pc-prr">${badge(x.grade === 'W' || x.grade === 'L' ? x : null)}</span></button>`;
  }).join('')}</div></section>` : '';
}

/* what his position has done against tonight's opponent lately (BoardWebApp sends each slate team's last 5 games) */
let VS_ALL = false;
const VS_SHOW = 6;
const vsVal = (x, k) => k === 'MIN' ? x.min : k === 'PR' ? x.PTS + x.REB : k === 'PA' ? x.PTS + x.AST : k === 'RA' ? x.REB + x.AST : x[k];
function vsPosHtml(p, k) {
  if (!B.vsPos) return '';                                  // older server build: leave the section out
  const pos = String(p.pos || '').charAt(0), P = POSN[pos];
  if (!P || !p.opp) return '';
  const S = STATS.find(s => s.k === k) || STATS[1], fmt = v => fmtStat(k, v);
  const Pc = P.charAt(0).toUpperCase() + P.slice(1);
  const projMin = ifPlays(p, 'MIN') || p.expMin || 0, floor = projMin > 0 && projMin < 22 ? 15 : 20;
  const me = String(p.id).replace(/^ESPN:/, ''), all = B.vsPos[p.opp] || [];
  const games = [...new Set(all.map(x => x.gid))].length;
  const rows = all.filter(x => x.pos === pos && x.id !== me && x.min >= floor && vsVal(x, k) != null)
    .sort((a, b) => a.d < b.d ? 1 : a.d > b.d ? -1 : vsVal(b, k) - vsVal(a, k));
  const head = `<h4 class="pc-h">${esc(Pc)} vs ${esc(p.opp)} lately <small>${esc(S.name)}</small></h4>`;
  const foot = `<p class="pc-fn">${esc(Pc)} who played ${floor}+ minutes${floor === 15 ? ' (15+ because he\'s projected under 22)' : ''} in ${esc(p.opp)}'s ${games === 1 ? 'last game' : games ? `last ${games} games` : 'recent games'} this season. <i>Their line</i> is the prop line logged for that player that night; blank when there wasn't one.</p>`;
  if (!rows.length) return `<section class="pc-sec pc-vs">${head}<p class="muted">${games ? `No ${P} have played ${floor}+ minutes against ${esc(p.opp)} yet this season.` : `${esc(p.opp)} hasn't played a game yet this season.`}</p></section>`;

  const prop = propFor(p, k), lineV = prop && prop.line != null ? Number(prop.line) : null;
  const bench = lineV != null ? lineV : ifPlays(p, k);
  const last = String(p.name || '').split(' ').filter(w => !/^(Jr\.?|Sr\.?|II|III|IV)$/.test(w)).pop() || p.name;
  const benchLab = bench == null ? '' : lineV != null ? `${esc(last)}'s ${esc(prop.line)}` : `his projected ${fmt(bench)}`;
  const own = x => { const L = (x.lines || {})[k]; if (!L || L[0] == null || L[0] === '') return null;
    const r = L[1] === 'OVER' || L[1] === 'UNDER' || L[1] === 'PUSH' ? L[1] : vsVal(x, k) > L[0] ? 'OVER' : vsVal(x, k) < L[0] ? 'UNDER' : 'PUSH'; return { line: L[0], r }; };
  const n = rows.length, vals = rows.map(x => vsVal(x, k)), avg = vals.reduce((a, b) => a + b, 0) / n;
  const avgMin = rows.reduce((a, x) => a + x.min, 0) / n;
  const hits = bench != null ? vals.filter(v => v > bench).length : null;
  const owns = rows.map(own).filter(Boolean), ownOver = owns.filter(o => o.r === 'OVER').length;

  // takeaway: does it back the model's side? (an early sample just says so)
  let tone = 'e', lab = 'Context';
  if (n < 3) { tone = 'e'; lab = 'Early'; }
  else if (prop && hits != null) {
    const rate = hits / n, overSide = prop.side === 'Over';
    if (overSide ? rate >= 0.6 : rate <= 0.4) { tone = 'g'; lab = 'Good sign'; }
    else if (overSide ? rate <= 0.4 : rate >= 0.6) { tone = 'w'; lab = 'Watch'; }
    else lab = 'Mixed';
  }
  const verb = k === 'MIN' ? 'played' : k === '3PM' ? 'made' : 'put up';
  const statWord = k === 'MIN' ? 'minutes' : k === '3PM' ? 'threes' : S.lab;
  let tk = `${esc(Pc)} have ${verb} <b>${fmt(avg)}</b> ${esc(statWord)} a game against ${esc(p.opp)}`;
  if (hits != null) tk += `. <b>${hits} of ${n}</b> topped ${benchLab}`;
  tk += owns.length ? `${hits != null ? ', and' : '.'} <b>${ownOver} of ${owns.length}</b> went over their own line.` : '.';
  if (n < 3) tk += ` Only ${n} so far, so read it lightly.`;
  else if (prop && tone !== 'e') tk += tone === 'g' ? ` That leans the same way as the model's ${esc(prop.side.toLowerCase())}.` : ` That cuts against the model's ${esc(prop.side.toLowerCase())}.`;

  const shown = VS_ALL ? rows : rows.slice(0, VS_SHOW);
  const md = d => String(d || '').slice(5).replace('-', '/').replace(/^0/, '');
  const chip = r => `<span class="pc-ou ${r === 'OVER' ? 'o' : r === 'UNDER' ? 'u' : 'p'}">${r === 'OVER' ? 'Over' : r === 'UNDER' ? 'Under' : 'Push'}</span>`;
  const body = shown.map(x => { const v = vsVal(x, k), o = own(x), hit = bench != null ? v > bench : null;
    return `<tr><td class="l"><span class="pc-vp">${hsDot({ id: x.id, team: x.tm, name: x.name }, 'sm')}<span><b>${esc(x.name)}</b><small>${esc(x.tm)} · ${md(x.d)}<span class="pc-mm"> · ${Math.round(x.min)} min</span><span class="pc-ha"> · ${x.home ? 'home' : 'away'}</span></small></span></span></td>
      <td class="mn">${Math.round(x.min)}</td><td class="on"><b>${fmt(v)}</b></td>
      <td class="ol">${o ? `${esc(o.line)} ${chip(o.r)}` : '<span class="mut">—</span>'}</td>
      <td class="vt">${hit == null ? '' : hit ? '<span class="pc-ck y" title="Topped it">✓</span>' : '<span class="pc-ck n" title="Didn\'t top it">✗</span>'}</td></tr>`; }).join('');
  return `<section class="pc-sec pc-vs">${head}
    <p class="tk ${tone}"><i>${lab}</i><span>${tk}</span></p>
    <div class="rt-wrap"><table class="rtb pc-vt"><thead><tr><th class="l">Player</th><th class="mn">Min</th><th class="on">${esc(k)}</th><th class="ol">Their line</th><th class="vt">${bench == null ? '' : lineV != null ? `Over ${esc(prop.line)}?` : 'Over proj?'}</th></tr></thead>
    <tbody>${body}<tr class="tot"><td class="l">Average${n > 1 ? ` <small>${n} players</small>` : ''}</td><td class="mn">${Math.round(avgMin)}</td><td class="on"><b>${fmt(avg)}</b></td><td class="ol">${owns.length ? `${ownOver} of ${owns.length} over` : '<span class="mut">—</span>'}</td><td class="vt">${hits == null ? '' : `${hits}/${n}`}</td></tr></tbody></table></div>
    ${!VS_ALL && n > VS_SHOW ? `<p class="more-row"><button type="button" class="chip" data-vsall="1">Show all ${n}</button></p>` : ''}
    ${foot}</section>`;
}
function drawVsPos() {
  const el = document.getElementById('vspos');
  if (el && CARD_P) el.innerHTML = vsPosHtml(CARD_P, cardStat);
}

/* recent games for the chosen stat */
function recentHtml(p) {
  const all = p.log || [], L = p.last;
  const wrap = (h, inner) => `<section class="pc-sec">${h}${inner}</section>`;
  if (!all.length) {
    if (L) {
      const moved = L.team && L.team !== p.team;
      return wrap('<h4 class="pc-h">His recent games</h4>', `<p class="muted">No 2026–27 games yet. ${moved ? (L.team === 'MULTI' ? 'Played for more than one team last season. ' : `Played for ${esc(L.team)} last season. `) : ''}${L.gp} games last season; over his final 5 he averaged ${f1(L.minL5)} min and ${f1(L.ptsL5)} pts. His games chart here once he plays.</p>`);
    }
    return wrap('<h4 class="pc-h">His recent games</h4>', `<p class="muted">No NBA games on file yet.${/rookie/i.test(p.conf) ? ' Projected from his draft slot.' : ''} His games chart here once he plays.</p>`);
  }
  const S = STATS.find(s => s.k === cardStat) || STATS[1];
  const n = Math.min(cardN, all.length), wide = n > 5;
  const lg = all.slice(0, n), games = lg.slice().reverse();          // log is newest first; chart reads left to right
  const vals = games.map(S.f);
  const prop = propFor(p, S.k);
  const lineV = prop && prop.line != null ? Number(prop.line) : null, proj = ifPlays(p, S.k);
  const bench = lineV != null ? lineV : proj;                           // what each bar is judged against
  const max = Math.max(1, ...vals, ...[proj, lineV].filter(v => v != null)) * 1.15;
  const H = v => Math.max(3, v / max * 100);
  const fmt = v => fmtStat(S.k, v);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const hits = bench != null ? vals.filter(v => v > bench).length : null;
  const color = tcolor(p.team);
  const nTog = all.length > 5 ? `<span class="seg">${[5, 10].map(k => `<button type="button" data-n="${k}" aria-pressed="${cardN === k}">Last ${k}</button>`).join('')}</span>` : '';
  const sum = `Averaging <b>${fmt(avg)}</b> ${esc(S.lab)}` + (bench != null ? ` · over ${lineV != null ? 'tonight\'s line' : 'his projection'} (${fmt(bench)}) in <b>${hits} of ${n}</b>` : '');
  const cols = ['MIN', 'PTS', 'REB', 'AST', '3PM'].concat(['MIN', 'PTS', 'REB', 'AST', '3PM'].includes(S.k) ? [] : [S.k]);
  const cell = (g, k) => fmtStat(k, STATS.find(s => s.k === k).f(g));
  return wrap(`<div class="rhead"><h4 class="pc-h">His last ${n} game${n === 1 ? '' : 's'} <small>${esc(S.name)}</small></h4>${nTog}</div>`, `
    <p class="rsum">${sum}</p>
    <div class="games-chart">
      <div class="bars${wide ? ' n10' : ''}">
        ${games.map((g, i) => { const v = vals[i]; return `<i class="${bench != null && v <= bench ? 'under' : ''}${H(v) < 22 ? ' lo' : ''}" style="height:${H(v)}%;background:${esc(color)}" title="${esc(g.date)} vs ${esc(g.opp)}: ${fmt(v)} ${esc(S.lab)}, ${Math.round(g.min)} min"><em>${fmt(v)}</em></i>`; }).join('')}
        ${proj != null ? `<span class="ref proj" style="bottom:${H(proj)}%"></span>` : ''}
        ${lineV != null ? `<span class="ref line" style="bottom:${H(lineV)}%"></span>` : ''}
      </div>
      <div class="labels${wide ? ' n10' : ''}">${games.map(g => `<span>${esc(g.opp)}${wide || S.k === 'MIN' ? '' : `<small>${Math.round(g.min)} min</small>`}</span>`).join('')}</div>
      <p class="legend-c">${proj != null ? `<span><i class="lk proj"></i>Projection if he plays, ${fmt(proj)}</span>` : ''}${lineV != null ? `<span><i class="lk line"></i>Tonight's line, ${esc(prop.line)}</span>` : ''}${bench != null ? `<span><i class="lk fade" style="background:${esc(color)}"></i>Faded: at or under the ${lineV != null ? 'line' : 'projection'}</span>` : ''}</p>
    </div>
    <div class="rt-wrap"><table class="rtb pc-gl"><thead><tr><th class="l">Date</th><th class="l">Opp</th>${cols.map(k => `<th class="${k === S.k ? 'on' : ''}">${k}</th>`).join('')}</tr></thead><tbody>
    ${lg.map(g => `<tr><td class="l">${esc(g.date.slice(5).replace('-', '/'))}</td><td class="l">${esc(g.opp)}</td>${cols.map(k => `<td class="${k === S.k ? 'on' : ''}">${k === S.k ? `<b>${cell(g, k)}</b>` : cell(g, k)}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>`);
}
function drawRecent() {
  const el = document.getElementById('recent');
  if (el && CARD_P) el.innerHTML = recentHtml(CARD_P);
}
// one listener for the whole card: stat tiles, prop rows, last 5 / last 10
function wireCard() {
  $('#card').addEventListener('click', e => {
    if (e.target === e.currentTarget) { e.currentTarget.close(); return; }
    const s = e.target.closest('[data-stat]');
    if (s) { cardStat = s.dataset.stat; saveCardPrefs(); drawStat(); return; }
    const n = e.target.closest('[data-n]');
    if (n) { cardN = Number(n.dataset.n); saveCardPrefs(); drawRecent(); }
    if (e.target.closest('[data-vsall]')) { VS_ALL = true; drawVsPos(); }
  });
}

/* ---------- screens and the router ----------
   Hashes: '' = Today, 'g/<id>' or 'g/<id>/<tab>' = one game, 'props', 'players', 'record'.
   Inside Apps Script the page sits in an iframe, so google.script.history keeps the browser's
   back button and the address bar in step; anywhere else plain history.pushState does the same. */
let VIEW = { name: 'today' };
const GTAB = 'overview';
function parseHash(h) {
  const [a, b, c] = String(h || '').replace(/^#/, '').split('/');
  if (a === 'g' && b) return { name: 'game', id: b, tab: GAME_TABS.some(t => t[0] === c) ? c : GTAB };
  if (a === 'props' || a === 'players' || a === 'record' || a === 'teams') return { name: a };
  return { name: 'today' };
}
const hashOf = v => v.name === 'game' ? 'g/' + v.id + (v.tab && v.tab !== GTAB ? '/' + v.tab : '') : v.name === 'today' ? '' : v.name;
const gsHistory = () => window.google && google.script && google.script.history;
function navigate(hash, replace) {
  const v = parseHash(hash);
  try {
    if (gsHistory()) google.script.history[replace ? 'replace' : 'push'](null, null, hashOf(v));
    else history[replace ? 'replaceState' : 'pushState'](null, '', '#' + hashOf(v));
  } catch (e) {}
  show(v);
}
function show(v) {
  if (v.name === 'game' && !(B.games || []).some(g => g.id === v.id)) v = { name: 'today' };   // old link to a past slate
  const sameGame = VIEW.name === 'game' && v.name === 'game' && VIEW.id === v.id;
  const prev = VIEW; VIEW = v;
  document.querySelectorAll('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.view === (v.name === 'game' ? 'today' : v.name)));
  document.body.dataset.view = v.name;
  if (sameGame) {                                   // switching tabs inside a game: redraw only the body
    document.querySelectorAll('.seg-tabs [data-tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === v.tab)));
    if (prev.tab !== v.tab) { const gp = document.querySelector('.seg-tabs'); if (gp && gp.getBoundingClientRect().top < 0) gp.scrollIntoView(); }
    document.querySelectorAll('.gswitch [data-go]').forEach(b => { const id = b.dataset.go.split('/')[1]; b.dataset.go = 'g/' + id + (v.tab !== GTAB ? '/' + v.tab : ''); });
    $('#gpBody').innerHTML = gameTab((B.games || []).find(g => g.id === v.id), v.tab);
    afterDraw();
    return;
  }
  for (const k in STRIPS) delete STRIPS[k];
  let html;
  if (v.name === 'game') { PSTATE.game = { mkt: 'ALL', side: 'ALL', more: false }; html = renderGamePage(B.games.find(g => g.id === v.id), v.tab); }
  else if (v.name === 'props') html = renderProps();
  else if (v.name === 'players') html = `<div id="pl">${renderPlayers()}</div>`;
  else if (v.name === 'record') html = renderRecordPage();
  else if (v.name === 'teams') html = renderTeams();
  else html = renderToday();
  $('#main').innerHTML = html;
  afterDraw();
  if (prev.name !== v.name || prev.id !== v.id) window.scrollTo(0, 0);
}
function afterDraw() {
  drawStrips();
  wirePlayers();
  wirePropTables();
  const sc = document.querySelector('.gswitch [aria-pressed="true"]');
  if (sc && sc.scrollIntoView) { const box = sc.parentNode; box.scrollLeft = sc.offsetLeft - box.clientWidth / 2 + sc.clientWidth / 2; }
}
/* masthead: the season record up top, and a ticker of tonight's games and last night's flagged results */
function drawMast() {
  const S = recSummary('season'), mr = $('#mastrec'), tk = $('#ticker');
  if (mr) mr.innerHTML = S && S.n ? `<div><b>${S.w}–${S.l}</b><small>flagged game picks</small></div><div><b class="${S.u >= 0 ? 'g' : 'r'}">${sgn(S.u, 1)}u</b><small>season units</small></div>${S.clPct != null ? `<div><b>${pct(S.clPct)}</b><small>beat the close</small></div>` : ''}` : '';
  if (!tk) return;
  const items = (B.games || []).map(g => {
    const fin = (B.finals || {})[g.id], final = !!(fin && g.away in fin && g.home in fin), live = !final && /IN PROGRESS|HALFTIME|END/.test(String(g.status || '').toUpperCase());
    return `<button type="button" class="tk-i" data-go="g/${esc(g.id)}">${final ? `<b>${esc(g.away)} ${fin[g.away]} · ${esc(g.home)} ${fin[g.home]}</b><span>Final</span>` : `${live ? '<span class="lv">Live</span>' : ''}<b>${esc(g.away)} @ ${esc(g.home)}</b>${live ? '' : `<span>${esc(tipCT(g.tip).replace(' CT', ''))}</span>`}`}</button>`;
  });
  const R = B.rec, last = R && R.last ? R.last.filter(x => x.t === 'A' && x.flag === 'Y') : [];
  const gm = (R && R.games) || {};
  const tkTxt = x => { const g = gm[x.g], mu = g ? g.away + '@' + g.home + ' ' : '';
    return x.m === 'ML' ? `${x.side} ML ${x.odds > 0 ? '+' : ''}${x.odds}` : /GAME TOTAL|1H TOTAL/.test(x.m) ? mu + recPickTxt(x) : recPickTxt(x); };
  if (last.length) items.push(`<span class="tk-h">Last night</span>` + last.map(x => `<span class="tk-i"><b>${esc(tkTxt(x))}</b><span class="${x.hit ? 'w' : 'l'}">${x.hit ? '✓' : '✗'}</span></span>`).join(''));
  tk.innerHTML = items.length ? `<div class="tk-track">${items.join('')}<span class="tk-gap"></span>${items.join('')}<span class="tk-gap"></span></div>` : '';
  tk.hidden = !items.length;
  const track = tk.querySelector('.tk-track');
  // a steady reading speed (about 45 px a second) however long the strip is; half the track is one full loop
  if (track) track.style.setProperty('--dur', Math.max(25, Math.round((track.scrollWidth / 2) / 45)) + 's');
}
function render(data) {
  B = data;
  (B.players || []).forEach(p => { if (p.id) BY_ID[p.id] = p; });
  const d = new Date(B.date + 'T12:00:00Z');
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(d);
  const n = (B.games || []).length;
  $('#date').innerHTML = `<strong>${esc(day)}</strong>, ${n} game${n === 1 ? '' : 's'}. Data as of ${esc(ctTime(B.updated))} CT.${B.oddsAt ? ` Lines as of ${esc(ctStamp(B.oddsAt))}.` : ''}`;
  drawMast();
  if (!window.__wired) {
    window.__wired = true;
    // every [data-go] element (game rows, back button, game switcher, tab bar) routes; player names open the card
    document.addEventListener('click', e => {
      const p = e.target.closest('.pl'); if (p) { openCard(p.dataset.pid, p.dataset.mkt); return; }
      if (e.target.closest('[data-spotsall]')) { spotsAll = !spotsAll; const y = window.scrollY; $('#spots').outerHTML = renderSpots(); window.scrollTo(0, y); return; }
      const mg = e.target.closest('[data-mkgo]'); if (mg) { const el = document.getElementById(mg.dataset.mkgo); if (el) { const d = el.closest('details'); if (d) d.open = true; el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); } return; }
      const li = e.target.closest('[data-lockinfo]'); if (li) { const n = li.closest('.bn').querySelector('.bn-note'); if (n) n.hidden = !n.hidden; return; }
      const t = e.target.closest('.seg-tabs [data-tab], .ov [data-tab]');
      if (t && VIEW.name === 'game') { navigate(hashOf({ name: 'game', id: VIEW.id, tab: t.dataset.tab }), true); return; }
      const tw = e.target.closest('[data-twin]'); if (tw) { teamWin = tw.dataset.twin; redrawTeamBits(); return; }
      const tsd = e.target.closest('[data-tside]'); if (tsd) { teamSide = tsd.dataset.tside; redrawTeamBits(); return; }
      const rpx = e.target.closest('[data-recpricing]'); if (rpx) { recPricing = rpx.dataset.recpricing; const y = window.scrollY; $('#main').innerHTML = renderRecordPage(); window.scrollTo(0, y); return; }
      const rp = e.target.closest('[data-recper]'); if (rp) { recPer = rp.dataset.recper; $('#main').innerHTML = renderRecordPage(); return; }
      { const redraw = () => { const y = window.scrollY; $('#main').innerHTML = renderRecordPage(); window.scrollTo(0, y); };
        const a = e.target.closest('[data-pgdate],[data-pggame],[data-pgkind],[data-pgmk],[data-pgsort],[data-pgall],[data-whkind],[data-whdim]');
        if (a) { const d = a.dataset;
          if (d.pgdate) { pgDate = d.pgdate; pgGame = ''; pgAll = false; }
          else if (d.pggame) { pgGame = d.pggame; pgAll = false; }
          else if (d.pgkind) { pgKind = d.pgkind; pgMk = 'ALL'; pgAll = false; }
          else if (d.pgmk) { pgMk = d.pgmk; pgAll = false; }
          else if (d.pgsort) pgSort = d.pgsort;
          else if ('pgall' in d) pgAll = !pgAll;
          else if (d.whkind) { whKind = d.whkind; whDim = 'ms'; }
          else if (d.whdim) whDim = d.whdim;
          redraw(); return; } }
      const rg = e.target.closest('[data-recgame]'); if (rg) { recGame = rg.dataset.recgame; const y = window.scrollY; $('#main').innerHTML = renderRecordPage(); window.scrollTo(0, y); return; }
      if (e.target.closest('[data-recflag]')) { recFlagOnly = !recFlagOnly; const y = window.scrollY; $('#main').innerHTML = renderRecordPage(); window.scrollTo(0, y); return; }
      const tso = e.target.closest('[data-tsort]'); if (tso) { if (teamSort === tso.dataset.tsort) teamDir = teamDir === 'desc' ? 'asc' : 'desc'; else { teamSort = tso.dataset.tsort; teamDir = 'desc'; } redrawTeamBits(); return; }
      const pc = e.target.closest('td[data-cell]'); if (pc) { posCell = posCell === pc.dataset.cell ? '' : pc.dataset.cell; teamOpen = ''; redrawTeamBits(); return; }
      if (e.target.closest('[data-ptoday]')) { posToday = !posToday; redrawTeamBits(); return; }
      const bsd = e.target.closest('[data-bside]'); if (bsd) { bestSide = bsd.dataset.bside; bestSort = 'mu'; bestDir = bestSide === 'help' ? 'desc' : 'asc'; redrawTeamBits(); return; }
      const bst = e.target.closest('[data-bstat]'); if (bst) { bestStat = bst.dataset.bstat; redrawTeamBits(); return; }
      const bso = e.target.closest('[data-bsort]'); if (bso) { if (bestSort === bso.dataset.bsort) bestDir = bestDir === 'desc' ? 'asc' : 'desc'; else { bestSort = bso.dataset.bsort; bestDir = 'desc'; } redrawTeamBits(); return; }
      const tr = e.target.closest('tr.trow'); if (tr) { posCell = ''; teamOpen = teamOpen === tr.dataset.team ? '' : tr.dataset.team; redrawTeamBits(); return; }
      const g = e.target.closest('[data-go]'); if (g) navigate(g.dataset.go);
    });
    document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.grow')) { e.preventDefault(); navigate(e.target.dataset.go); } });
    wireCard();
    if (gsHistory()) google.script.history.setChangeHandler(ev => show(parseHash(ev.location && ev.location.hash)));
    else window.addEventListener('popstate', () => show(parseHash(location.hash)));
  }
  show(parseHash(location.hash));
  // inside Apps Script the real address (with its #hash) belongs to the outer page; ask for it
  if (window.google && google.script && google.script.url) {
    try { google.script.url.getLocation(loc => { const v = parseHash(loc && loc.hash); if (hashOf(v) !== hashOf(VIEW)) show(v); }); } catch (e) {}
  }
}
const FORM_STATS = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['tpm', '3PM'], ['expMin', 'MIN']];
function formTable(list) {   // same rows as Tonight: headshot, team, who he faces; last 3 / 5 / 10 / season, the trend, tonight
  const k = { pts: 'PTS', reb: 'REB', ast: 'AST', tpm: '3PM', expMin: 'MIN' }[sortKey] || 'PTS';   // best-prop sort shows points form
  if (!list.length) return '<div class="empty">No players to show.</div>';
  const head = `<div class="prow frow ph"><i></i><span></span><span></span><span class="ph-n">Player</span>${['Last 3', 'Last 5', 'Last 10', 'Season', 'Trend', 'Tonight'].map(n => `<span class="ph-n c">${n}</span>`).join('')}</div>`;
  return `<div class="plist">${head}${list.map(p => { const fm = formFor(p, k), v = fm ? fm.vals : [null, null, null, null];
    const tr = v[1] != null && v[3] ? (v[1] / v[3] - 1) : null, cls = tr == null ? '' : tr >= 0.1 ? 'up' : tr <= -0.1 ? 'dn' : '';
    const tonight = k === 'MIN' ? p.minIf : ifPlays(p, k);
    const cell = (x, lab, c) => `<span class="pr-st${c ? ' ' + c : ''}"><b>${x}</b><small>${lab}</small></span>`;
    return `<button type="button" class="prow frow pl" data-pid="${esc(p.id)}"${k === 'MIN' ? '' : ` data-mkt="${esc(k)}"`} style="--tc:${esc(tcolor(p.team))}">
      <i class="pr-e"></i>${hsDot(p)}${teamMark(p.team)}
      <span class="pr-nm"><b>${esc(p.name)}</b><small>${esc(p.pos)} · ${oppTxt(p.team, p.opp)}</small><span class="pr-tags"><span class="cf">${fm ? (fm.cur ? `${fm.gp} games this season` : 'last season') : 'no games yet'}</span></span></span>
      ${cell(fmtStat(k, v[0]), 'last 3')}${cell(fmtStat(k, v[1]), 'last 5')}${cell(fmtStat(k, v[2]), 'last 10')}${cell(fmtStat(k, v[3]), 'season', 'sz')}
      ${cell(tr == null ? '—' : (tr >= 0 ? '▲' : '▼') + Math.abs(tr * 100).toFixed(0) + '%', 'trend', 'tr ' + cls)}${cell(fmtStat(k, tonight), 'tonight', 'mn')}
    </button>`; }).join('')}</div>`;
}
function wirePlayers() {
  document.querySelectorAll('#players [data-plview]').forEach(b => b.onclick = () => { plView = b.dataset.plview; redrawPlayers(); });
  document.querySelectorAll('#players .chip').forEach(c => c.onclick = () => { teamFilter = c.dataset.team; redrawPlayers(); });
  const s = document.getElementById('sort'); if (s) s.onchange = () => { sortKey = s.value; plDir = 'desc'; redrawPlayers(); };
  document.querySelectorAll('#players [data-fstat]').forEach(b => b.onclick = () => { sortKey = b.dataset.fstat; plDir = 'desc'; redrawPlayers(); });
  document.querySelectorAll('#players [data-psort]').forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.psort; if (k === sortKey) plDir = plDir === 'desc' ? 'asc' : 'desc'; else { sortKey = k; plDir = 'desc'; } redrawPlayers(); });
  const a = document.getElementById('showAll'); if (a) a.onclick = () => { showAll = true; redrawPlayers(); };
}
function redrawPlayers() { $('#pl').innerHTML = renderPlayers(); wirePlayers(); }
function showError(e) {
  $('#main').innerHTML = `<div class="empty" style="margin-top:30px"><b>Couldn't load the board.</b> ${esc(e && e.message || e)}. Reload the page. If it keeps happening, open Apps Script, run <b>nbaBoardTest</b>, and check the log for the exact error.</div>`;
}
function safeRender(data) {
  try { render(data); }
  catch (e) { showError({ message: 'The page hit a problem drawing the data (' + (e && e.message || e) + ')' }); console.error(e); }
}
window.__MAIN__ = 2;
let slateBusy = false, slateLastLoaded = 0;
async function loadSlate() {
  if (slateBusy) return;
  slateBusy = true;
  const refresh = document.getElementById('refresh');
  refresh.hidden = false; refresh.textContent = 'Loading…';
  const status = document.getElementById('app-status');
  status.hidden = false; status.textContent = 'Loading the latest saved board…';
  try {
    const reply = await new Promise((resolve, reject) => {
      const callback = 'slate_cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      const tag = document.createElement('script');
      let done = false;
      const clean = () => { clearTimeout(timer); tag.remove(); delete window[callback]; };
      const fail = () => { if (done) return; done = true; clean(); reject(new Error('Could not reach the data endpoint. Check your connection, publish the updated BoardWebApp.gs as a new version, and set web-app access to Anyone.')); };
      const timer = setTimeout(fail, 45000);
      window[callback] = value => { if (done) return; done = true; clean(); resolve(value); };
      tag.onerror = fail;
      const endpoint = new URL(window.SLATE_ENDPOINT);
      endpoint.searchParams.set('slate_api', '1'); endpoint.searchParams.set('callback', callback);
      endpoint.searchParams.set('_', Date.now());
      tag.src = endpoint.href; document.head.appendChild(tag);
    });
    if (!reply || !reply.ok) throw new Error(reply && reply.error || 'Invalid server response.');
    if (!reply.data || !/^\d{4}-\d{2}-\d{2}$/.test(reply.data.date)) throw new Error('The snapshot has no valid slate date. Rebuild it in Apps Script.');
    Object.keys(BY_ID).forEach(key => delete BY_ID[key]);
    render(reply.data);
    window.__BOARD__ = reply.data;
    slateLastLoaded = Date.now();
    const age = Date.now() - Date.parse(reply.savedAt);
    // The automation saves the board at 8 AM and every 30 minutes on game nights (from an hour before the first tip to 1 AM),
    // so a quiet afternoon is normal. Warn only when a save was due: game-night hours with a board over 90 minutes old,
    // or any board over 12 hours old.
    const ctHour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Chicago' }).format(new Date()));
    const gameNight = ctHour >= 19 || ctHour < 1;
    status.textContent = age > 12 * 60 * 60 * 1000 ? 'Saved board is over 12 hours old. Check the Apps Script automation. Refresh only reloads the saved board.'
      : gameNight && age > 90 * 60 * 1000 ? 'Saved board is over 90 minutes old on a game night. Check the Apps Script automation. Refresh only reloads the saved board.' : '';
    status.hidden = !status.textContent;
    document.getElementById('build').textContent = 'The Slate app · server ' + reply.build + ' · Snapshot ' + new Date(reply.savedAt).toLocaleString();
  } catch (err) {
    status.hidden = false; status.textContent = (B ? 'Showing the previous board. ' : '') + err.message;
    const loading = document.querySelector('.loading');
    if (loading) loading.textContent = 'The board could not load. See the message above and tap Refresh to retry.';
  } finally {
    slateBusy = false; refresh.textContent = 'Refresh';
  }
}
const slateRefresh = document.getElementById('refresh');
slateRefresh.removeAttribute('target'); slateRefresh.href = '#';
slateRefresh.onclick = event => { event.preventDefault(); loadSlate(); };
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && Date.now() - slateLastLoaded > 30 * 60 * 1000) loadSlate();
});
loadSlate();
