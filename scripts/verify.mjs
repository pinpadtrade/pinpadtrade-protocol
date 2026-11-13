// Gate harness. Usage: node scripts/verify.mjs [distDir]   (REF_TEXT=<path> enables the 2-gram gate)
// Every anchor reads the CURRENT register record at runtime — nothing hardcodes absent/stated.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, process.argv[2] || 'dist');
const results = [];
const queue = [];
const gate = (name, fn) => { queue.push({ name, fn }); };   // run sequentially: gates share a mocked global fetch
const assert = (c, m) => { if (!c) throw new Error(m); };
const rd = (p) => fs.readFileSync(path.join(dist, p), 'utf8');
const walk = (d, out = []) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (['node_modules', 'brand', 'reference', 'dist', '.git'].includes(f)) continue; fs.statSync(p).isDirectory() ? walk(p, out) : out.push(p); } return out; };

const core = await import(pathToFileURL(path.join(dist, 'js/core.js')).href);
const { REGISTER } = await import(pathToFileURL(path.join(dist, 'js/register-data.js')).href);
const caState = REGISTER.ca.state;

const text = { html: rd('index.html'), css: rd('css/main.css'), tokens: rd('css/tokens.css'), main: rd('js/main.js'), market: rd('js/market.js'), motion: rd('js/motion.js'), core: rd('js/core.js'), reg: rd('js/register-data.js') };

gate('register: every record valid (state enum, inert carries no value/url)', () => { Object.values(REGISTER).forEach(core.assertRecord); });
gate('register: inert view model exposes label + "pending" only', () => {
  for (const r of Object.values(REGISTER)) {
    const v = core.recordView(r);
    if (r.state !== 'stated') { assert(!('value' in v) && !('url' in v) && !('handle' in v), r.id + ' leaks'); assert(v.text === 'pending', r.id + ' text'); }
  }
});
gate('register: mutation — inert record WITH value/url is rejected', () => {
  for (const bad of [{ id: 't', label: 't', state: 'absent', value: 'x' }, { id: 't', label: 't', state: 'unconfirmed', url: 'https://x.test' }]) {
    let threw = false; try { core.assertRecord(bad); } catch { threw = true; } assert(threw, 'accepted ' + JSON.stringify(bad));
  }
});
gate('link rule: handle derived from stored URL, no stored handle', () => {
  const x = REGISTER.x; assert(!('handle' in x), 'handle stored');
  if (x.state === 'stated') assert(core.recordView(x).handle === '@' + new URL(x.url).pathname.split('/').filter(Boolean)[0], 'handle mismatch');
});
gate('link rule: unstated records have no href anywhere in markup/JS literals', () => {
  for (const r of Object.values(REGISTER)) if (r.state !== 'stated') {
    const host = { x: 'x.com', github: 'github.com' }[r.id]; if (host) assert(!text.main.includes(host) && !text.html.includes(host), r.id + ' host literal outside register');
  }
  assert(!/github\.com/.test(text.html + text.main + text.core), 'github url literal present');
});
gate('gate warning: 0x hex never blanket-rejected; matched against stated registry', () => {
  const hex = '0x' + 'ab12'.repeat(10);
  const regUnknown = { ca: { state: 'absent' }, a: { state: 'stated', value: 'zzz' } };
  const regStated = { ca: { state: 'absent' }, a: { state: 'stated', value: hex } };
  assert(core.scanAddress('0xdeadbeef', regUnknown).ok === true, 'short 0x text rejected');
  assert(core.scanAddress(hex, regStated).ok === true, 'stated 0x rejected');
  assert(core.scanAddress(hex, regUnknown).ok === false && core.scanAddress(hex, regUnknown).address === true, 'unknown 0x not flagged');
});
gate('gate warning: CA exempt from address scanner (uses live record)', () => {
  const probe = '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU';
  const reg = { ...REGISTER, ca: { id: 'ca', label: 'c', state: 'stated', value: probe } };
  const r = core.scanAddress(probe, reg); assert(r.ok && r.exempt, 'CA not exempt');
  assert(core.scanAddress(probe, { ...REGISTER, ca: { id: 'ca', label: 'c', state: 'absent' } }).ok === false, 'unknown base58 accepted');
  if (caState === 'stated') assert(core.scanAddress(REGISTER.ca.value, REGISTER).exempt, 'live CA not exempt');
});
gate('own row: mode follows CA record only', () => { assert(core.ownMode(REGISTER) === (caState === 'stated' ? 'live' : 'placeholder'), 'mode'); });
gate('own row: pair selection = highest volume.h24', () => { assert(core.pickPair([{ id: 1, volume: { h24: 5 } }, { id: 2, volume: { h24: 90 } }, { id: 3, volume: { h24: 7 } }]).id === 2, 'pick'); });
gate('own row: logo chain pump.fun -> DexScreener -> brand', () => {
  const o = core.composeOwn({ dexPairs: [{ volume: { h24: 1 }, info: { imageUrl: 'D' }, baseToken: { symbol: 'S', name: 'N' }, priceUsd: '1.5', priceChange: { h24: 2 }, liquidity: { usd: 9 } }], pump: { image_uri: 'P' }, ca: 'c', brandLogo: 'B' });
  assert(o.logos.join() === 'P,D,B', 'chain ' + o.logos); assert(o.price === 1.5 && o.change === 2 && o.volume === 1 && o.liquidity === 9, 'fields');
  assert(core.composeOwn({ dexPairs: [], pump: null, ca: 'c', brandLogo: 'B' }).logos.join() === 'B', 'brand fallback');
});
gate('own row: dedupe removes CA from trending 2-10 (live record)', () => {
  const rows = [{ address: 'a' }, { address: 'b' }, { address: 'c' }];
  assert(core.dedupeTrending(rows, 'b').length === 2 && core.dedupeTrending(rows, null).length === 3, 'dedupe');
});
gate('market: top 10 solana by totalAmount, chain filter', () => {
  const l = Array.from({ length: 30 }, (_, i) => ({ chainId: i % 3 ? 'solana' : 'base', tokenAddress: 't' + i, totalAmount: i }));
  const t = core.topBoosted(l, 10); assert(t.length === 10 && t.every((x) => x.chainId === 'solana'), 'filter'); assert(t.every((x, i, a) => !i || a[i - 1].totalAmount >= x.totalAmount), 'order');
});
gate('market: backoff exponential, capped', () => { assert(core.backoffMs(0) === 2000 && core.backoffMs(1) === 4000 && core.backoffMs(2) === 8000 && core.backoffMs(20) === 60000, 'backoff'); });
gate('market: poll 60s, pauses hidden, immediate on visible', () => {
  assert(/POLL = 60000/.test(text.market) && /document\.hidden/.test(text.market) && /visibilitychange/.test(text.market), 'static');
});
gate('market: dash fallback for missing values', () => { assert(core.fmtPrice(null) === '—' && core.fmtUsd(null) === '—' && core.fmtPct(null) === '—', 'dash'); });

