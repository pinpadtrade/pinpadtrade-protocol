import { REGISTER } from './register-data.js';
import {
  recordView, safeText, ownMode, fmtUsd, fmtPrice, fmtPct, dirOf, DASH, shorten,
} from './core.js';
import { createMarket } from './market.js';
import { reduced, initReveal, initSpotlight, initProgress, initParallax, initMesh, initCarousel, setNumber } from './motion.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BRAND_LOGO = 'assets/logo.png';

const ICON = {
  x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
  github: '<svg viewBox="0 0 16 16" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>',
  copy: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="2"/><path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5"/></svg>',
};

/* ---------- register-driven chrome ---------- */
const V = Object.fromEntries(Object.entries(REGISTER).map(([k, r]) => [k, recordView(r)]));
document.documentElement.dataset.ca = REGISTER.ca.state;

function socialLink(key) {
  const v = V[key];
  if (v.active) return `<a class="icon-btn" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(v.label)} ${esc(v.handle)}" data-record="${key}" data-state="stated">${ICON[key]}</a>`;
  return `<span class="icon-btn inert" role="img" aria-label="${esc(v.label)} ${v.text}" aria-disabled="true" data-record="${key}" data-state="${REGISTER[key].state}">${ICON[key]}</span>`;
}
$('#socials').innerHTML = socialLink('x') + socialLink('github');
$('#foot-social').innerHTML = '';
$('#hero-chain').textContent = V.chain.value + ' mainnet';

$('#hero-cta').innerHTML = `<a class="btn primary lg" href="#market">See the board</a>` +
  (V.x.active ? `<a class="btn lg" href="${esc(V.x.url)}" target="_blank" rel="noopener noreferrer">Follow ${esc(V.x.handle)}</a>`
              : `<span class="btn lg inert" aria-disabled="true">X ${V.x.text}</span>`);

/* CA slot */
const slot = $('#ca-slot');
let copyTimer = 0;
if (V.ca.active) {
  slot.innerHTML = `<div class="ca" data-state="stated"><span class="ca-label">${esc(V.ca.label)}</span>
    <button type="button" class="ca-btn" id="ca-btn" aria-label="Copy contract address"><span class="ca-val" id="ca-val">${esc(V.ca.value)}</span><span class="ca-act">${ICON.copy}<b id="ca-msg">Copy</b></span></button>
    <span class="sr" id="ca-live" aria-live="polite"></span></div>`;
  $('#ca-btn').addEventListener('click', async () => {
    const text = V.ca.value;
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement('textarea'); t.value = text; t.style.cssText = 'position:fixed;opacity:0'; document.body.append(t); t.select(); try { document.execCommand('copy'); } catch {} t.remove(); }
    const b = $('#ca-btn'); b.classList.add('done'); $('#ca-msg').textContent = 'Copied'; $('#ca-live').textContent = 'Address copied';
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { b.classList.remove('done'); $('#ca-msg').textContent = 'Copy'; $('#ca-live').textContent = ''; }, 1800);
  });
} else {
  slot.innerHTML = `<div class="ca inert" data-state="${REGISTER.ca.state}"><span class="ca-label">${esc(V.ca.label)}</span><span class="ca-val" aria-disabled="true">${V.ca.text}</span></div>`;
}

/* Links chips + footer columns */
function chip(key, text) {
  const v = V[key];
  if (!v.active) return `<div class="chip spot inert" data-record="${key}" data-state="${REGISTER[key].state}"><span>${esc(v.label)}</span><b>${v.text}</b></div>`;
  const shown = text ?? v.value ?? v.handle ?? v.host;
  const inner = `<span>${esc(v.label)}</span><b>${esc(shown)}</b>`;
  return v.url && key !== 'rpc' && key !== 'market'
    ? `<a class="chip spot" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" data-record="${key}" data-state="stated">${inner}</a>`
    : `<div class="chip spot" data-record="${key}" data-state="stated">${inner}</div>`;
}
$('#chips').innerHTML = ['chain', 'rpc', 'ca', 'x', 'github', 'market'].map((k, i) =>
  chip(k, k === 'ca' && V.ca.active ? shorten(V.ca.value) : undefined).replace('class="chip', `style="--i:${i}" data-reveal class="chip`)).join('');

function footItem(key) {
  const v = V[key];
  if (!v.active) return `<span class="fi inert" data-record="${key}">${esc(v.label)} · ${v.text}</span>`;
  const shown = key === 'ca' ? shorten(v.value) : v.value ?? v.handle ?? v.host;
  return v.url && key !== 'rpc' && key !== 'market'
    ? `<a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(v.label)} · ${esc(shown)}</a>`
    : `<span class="fi">${esc(v.label)} · ${esc(shown)}</span>`;
}
$('#foot-net').insertAdjacentHTML('beforeend', ['chain', 'rpc', 'ca'].map(footItem).join(''));
$('#foot-com').insertAdjacentHTML('beforeend', ['x', 'github'].map(footItem).join(''));

