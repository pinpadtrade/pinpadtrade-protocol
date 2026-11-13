// Market feed: trending board (never gated by CA) + own-token feed (gated by CA record only).
import { topBoosted, pickPair, num, composeOwn, dedupeTrending, backoffMs, ownMode } from './core.js';

const POLL = 60000;

async function getJson(url, ms = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error('http ' + res.status);
    return await res.json();
  } finally { clearTimeout(t); }
}

export function createMarket(register, brandLogo, emit) {
  const base = register.market.url;
  const pumpBase = register.pump.url;
  const state = { trending: null, own: null, status: 'loading', attempt: 0, ownStatus: 'idle' };
  let timer = null, running = false, stopped = false;

  async function loadTrending() {
    const boosts = await getJson(`${base}/token-boosts/top/v1`);
    const top = topBoosted(boosts, 10);
    if (!top.length) throw new Error('empty');
    const settled = await Promise.allSettled(top.map((t) => getJson(`${base}/tokens/v1/solana/${t.tokenAddress}`)));
    let good = 0;
    const rows = top.map((t, i) => {
      const r = settled[i];
      const pair = r.status === 'fulfilled' ? pickPair(r.value) : null;
      if (pair) good++;
      return {
        address: t.tokenAddress,
        symbol: pair?.baseToken?.symbol ?? null,
        name: pair?.baseToken?.name ?? null,
        logo: pair?.info?.imageUrl ?? t.icon ?? null,
        price: num(pair?.priceUsd),
        change: num(pair?.priceChange?.h24),
        volume: num(pair?.volume?.h24),
        liquidity: num(pair?.liquidity?.usd),
        boost: t.totalAmount ?? 0,
      };
    });
    if (!good) throw new Error('no pairs');
    return rows;
  }

  async function loadOwn() {
    const ca = register.ca.value;
    // parallel, never blocking one on the other
    const [dex, pump] = await Promise.allSettled([
      getJson(`${base}/latest/dex/tokens/${ca}`),
      getJson(`${pumpBase}/coins/${ca}`),
    ]);
    if (dex.status === 'rejected' && pump.status === 'rejected') throw new Error('own feed down');
    return composeOwn({
      dexPairs: dex.status === 'fulfilled' ? dex.value?.pairs : null,
      pump: pump.status === 'fulfilled' ? pump.value : null,
      ca, brandLogo,
    });
  }

  async function tick() {
    if (running || stopped) return;
    running = true;
    const jobs = [loadTrending().then((rows) => ({ ok: true, rows }), () => ({ ok: false }))];
    if (ownMode(register) === 'live') jobs.push(loadOwn().then((own) => ({ ok: true, own }), () => ({ ok: false })));
    const [tr, ow] = await Promise.all(jobs);
    if (tr.ok) { state.trending = tr.rows; state.attempt = 0; state.status = 'live'; }
    else { state.attempt += 1; state.status = state.trending ? 'retry' : 'error'; }
    if (ow) { if (ow.ok) { state.own = ow.own; state.ownStatus = 'live'; } else state.ownStatus = state.own ? 'retry' : 'error'; }
    running = false;
    emit({ ...state, view: visibleRows() });
    schedule(tr.ok ? POLL : backoffMs(state.attempt - 1));
  }

  function visibleRows() {
    return state.trending ? dedupeTrending(state.trending, ownMode(register) === 'live' ? register.ca.value : null) : null;
  }
  function schedule(ms) {
    clearTimeout(timer);
    if (stopped || document.hidden) return;
    timer = setTimeout(tick, ms);
  }
  function onVis() {
    if (document.hidden) { clearTimeout(timer); timer = null; }
    else { clearTimeout(timer); tick(); }
  }
  return {
    state,
    refresh: tick,
    start() { document.addEventListener('visibilitychange', onVis); tick(); },
    stop() { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', onVis); },
  };
}