// functional market tests with mocked fetch
async function runMarket(register, mode) {
  const calls = []; const startOrder = [];
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const slow = (v, ms = 15) => new Promise((r) => setTimeout(() => r(v), ms));
  globalThis.fetch = (url) => {
    calls.push(String(url)); startOrder.push(String(url));
    const u = String(url);
    const json = (b) => slow({ ok: true, status: 200, json: async () => b });
    if (mode === 'down') return Promise.reject(new Error('net'));
    if (u.includes('token-boosts')) return json(Array.from({ length: 14 }, (_, i) => ({ chainId: 'solana', tokenAddress: 'T' + i, totalAmount: 100 - i })));
    if (u.includes('/tokens/v1/solana/')) return json([{ baseToken: { symbol: 'S', name: 'N' }, priceUsd: '1', priceChange: { h24: 1 }, volume: { h24: 1 }, liquidity: { usd: 1 }, info: {} }]);
    if (u.includes('/latest/dex/tokens/')) return json({ pairs: [{ baseToken: { symbol: 'O', name: 'Own' }, priceUsd: '2', volume: { h24: 3 }, priceChange: { h24: 1 }, liquidity: { usd: 4 } }] });
    if (u.includes('pump.fun')) return json({ image_uri: 'P', symbol: 'O' });
    return Promise.reject(new Error('unknown ' + u));
  };
  const { createMarket } = await import(pathToFileURL(path.join(dist, 'js/market.js')).href + '?' + Math.random());
  return new Promise((resolve) => {
    const m = createMarket(register, 'B', (p) => { m.stop(); resolve({ p, calls, startOrder }); });
    m.start();
  });
}
const withCA = { ...REGISTER, ca: { id: 'ca', label: 'c', state: 'stated', value: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU' } };
const noCA = { ...REGISTER, ca: { id: 'ca', label: 'c', state: 'absent' } };
const A = await runMarket(withCA), B = await runMarket(noCA);
gate('market: trending requests identical with CA stated vs absent (CA has zero effect)', () => {
  const t = (c) => c.filter((u) => !u.includes('/latest/dex/') && !u.includes('pump.fun')).sort().join('\n');
  assert(t(A.calls) === t(B.calls), 'trending calls differ');
  assert(A.p.view.length === 10 && B.p.view.length === 10, 'rows ' + A.p.view.length + '/' + B.p.view.length);
});
gate('own: stated CA fetches DexScreener AND pump.fun in parallel, absent CA fetches neither', () => {
  const dex = A.startOrder.findIndex((u) => u.includes('/latest/dex/tokens/')), pump = A.startOrder.findIndex((u) => u.includes('pump.fun/coins/'));
  assert(dex >= 0 && pump >= 0 && Math.abs(dex - pump) === 1, 'not initiated back-to-back: ' + dex + ',' + pump);
  assert(!B.calls.some((u) => u.includes('/latest/dex/') || u.includes('pump.fun')), 'absent CA fetched own feed');
  assert(A.p.own && A.p.own.logos[0] === 'P', 'own logo chain');
});
gate('own: pump.fun failure never blocks DexScreener (and vice versa)', async () => {
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  const mk = (failPump, failDex) => (url) => { const u = String(url);
    if (failPump && u.includes('pump.fun')) return Promise.reject(new Error('x'));
    if (failDex && u.includes('/latest/dex/')) return Promise.reject(new Error('x'));
    const b = u.includes('token-boosts') ? [{ chainId: 'solana', tokenAddress: 'T1', totalAmount: 1 }] : u.includes('/tokens/v1/') ? [{ baseToken: { symbol: 'S' }, priceUsd: '1', volume: { h24: 1 } }] : u.includes('/latest/dex/') ? { pairs: [{ baseToken: { symbol: 'O' }, priceUsd: '2', volume: { h24: 1 } }] } : { image_uri: 'P' };
    return Promise.resolve({ ok: true, status: 200, json: async () => b }); };
  const { createMarket } = await import(pathToFileURL(path.join(dist, 'js/market.js')).href + '?' + Math.random());
  for (const [fp, fd] of [[true, false], [false, true]]) {
    globalThis.fetch = mk(fp, fd);
    const p = await new Promise((res) => { const m = createMarket(withCA, 'B', (x) => { m.stop(); res(x); }); m.start(); });
    assert(p.own, `own missing (failPump=${fp} failDex=${fd})`);
  }
});
gate('market: last good data kept when refresh fails; status flips to retry', async () => {
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} };
  let n = 0; const ok = (b) => Promise.resolve({ ok: true, status: 200, json: async () => b });
  globalThis.fetch = (url) => { const u = String(url);
    if (n > 0) return Promise.reject(new Error('down'));
    return u.includes('token-boosts') ? ok([{ chainId: 'solana', tokenAddress: 'T1', totalAmount: 1 }]) : ok([{ baseToken: { symbol: 'S' }, priceUsd: '1', volume: { h24: 1 } }]); };
  const { createMarket } = await import(pathToFileURL(path.join(dist, 'js/market.js')).href + '?' + Math.random());
  const emits = [];
  const m = createMarket(noCA, 'B', (x) => emits.push({ status: x.status, n: x.view?.length ?? null }));
  await m.refresh(); n = 1; await m.refresh(); m.stop();
  assert(emits[0].status === 'live' && emits[0].n === 1, 'first load ' + JSON.stringify(emits));
  assert(emits[1].status === 'retry' && emits[1].n === 1, 'last good not kept ' + JSON.stringify(emits));
});