/* ---------- board ---------- */
const board = $('#board');
const ticker = $('#ticker');
const note = $('#feed-note');
let sort = 'boosted', filter = 'all', view = 'list';
let last = null; // last emitted market payload
const PILL = { loading: 'Syncing', live: 'Live', retry: 'Reconnecting', error: 'Offline' };

function tileHTML(logos, label) {
  const letter = esc((label || '?').trim().charAt(0).toUpperCase() || '?');
  const src = (logos || []).filter(Boolean);
  return `<span class="tile" data-logos='${esc(JSON.stringify(src))}'><i>${letter}</i>${src.length ? `<img alt="" referrerpolicy="no-referrer" src="${esc(src[0])}" data-n="0">` : ''}</span>`;
}
document.addEventListener('error', (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.closest('.tile')) return;
  const list = JSON.parse(img.closest('.tile').dataset.logos || '[]');
  const n = Number(img.dataset.n || 0) + 1;
  if (n < list.length) { img.dataset.n = n; img.src = list[n]; } else img.remove();
}, true);

function rowKey(r) { return r.address; }

function fields(r) {
  const sym = r.symbol ? safeText(r.symbol, REGISTER) : DASH;
  const name = r.name ? safeText(r.name, REGISTER) : (r.symbol ? sym : shorten(r.address || '') || DASH);
  return { sym, name };
}

function listRowHTML(r, i, own) {
  const { sym, name } = fields(r);
  const body = `
    ${tileHTML(r.logos || [r.logo], sym === DASH ? name : sym)}
    <span class="who"><span class="t1"><b>${esc(name)}</b><span class="sym">${esc(sym)}</span></span>${own ? '<span class="t2"><span class="pin-tag">Pinned</span></span>' : `<span class="t2 mono">${esc(shorten(r.address || ''))}</span>`}</span>
    <span class="cr cr-price num" data-k="price" data-label="Price">${DASH}</span>
    <span class="cr cr-chg num" data-k="change" data-label="24h">${DASH}</span>
    <span class="cr cr-vol num" data-k="volume" data-label="Volume">${DASH}</span>
    <span class="cr cr-liq num" data-k="liquidity" data-label="Liquidity">${DASH}</span>`;
  return body;
}
function tileBoxHTML(r, i, own) {
  const { sym, name } = fields(r);
  return `<span class="cb-top">${tileHTML(r.logos || [r.logo], sym === DASH ? name : sym)}<span class="cb-id"><b>${esc(name)}</b><span class="cb-sub"><span class="sym">${esc(sym)}</span>${own ? '<span class="pin-tag">Pinned</span>' : `<span class="mono">${esc(shorten(r.address || ''))}</span>`}</span></span></span>
    <span class="cb-foot"><span class="cb-mc"><span class="cap">Price <span class="chg cr-chg num" data-k="change">${DASH}</span></span><b class="num" data-k="price">${DASH}</b></span>
    <span class="cb-side"><span class="num" data-k="volume" data-label="Vol">${DASH}</span><span class="num" data-k="liquidity" data-label="Liq">${DASH}</span></span></span>`;
}

const FMT = { price: fmtPrice, change: fmtPct, volume: fmtUsd, liquidity: fmtUsd };
function fillCells(el, r) {
  el.querySelectorAll('[data-k]').forEach((c) => {
    const k = c.dataset.k;
    setNumber(c, r[k], FMT[k]);
    if (k === 'change') { c.classList.remove('up', 'down', 'flat'); c.classList.add(dirOf(r.change)); c.dataset.dir = dirOf(r.change); }
  });
}

