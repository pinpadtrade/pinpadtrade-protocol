// Pure logic (no DOM) — imported by the page and by scripts/verify.mjs.
export const STATES = ['stated', 'absent', 'unconfirmed'];

export function assertRecord(rec) {
  if (!STATES.includes(rec.state)) throw new Error(`record ${rec.id}: bad state ${rec.state}`);
  if (rec.state !== 'stated' && ('value' in rec || 'url' in rec || 'handle' in rec))
    throw new Error(`record ${rec.id}: inert record carries value/url`);
  if (rec.state === 'stated' && !('value' in rec) && !('url' in rec))
    throw new Error(`record ${rec.id}: stated record has neither value nor url`);
  return rec;
}

export function handleFromUrl(url) {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean)[0];
    return seg ? '@' + seg : u.hostname;
  } catch { return null; }
}
export function hostFromUrl(url) { try { return new URL(url).hostname; } catch { return null; } }

// View model: inert records expose label + "pending" only.
export function recordView(rec) {
  assertRecord(rec);
  if (rec.state !== 'stated') return { id: rec.id, label: rec.label, active: false, text: 'pending' };
  return {
    id: rec.id, label: rec.label, active: true,
    value: rec.value ?? null, url: rec.url ?? null,
    handle: rec.url ? handleFromUrl(rec.url) : null,
    host: rec.url ? hostFromUrl(rec.url) : null,
  };
}

const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const HEX = /^0x[0-9a-fA-F]{40}$/;
export function isAddressShaped(s) { return typeof s === 'string' && (B58.test(s.trim()) || HEX.test(s.trim())); }
export function isSolanaAddress(s) { return typeof s === 'string' && B58.test(s.trim()); }

// Gate: address-shaped strings are matched against the stated registry. 0x hex is never
// blanket-rejected; the CA is exempt from the scanner.
export function scanAddress(str, register) {
  const s = String(str ?? '').trim();
  if (!isAddressShaped(s)) return { address: false, ok: true };
  const ca = register.ca;
  if (ca && ca.state === 'stated' && ca.value === s) return { address: true, ok: true, exempt: true };
  const lower = s.toLowerCase();
  for (const rec of Object.values(register)) {
    if (rec.state !== 'stated') continue;
    for (const v of [rec.value, rec.url]) {
      if (typeof v === 'string' && v.toLowerCase().includes(lower)) return { address: true, ok: true, registry: rec.id };
    }
  }
  return { address: true, ok: false };
}
export function shorten(s) { return s.length > 12 ? s.slice(0, 4) + '…' + s.slice(-4) : s; }
export function safeText(str, register) {
  const s = String(str ?? '');
  const r = scanAddress(s, register);
  return r.ok ? s : shorten(s.trim());
}

export function pickPair(pairs) {
  if (!Array.isArray(pairs) || !pairs.length) return null;
  return [...pairs].sort((a, b) => (b?.volume?.h24 ?? 0) - (a?.volume?.h24 ?? 0))[0];
}

export function ownMode(register) { return register.ca.state === 'stated' ? 'live' : 'placeholder'; }

export function dedupeTrending(rows, ca) {
  return ca ? rows.filter((r) => r.address !== ca) : rows;
}

export function num(v) { const n = typeof v === 'string' ? parseFloat(v) : v; return Number.isFinite(n) ? n : null; }

// Logo chain: pump.fun image_uri -> DexScreener -> brand folder asset -> (letter tile in the UI)
export function composeOwn({ dexPairs, pump, ca, brandLogo }) {
  const pair = pickPair(dexPairs);
  const logos = [pump?.image_uri, pair?.info?.imageUrl, brandLogo].filter(Boolean);
  return {
    address: ca,
    symbol: pair?.baseToken?.symbol ?? pump?.symbol ?? null,
    name: pair?.baseToken?.name ?? pump?.name ?? null,
    price: num(pair?.priceUsd),
    change: num(pair?.priceChange?.h24),
    volume: num(pair?.volume?.h24),
    liquidity: num(pair?.liquidity?.usd),
    logos,
  };
}

export function topBoosted(list, n = 10) {
  const seen = new Set();
  return (Array.isArray(list) ? list : [])
    .filter((t) => t && t.chainId === 'solana' && t.tokenAddress)
    .sort((a, b) => (b.totalAmount ?? 0) - (a.totalAmount ?? 0))
    .filter((t) => (seen.has(t.tokenAddress) ? false : seen.add(t.tokenAddress)))
    .slice(0, n);
}

export function backoffMs(attempt) { return Math.min(60000, 2 * 1000 * 2 ** Math.max(0, attempt)); }

export const DASH = '—';
export function fmtUsd(v) {
  if (v == null) return DASH;
  const a = Math.abs(v);
  if (a >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (v / 1e3).toFixed(2) + 'K';
  return '$' + v.toFixed(2);
}
export function fmtPrice(v) {
  if (v == null) return DASH;
  if (v >= 1) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v >= 0.01) return '$' + v.toFixed(4);
  if (v === 0) return '$0';
  const s = v.toFixed(14).replace(/0+$/, '');
  const m = s.match(/^0\.(0+)(\d{1,4})/);
  return m ? '$0.0' + (m[1].length > 2 ? '(' + m[1].length + ')' : m[1]) + m[2] : '$' + v.toPrecision(3);
}
export function fmtPct(v) { return v == null ? DASH : (v > 0 ? '+' : '') + v.toFixed(1) + '%'; }
export function dirOf(v) { return v == null ? 'flat' : v > 0 ? 'up' : v < 0 ? 'down' : 'flat'; }
