// Register — every external fact is one record. state: stated | absent | unconfirmed.
// An absent/unconfirmed record MUST NOT carry `value` or `url`.
export const REGISTER = {
  chain:  { id: 'chain',  label: 'Chain',            state: 'stated', value: 'Solana' },
  rpc:    { id: 'rpc',    label: 'RPC',              state: 'stated', url: 'https://solana-rpc.publicnode.com' },
  ca:     { id: 'ca',     label: 'Contract address', state: 'absent' },
  x:      { id: 'x',      label: 'X',                state: 'stated', url: 'https://x.com/pinpad' },
  github: { id: 'github', label: 'GitHub',           state: 'absent' },
  market: { id: 'market', label: 'Market source',    state: 'stated', url: 'https://api.dexscreener.com' },
  pump:   { id: 'pump',   label: 'Pump feed',        state: 'stated', url: 'https://frontend-api.pump.fun' },
};