function makeEl(r, i, own) {
  const tag = own ? (ownMode(REGISTER) === 'live' ? 'a' : 'div') : 'a';
  const el = document.createElement(tag);
  el.className = (view === 'list' ? 'coin-row' : 'coin-box') + ' spot' + (own ? ' own' : '');
  el.style.setProperty('--i', i);
  el.dataset.key = own ? 'own' : rowKey(r);
  if (tag === 'a') { el.href = `https://dexscreener.com/solana/${r.address}`; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
  if (own && tag === 'div') { el.setAttribute('aria-disabled', 'true'); }
  el.innerHTML = view === 'list' ? listRowHTML(r, i, own) : tileBoxHTML(r, i, own);
  return el;
}

function ownRecord() {
  if (ownMode(REGISTER) === 'live') {
    const o = last?.own;
    return o ? { ...o } : { address: REGISTER.ca.value, symbol: null, name: null, logos: [BRAND_LOGO], price: null, change: null, volume: null, liquidity: null };
  }
  return { address: '', symbol: 'PINPAD', name: 'Pinpad', logos: [BRAND_LOGO], price: null, change: null, volume: null, liquidity: null, placeholder: true };
}

function sorted(rows) {
  let r = rows.slice();
  if (filter === 'up') r = r.filter((x) => (x.change ?? 0) > 0);
  if (filter === 'down') r = r.filter((x) => (x.change ?? 0) < 0);
  const by = { gainers: 'change', volume: 'volume', depth: 'liquidity' }[sort];
  if (by) r.sort((a, b) => (b[by] ?? -Infinity) - (a[by] ?? -Infinity));
  return r;
}

function skeleton() {
  board.className = 'board view-' + view;
  board.innerHTML = Array.from({ length: 10 }, (_, i) => `<div class="${view === 'list' ? 'coin-row' : 'coin-box'} skel-row" style="--i:${i}"><span class="skel tile"></span><span class="skel sk-w"></span><span class="skel sk-s"></span><span class="skel sk-s"></span></div>`).join('');
}
function renderTickerSkeleton() {
  ticker.innerHTML = Array.from({ length: 9 }, () => '<span class="tr-card skel"></span>').join('');
}

let rendered = { view: null, keys: '' };
function render() {
  if (!last) return;
  const rows = last.view;
  const isErr = last.status === 'error' && !rows;
  const dataRows = rows ? sorted(rows) : Array.from({ length: 10 }, (_, i) => ({ address: 'x' + i, symbol: null, name: DASH, logo: null, price: null, change: null, volume: null, liquidity: null, dash: true }));
  const items = [{ r: ownRecord(), own: true }, ...dataRows.map((r) => ({ r, own: false }))];
  const keys = items.map((x) => (x.own ? 'own' : x.r.address)).join('|');
  const rebuild = rendered.view !== view || rendered.keys !== keys || board.querySelector('.skel-row');
  board.className = 'board view-' + view;
  $('#cols').hidden = view !== 'list';
  if (rebuild) {
    const old = new Map([...board.children].map((c) => [c.dataset.key, c]));
    const first = !!board.querySelector('.skel-row');
    board.textContent = '';
    items.forEach(({ r, own }, i) => {
      const k = own ? 'own' : r.address;
      let el = rendered.view === view ? old.get(k) : null;
      if (el && !first) { el.style.setProperty('--i', i); }
      else { el = makeEl(r, i, own); el.classList.add('enter'); }
      board.append(el);
    });
  }
  items.forEach(({ r, own }, i) => {
    const el = board.children[i];
    if (own && r.placeholder) { el.querySelectorAll('[data-k]').forEach((c) => { c.textContent = '· · · · ·'; c.className = c.className.replace(/\b(up|down|flat)\b/g, '').trim(); }); return; }
    if (own) {
      // refresh identity of own row when data arrives
      const { sym, name } = fields(r);
      const nm = el.querySelector('.who b, .cb-id b'); if (nm) nm.textContent = name;
      const sy = el.querySelector('.sym'); if (sy) sy.textContent = sym;
      const tile = el.querySelector('.tile');
      if (tile && JSON.stringify(r.logos) !== tile.dataset.logos) { tile.outerHTML = tileHTML(r.logos, sym === DASH ? name : sym); }
    }
    fillCells(el, r);
  });
  rendered = { view, keys };
  note.hidden = !(last.status === 'retry' || isErr);
  note.textContent = isErr ? 'Market feed unreachable. Retrying with wider gaps.' : 'Feed hiccup. Showing the last good numbers while retrying.';
  renderTicker(rows);
}

function renderTicker(rows) {
  if (!rows) { if (last.status === 'error') ticker.innerHTML = '<span class="tr-empty">' + DASH + '</span>'; return; }
  const own = ownMode(REGISTER) === 'live' && last.own ? [{ ...last.own, own: true }] : [];
  const list = [...own, ...rows.map((r) => ({ ...r }))];
  const sig = list.map((r) => r.address).join('|');
  const card = (r, i) => {
    const { sym, name } = fields(r);
    const logos = r.logos || [r.logo];
    return `<a class="tr-card spot" data-key="${esc(r.address)}" href="https://dexscreener.com/solana/${esc(r.address)}" target="_blank" rel="noopener noreferrer" style="--i:${i}" tabindex="${i < list.length ? 0 : -1}">
      <span class="tr-art">${tileHTML(logos, sym === DASH ? name : sym)}</span><span class="tr-rank num">${i + 1}</span>
      <span class="tr-info"><b class="tr-name">${esc(sym === DASH ? name : sym)}</b><span class="tr-price"><b data-t="price">${fmtPrice(r.price)}</b><span class="${dirOf(r.change)}" data-t="change">${fmtPct(r.change)}</span></span></span></a>`;
  };
  if (ticker.dataset.sig !== sig) {
    const html = list.map(card).join('');
    ticker.innerHTML = html;
    ticker.dataset.sig = sig;
  } else {
    list.forEach((r) => ticker.querySelectorAll(`[data-key="${CSS.escape(r.address)}"]`).forEach((c) => {
      c.querySelector('[data-t=price]').textContent = fmtPrice(r.price);
      const ch = c.querySelector('[data-t=change]'); ch.textContent = fmtPct(r.change); ch.className = dirOf(r.change);
    }));
  }
}

function setStatus(s) {
  for (const id of ['status-pill', 'status-pill-2']) {
    const p = $('#' + id); p.dataset.state = s; p.querySelector('b').textContent = PILL[s];
  }
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-sort]'); if (!b) return;
  sort = b.dataset.sort;
  $('#tabs').querySelectorAll('[role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t === b)));
  $('#board-panel').setAttribute('aria-labelledby', b.id);
  rendered.keys = ''; render();
});
$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  filter = b.dataset.filter;
  $('#filters').querySelectorAll('button').forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
  rendered.keys = ''; render();
});
$('#views').addEventListener('click', (e) => {
  const b = e.target.closest('[data-view]'); if (!b) return;
  view = b.dataset.view;
  $('#views').querySelectorAll('button').forEach((t) => t.setAttribute('aria-pressed', String(t === b)));
  rendered.view = null; render();
});

