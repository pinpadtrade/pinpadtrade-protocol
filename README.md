# Pinpad

**Nine keys. One of them glows.**

[![Live site](https://img.shields.io/badge/live-pinpad.trade-9948fd?style=flat-square)](https://pinpad.trade)
![Chain](https://img.shields.io/badge/chain-Solana-131418?style=flat-square)

| | |
|---|---|
| Chain | Solana mainnet |
| Contract address | `pending` (placeholder until published) |
| Site | https://pinpad.trade |

## Overview

Pinpad is a single-page Solana board. It follows the loudest boosted tokens in real time and keeps its own line pinned at row one, ready for the moment its contract address goes public. Everything on the page is plain HTML, CSS and ES modules, no framework and no wallet prompts.

## Features

- **Live board** — ten boosted Solana tokens with logo, symbol, price, 24h swing, volume and liquidity, refreshed every minute, paused while the tab is hidden.
- **Pinned own line** — dormant (brand logo, placeholder cells) until the contract address is stated, then live from DexScreener and pump.fun fetched in parallel.
- **Address bar** — full contract address at the top of the page, one tap to copy.
- **Ticker** — a marquee built from the same live data as the board.
- **Register pattern** — every external fact (chain, RPC, contract, socials, feeds) is a single record that is `stated`, `absent` or `unconfirmed`; anything not stated renders inert with no link and no value.
- **Motion** — spring-driven reveals, pointer and scroll parallax, animated gradient mesh, spotlight hover, scroll progress; all of it collapses to instant under `prefers-reduced-motion`.

## Links

- X: https://x.com/pinpad
- GitHub: pending
- RPC: https://solana-rpc.publicnode.com

## Develop

```bash
npm install
npm run build      # writes dist/
npm run serve      # static preview of dist/
npm run verify     # gate harness against dist/
```

To exercise the stated-address branch without editing source:

```bash
node scripts/build.mjs --ca <address> --out dist-ca
```

## License

MIT, see [LICENSE](LICENSE).
