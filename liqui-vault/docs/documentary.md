# Commitment Liquidity Vault — Documentary

This project implements a unique liquidity protocol on Stacks: liquidity providers commit STX for a chosen lock duration and receive 1:1 "shares". Early withdrawals incur a configurable penalty that remains in the vault, forming a communal buffer. Yield can be distributed by the protocol operator and is accrued pro‑rata to shares via a per‑share accumulator.

Highlights:
- New Clarity functionality: time‑locked deposits, early‑withdrawal penalty, share‑based yield accounting, admin‑driven yield distribution.
- Clarinet tests validating deposits, penalties, unlock behavior, and yield claims.
- Two UIs: v1 (baseline) and v2 (redesigned) connecting to the contract with wallet flow and clear actions.

## Concept
Traditional vaults often mint LP tokens with complex pricing. Here, deposits mint internal shares 1:1 with STX—easy mental model. Users select a lock duration; withdrawing before unlock burns shares and pays a penalty that remains in the vault, cushioning the system and aligning incentives. Operators can distribute external earnings with a single transaction; users claim accrued yield on‑demand.

## Contract Overview
File: `contracts/liquidity-vault.clar`
- deposit(amount, lock-blocks): transfers STX in, increases user shares, sets/extends lock.
- withdraw(amount): burns shares; if before `locked-until`, applies penalty (bps); pays out STX.
- distribute-yield(amount): admin funds the vault and increments yield‑per‑share (scaled) to accrue to all holders.
- claim-yield(): settles and pays accrued yield to caller.
- Admin params: `penalty-bps`, `min-lock-blocks`.
- Read‑only: `get-user`, `get-total-shares`, `get-yps`, etc.

Design choices:
- 1:1 shares simplify UX/testing; penalties and yield don’t affect share price, only payouts.
- Per‑share accumulator avoids per‑deposit bookkeeping and is gas‑efficient.
- Penalties remain in vault; governance can later route them (e.g., insurance fund) with an extension.

## Tests
File: `tests/liquidity-vault.test.ts`
- Rejects zero deposits and too‑short locks.
- Early withdraw charges 5% by default; post‑lock withdrawals have no penalty.
- Yield distribution by admin is accrued and claimable by users.

Run:
- Install deps: `cd liqui-vault && npm i`
- Execute tests: `npm test`

## UI
There are two UIs to demonstrate iterative UX improvement.

- UI v1: `ui-v1/`
  - Minimal layout for connect, deposit, withdraw, claim, and admin yield distribution.
  - User inputs contract as `SP...deployer.liquidity-vault` to support any deployment.

- UI v2 (Redesign): `ui-v2/`
  - Dark, card‑based layout, progress cue for lock length, clearer grouping of actions.
  - Same functionality with improved affordances and copy.

Run either UI:
- `cd ui-v1 && npm i && npm run dev` (or `ui-v2`)
- In the UI, connect wallet (Stacks Testnet), paste contract identifier, then interact.

Note: For local devnet via Clarinet, run `clarinet integrate` in another terminal and point your wallet to the local network. Testnet is the default in the UI.

## Deployment
- Devnet: `clarinet check && clarinet console` or `clarinet integrate`.
- Testnet/Mainnet: deploy with your preferred flow (Hiro web wallet, clarinet or stacks CLI). The UI requires the combined `address.contractName`.

## Future Work
- Optional SIP‑010 LP tokenization to make shares transferable.
- Route penalties into an explicit insurance/coverage module with claims logic.
- Tranche presets (e.g., 7/30/90 days) with different penalty ramps.
- Streaming yield and auto‑compounding.