/* ---------- boot ---------- */
const intro = $('#intro');
$('#intro-word').innerHTML = [...$('#intro-word').dataset.text].map((c, i) => `<span${i > 2 ? ' class="b"' : ''} style="--i:${i}">${c}</span>`).join('');
try {
  if (reduced() || sessionStorage.getItem('pp-intro')) intro.remove();
  else {
    sessionStorage.setItem('pp-intro', '1');
    const kill = () => intro.classList.add('skip');
    intro.addEventListener('click', kill);
    intro.addEventListener('animationend', (e) => { if (e.target === intro) intro.remove(); });
    setTimeout(() => intro.remove(), 3400);
  }
} catch { intro.remove(); }

{ // theme-color follows the --bg token (no literal in markup)
  const m = document.createElement('meta'); m.name = 'theme-color';
  m.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  document.head.append(m);
}
initProgress($('#progress'));
initSpotlight();
initMesh($('#mesh'));
initCarousel($('.tr-viewport'), ticker);
setTimeout(() => document.documentElement.classList.add('ht-done'), 2200); // wall-clock guarantee: headline never stays parked below its clip
initParallax($('#hero'));
initReveal();

// moving nav underline
const pad = $('#nav-pad');
const navLinks = [...document.querySelectorAll('.nav a')];
function movePad(a) { if (!a) { pad.style.opacity = 0; return; } const nr = a.parentElement.getBoundingClientRect(), r = a.getBoundingClientRect(); pad.style.opacity = 1; pad.style.transform = `translateX(${r.left - nr.left + (r.width - 40) / 2}px)`; }
const secs = ['market', 'about', 'roadmap', 'links'].map((id) => document.getElementById(id));
function spy() { let cur = null; for (const s of secs) if (s.getBoundingClientRect().top < innerHeight * 0.4) cur = s.id; movePad(navLinks.find((a) => a.getAttribute('href') === '#' + cur)); }
addEventListener('scroll', spy, { passive: true }); addEventListener('resize', spy); spy();
const topEl = $('#top');
addEventListener('scroll', () => topEl.toggleAttribute('data-scrolled', scrollY > 8), { passive: true });

skeleton(); renderTickerSkeleton();
const market = createMarket(REGISTER, BRAND_LOGO, (payload) => { last = payload; setStatus(payload.status); render(); });
// own placeholder row must exist even before data lands (ownPulse keeps running)
last = { view: null, status: 'loading', own: null };
{
  const first = makeEl(ownRecord(), 0, true); first.dataset.key = 'own';
  board.prepend(first);
  first.querySelectorAll('[data-k]').forEach((c) => { c.textContent = ownMode(REGISTER) === 'live' ? DASH : '· · · · ·'; });
}
market.start();
window.__pinpad = { REGISTER, market };