// static / hygiene gates
gate('palette: colour literals only in css/tokens.css', () => {
  const lit = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
  for (const f of ['html', 'css', 'main', 'market', 'motion', 'core', 'reg']) {
    const s = text[f].replace(/&#\d+;|&#x[0-9a-f]+;/gi, '').replace(/href="#[a-z]+"/g, '').replace(/url\(#/g, '');
    const m = s.replace(/'#' \+/g, '').match(/(^|[^&\w"'`/-])#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    assert(!m, `literal in ${f}: ${m && m[0]}`);
  }
  assert(lit.test(text.tokens), 'tokens.css has no literals?');
  assert(!/\b(black|white|red|green|blue)\b\s*[;,)]/.test(text.css), 'named colour in main.css');
});
gate('palette: every tokens.css hex is a sampled/declared value', () => {
  const allowed = ['#131418', '#f2f1f3', '#cccccf', '#9948fd', '#17181c', '#00ffcc', '#0a0a0f', '#7c3aed', '#22c55e', '#ef4444'];
  const found = [...text.tokens.matchAll(/#[0-9a-fA-F]{6}\b/g)].map((m) => m[0].toLowerCase()).filter((h) => !text.tokens.split('*/')[0].includes(h) || true);
  for (const h of new Set(found)) assert(allowed.includes(h), 'unexplained hex ' + h);
});
gate('no dates/timestamps anywhere in shipped code or copy', () => {
  const bad = /\b(19|20)\d\d\b|\b\d{1,2}:\d{2}(:\d{2})?\b|\b(jan(uary)?|feb(ruary)?|mar(ch)?|apr(il)?|jun(e)?|jul(y)?|aug(ust)?|sep(t(ember)?)?|oct(ober)?|nov(ember)?|dec(ember)?)\.? \d|\bas of\b|\bchecked\b|\bupdated\b|\blast (sync|update|seen)\b|\bago\b|new Date|Date\.now|toLocale(Date|Time)String|toISOString|getFullYear|<time\b/i;
  for (const f of ['html', 'css', 'main', 'market', 'motion', 'core', 'reg']) { const m = text[f].match(bad); assert(!m, `${f}: "${m && m[0]}"`); }
  assert(!/title="|aria-label="[^"]*\d{4}/.test(text.html), 'date-like label');
});
gate('no ch units; tap targets declared 44px', () => { assert(!/\d(\.\d+)?ch\b/.test(text.css), 'ch unit'); assert((text.css.match(/min-height: 44px|width: 44px/g) || []).length >= 8, '44px'); });
gate('reduced-motion: global instant fallback, own pulse off, marquee off', () => {
  const b = text.css.slice(text.css.indexOf('prefers-reduced-motion'));
  assert(/animation-duration: 0\.01ms/.test(b) && /\.own[^}]*animation: none/.test(b) && /tr-track\.loop[^}]*animation: none/.test(b), 'rm block');
  assert(/reduced\(\)/.test(text.motion) && /spring/.test(text.motion), 'js rm');
});
gate('own row style: border-left 2px accent + mint ownPulse + mint token', () => {
  assert(/\.own\s*\{[^}]*border-left: 2px solid var\(--color-accent\)[^}]*animation: ownPulse/.test(text.css), 'own css');
  assert(/--mint:\s*#00ffcc/i.test(text.tokens) && /--color-accent:\s*var\(--accent\)/.test(text.tokens), 'tokens');
});
gate('motion toolkit present: spring reveal, parallax, spotlight, progress, count-up, mesh', () => {
  for (const k of ['export function spring', 'initParallax', 'initSpotlight', 'initProgress', 'setNumber', 'initMesh', 'initReveal']) assert(text.motion.includes(k), k);
  assert(/flash-up/.test(text.motion) && /\.spot::after/.test(text.css) && /\.progress/.test(text.css) && /status-pill i/.test(text.css) && /skel/.test(text.css), 'css hooks');
});
gate('logo: file in dist, referenced by relative path, real PNG with alpha', () => {
  const p = path.join(dist, 'assets/logo.png'); assert(fs.existsSync(p), 'missing');
  const b = fs.readFileSync(p); assert(b.slice(1, 4).toString() === 'PNG' && b[25] === 6, 'not RGBA png');
  assert(/src="assets\/logo\.png"/.test(text.html), 'html ref'); assert(!/(src|href)="\//.test(text.html), 'absolute path');
  assert(text.main.includes("'assets/logo.png'"), 'js ref');
});
gate('favicon: svg 32x32 traced from pixel grid', () => {
  const s = rd('favicon.svg'); assert(/viewBox="0 0 32 32"/.test(s) && /width="32"/.test(s) && /height="32"/.test(s), 'dims');
  assert((s.match(/<rect /g) || []).length > 100, 'too few rects'); assert(/href="favicon\.svg"/.test(text.html), 'link');
});
gate('socials: X + GitHub official marks, icon only, both always rendered', () => {
  assert(text.main.includes('M18.244 2.25h3.308l-7.227') && text.main.includes('M8 0c4.42 0 8 3.58 8 8a8.013'), 'official paths');
  assert(/\$\('#socials'\)\.innerHTML = socialLink\('x'\) \+ socialLink\('github'\)/.test(text.main), 'both rendered');
  assert(!/topbar-actions[^}]*display:\s*none/.test(text.css), 'hidden');
});
gate('CA slot: above content, full address (no truncation), copy feedback', () => {
  assert(text.html.indexOf('id="ca-slot"') < text.html.indexOf('<main'), 'order'); assert(/'Copied'/.test(text.main) && /clipboard/.test(text.main), 'copy');
  assert(!/ca-val[^}]*text-overflow/.test(text.css), 'truncates');
});
gate('hygiene: no CLAUDE.md, .claude/, AI attribution in project files', () => {
  assert(!fs.existsSync(path.join(root, 'CLAUDE.md')) && !fs.existsSync(path.join(root, '.claude')), 'forbidden file');
  const re = /claude|anthropic|co-authored|generated with|ai-generated|\bLLM\b|chatgpt|copilot/i;
  for (const f of walk(root)) { if (/\.(png|jpe?g|ico|lock|json)$/.test(f) && !/package\.json$/.test(f)) continue; if (f.endsWith('verify.mjs') || f.endsWith('package-lock.json')) continue; const s = fs.readFileSync(f, 'utf8'); assert(!re.test(s), 'attribution in ' + path.relative(root, f)); }
});
gate('repo files at root, not in dist', () => {
  for (const f of ['README.md', 'docs/whitepaper.md', 'LICENSE']) { assert(fs.existsSync(path.join(root, f)), 'missing ' + f); assert(!fs.existsSync(path.join(dist, f)) && !fs.existsSync(path.join(dist, path.basename(f))), f + ' in dist'); }
  assert(/MIT License/.test(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')) && /PINPAD, 2026/.test(fs.readFileSync(path.join(root, 'LICENSE'), 'utf8')), 'license');
});
gate('copy: zero shared 2-grams with reference (function-word pairs excluded)', () => {
  const refPath = process.env.REF_TEXT; assert(refPath && fs.existsSync(refPath), 'REF_TEXT not set');
  const strip = (s) => s.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<svg[\s\S]*?<\/svg>/g, ' ').replace(/<[^>]+>/g, ' ');
  let mine = strip(text.html);
  for (const m of text.main.replace(/<svg[\s\S]*?<\/svg>/g, '').matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g)) if (/[a-z]{3,} [a-z]{2,}/i.test(m[2]) && !/<svg|viewBox/.test(m[2]) && !/[(){};=]/.test(m[2].replace(/<[^>]*>/g, ''))) mine += ' ' + strip(m[2]);
  const ref = fs.readFileSync(refPath, 'utf8') + ' Launch coins on any pair on 5 chains';
  const stop = new Set('a an the of to in on at is are be it its and or for with as by this that your you our we us can will not no from into than then so if but'.split(' '));
  const grams = (s) => { const w = s.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean); const o = new Set(); for (let i = 0; i < w.length - 1; i++) if (!(stop.has(w[i]) && stop.has(w[i + 1]))) o.add(w[i] + ' ' + w[i + 1]); return o; };
  const r = grams(ref), shared = [...grams(mine)].filter((g) => r.has(g));
  const ctx = (g) => { const i = mine.toLowerCase().replace(/\s+/g, ' ').indexOf(g); const flat = mine.replace(/\s+/g, ' '); return g + ' @ "' + flat.slice(Math.max(0, i - 25), i + 25) + '"'; };
  assert(shared.length === 0, 'shared: ' + shared.map(ctx).join(' | '));
});

const done = [];
for (const { name, fn } of queue) {
  try { const x = await fn(); done.push({ name, ok: x === undefined || x === true }); }
  catch (e) { done.push({ name, ok: false, note: e.message }); }
}
let pass = 0;
for (const r of done) { console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '  <- ' + r.note}`); if (r.ok) pass++; }
console.log(`\nca.state=${caState} | gates: ${pass}/${done.length} passed`);
process.exit(pass === done.length ? 0 : 1);
