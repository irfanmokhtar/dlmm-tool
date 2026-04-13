# DLMM Automated LP Bot — Implementation Plan

> Strategic plan for building an automated liquidity provision bot for Meteora DLMM on Solana.
> Covers token screening, position opening, monitoring, rebalancing, and risk management.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Phase 1: Pool Discovery & Screening](#2-phase-1-pool-discovery--screening)
3. [Phase 2: Position Opening (Strategy Deployment)](#3-phase-2-position-opening-strategy-deployment)
4. [Phase 3: Automated Monitoring & Rebalancing](#4-phase-3-automated-monitoring--rebalancing)
5. [Phase 4: Risk Management & Safety](#5-phase-4-risk-management--safety)
6. [Phase 5: Configuration & Persistence](#6-phase-5-configuration--persistence)
7. [Validation Checklists](#7-validation-checklists)
8. [SDK Method Reference](#8-sdk-method-reference)
9. [Relevant Files](#9-relevant-files)
10. [Decisions & Trade-offs](#10-decisions--trade-offs)
11. [Further Considerations](#11-further-considerations)

---

## 1. Architecture Overview

The bot extends the existing Next.js DLMM tool with four core modules:

```
┌─────────────────────────────────────────────────────────┐
│                    Bot Controller                        │
│  (master switch, dry-run mode, circuit breaker)         │
├──────────┬──────────┬──────────┬────────────────────────┤
│ Screener │ Position │ Monitor  │ Risk Engine             │
│ (find    │ (open/   │ (track & │ (limits, stop-loss,    │
│  pools)  │  close)  │  rebal.) │  circuit breaker)      │
├──────────┴──────────┴──────────┴────────────────────────┤
│              Server-Side Signing (AUTO_CLOSE_PRIVATE_KEY) │
├──────────────────────────────────────────────────────────┤
│              Solana RPC + Meteora DLMM SDK               │
└──────────────────────────────────────────────────────────┘
```

**Data flow:**
1. **Screener** scans Meteora API for top pools → scores & ranks them
2. **Position Manager** opens positions via SDK + server-side signing
3. **Monitor** polls active bin, PnL, fees → triggers close/rebalance
4. **Risk Engine** validates all actions before execution

---

## 2. Phase 1: Pool Discovery & Screening

**Goal**: Automatically find profitable DLMM pools.

### Steps

1. **Create `/api/pools/discover` route**
   - Fetch top DLMM pools from Meteora API (`https://dlmm-api.meteora.ag`)
   - Filter by TVL, volume, fee rate, bin step
   - Return ranked pool list with metadata

2. **Create `src/lib/screener.ts` — Pool scoring engine**
   - Score each pool on multiple dimensions:
     - **24h volume** — minimum threshold (e.g., $10k), higher is better
     - **TVL** — too low = illiquid, too high = saturated returns
     - **Fee rate** — higher = more fee income per swap
     - **Bin step** — smaller = tighter spreads but more rebalancing needed
     - **Volatility** — from price history; high vol = more fees but more divergence risk
     - **APR** — from Meteora API if available
   - Weighted composite score → ranked pool list

3. **Create `src/hooks/usePoolScreener.ts`**
   - Reactive hook for pool data with auto-refresh
   - Filter/sort by user preferences

4. **Create `src/components/PoolScreener.tsx`**
   - Ranked pool list with key metrics (TVL, volume, fee rate, APR)
   - Click to open position in that pool
   - Filter controls (min TVL, min volume, token pair)

5. **Add pool detail view**
   - Historical volume/fee charts
   - Current bin distribution visualization
   - Simulated strategy returns

### API Endpoints Needed

| Endpoint | Source | Purpose |
|----------|--------|---------|
| `GET /api/pools/discover` | Meteora DLMM API | List top pools with metrics |
| `GET /api/pools/[address]` | DLMM SDK + Meteora API | Detailed pool info |
| `GET /api/pools/[address]/history` | Meteora API | Historical volume/fee data |

---

## 3. Phase 2: Position Opening (Strategy Deployment)

**Goal**: Open positions with configurable strategies.

### Steps

1. **Create `src/lib/positionManager.ts`**
   - `openPosition()` — uses SDK's `initializePositionAndAddLiquidityByStrategy`
   - `addLiquidity()` — uses `addLiquidityByStrategy` for existing positions
   - `removeLiquidity()` — already implemented
   - `closePosition()` — already implemented

2. **Create `/api/open-position` route**
   - Server-side signing (same pattern as `/api/auto-close`)
   - Accepts: pool address, strategy type, bin range, amounts
   - Returns: transaction signature(s), position address

3. **Create strategy presets**
   - **Spot** — uniform distribution (`calculateSpotDistribution`)
     - Equal liquidity across all bins
     - Best for: stable pairs, low volatility
   - **Curve** — concentrated around active bin (`calculateNormalDistribution`)
     - More liquidity near center, less at edges
     - Best for: medium volatility, maximizing fee capture
   - **Bid-Ask** — asymmetric DCA (`calculateBidAskDistribution`)
     - One-sided or skewed distribution
     - Best for: directional bets, accumulating one token

4. **Create `src/components/OpenPositionDialog.tsx`**
   - Pool selector (from screener or manual address)
   - Strategy picker (Spot / Curve / Bid-Ask)
   - Amount input (token X and Y amounts)
   - Bin range preview (visual distribution chart)
   - Slippage tolerance slider
   - Estimated fee earnings projection

5. **Add pre-open validation checks** (see [Validation Checklists](#7-validation-checklists))

### Position Opening Flow

```
User selects pool + strategy + amounts
        │
        ▼
Pre-open validation checks
        │
        ▼
Calculate strategy parameters (bin distribution)
        │
        ▼
Build transaction via SDK
        │
        ▼
Sign with AUTO_CLOSE_PRIVATE_KEY (server-side)
        │
        ▼
Send & confirm transaction
        │
        ▼
Register position in bot monitor
        │
        ▼
Start monitoring loop
```

---

## 4. Phase 3: Automated Monitoring & Rebalancing

**Goal**: Extend current auto-close into full lifecycle management.

### Steps

1. **Extend `useAutoClose` → `usePositionBot`**
   - Current: only monitors bin range and triggers close
   - New: full lifecycle management with multiple trigger types:
     - **Out-of-range trigger** (current behavior)
     - **Take-profit trigger** (PnL % target reached)
     - **Stop-loss trigger** (divergence loss exceeds threshold)
     - **Max-age trigger** (position open too long)
     - **Rebalance trigger** (active bin shifted, re-center)

2. **Auto-rebalance flow**
   ```
   Detect out-of-range
        │
        ▼
   Withdraw all liquidity (removeLiquidity, 100%)
        │
        ▼
   Claim fees (claimSwapFee)
        │
        ▼
   Calculate new bin range around current active bin
        │
        ▼
   Open new position (initializePositionAndAddLiquidityByStrategy)
        │
        ▼
   Register new position in monitor
   ```

3. **Create `/api/rebalance` route**
   - Atomic withdraw + re-open in server-side flow
   - Handles multi-tx positions (same chunking logic as auto-close)
   - Returns old position close sig + new position open sig

4. **Trailing liquidity**
   - Shift bins to follow active price as it moves
   - Only shift when active bin moves >N bins from center
   - Uses `removeLiquidity` (partial) + `addLiquidityByStrategy` (new bins)

5. **PnL-based triggers**
   - Take-profit: close when `pnlPercent >= takeProfitPct`
   - Stop-loss: close when `pnlPercent <= -stopLossPct`
   - Uses Meteora PnL API (already integrated)

### Monitoring Architecture

```
┌─────────────────────────────────────────────┐
│              Polling Loop (15s)              │
├─────────────────────────────────────────────┤
│  1. Fetch active bin for each pool           │
│  2. Fetch PnL from Meteora API              │
│  3. Check trigger conditions:               │
│     - Out of range? → close or rebalance    │
│     - Take-profit reached? → close          │
│     - Stop-loss hit? → close                │
│     - Max age exceeded? → close             │
│  4. Execute action via server-side API      │
│  5. Update position state                   │
│  6. Log event                               │
└─────────────────────────────────────────────┘
```

---

## 5. Phase 4: Risk Management & Safety

**Goal**: Prevent catastrophic losses.

### Steps

1. **Create `src/lib/risk.ts`**
   - Position sizing: max % of portfolio per pool
   - Global capital limits: max total deployment across all pools
   - Correlation checks: avoid over-concentration in correlated pairs
   - Cooldown periods: min time between close and re-open (5 min default)

2. **Circuit breaker**
   - Pause all bot activity on extreme market moves
   - Trigger: >10% price move in <5 minutes (configurable)
   - Resume: manual or after cooldown period
   - Implementation: global `botPaused` flag checked before every action

3. **Notification system**
   - Telegram/Discord webhook for key events:
     - Position opened / closed
     - Out-of-range events
     - Stop-loss triggered
     - Circuit breaker activated
     - Transaction failures
   - Create `/api/notify` route for webhook delivery

4. **Dry-run mode**
   - Simulate all actions without real transactions
   - Log what *would* have happened
   - Useful for testing strategies with real market data

### Risk Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `maxCapitalPerPoolUsd` | $500 | Max capital in a single pool |
| `maxTotalCapitalUsd` | $2000 | Max total capital across all pools |
| `maxPositionsPerPool` | 2 | Max concurrent positions per pool |
| `maxTotalPositions` | 5 | Max total concurrent positions |
| `minPositionSizeUsd` | $50 | Minimum position size (avoid dust) |
| `cooldownMinutes` | 5 | Min time between close and re-open |
| `circuitBreakerPercentMove` | 10% | Price move that triggers pause |
| `circuitBreakerTimeWindowMin` | 5 | Time window for circuit breaker |
| `minSOLReserve` | 0.05 SOL | Keep this much SOL for fees |

---

## 6. Phase 5: Configuration & Persistence

**Goal**: Make the bot configurable and persistent.

### Steps

1. **Bot config schema (Zod validated)**

   ```typescript
   // Global settings
   const GlobalConfigSchema = z.object({
     botEnabled: z.boolean().default(false),
     dryRunMode: z.boolean().default(true),
     maxTotalCapitalUsd: z.number().min(0).default(2000),
     maxPositionsPerPool: z.number().min(1).default(2),
     maxTotalPositions: z.number().min(1).default(5),
     defaultSlippageBps: z.number().min(0).max(1000).default(100),
     pollIntervalMs: z.number().min(5000).default(15000),
     circuitBreakerPercentMove: z.number().default(10),
     circuitBreakerTimeWindowMin: z.number().default(5),
     minSOLReserve: z.number().default(0.05),
     cooldownMinutes: z.number().default(5),
     notifications: z.object({
       telegram: z.string().optional(),
       discord: z.string().optional(),
     }).optional(),
   });

   // Per-pool strategy config
   const PoolConfigSchema = z.object({
     poolAddress: z.string(),
     enabled: z.boolean().default(true),
     strategyType: z.enum(["spot", "curve", "bid-ask", "custom"]),
     binRange: z.number().min(1).max(69), // max 69 bins per side (70 total)
     capitalUsd: z.number().min(0),
     autoRebalance: z.boolean().default(false),
     takeProfitPct: z.number().default(50),  // +50% PnL
     stopLossPct: z.number().default(20),    // -20% PnL
     maxPositionAgeHours: z.number().default(168), // 1 week
     cooldownMinutes: z.number().default(5),
   });
   ```

2. **Storage**
   - Global config: localStorage (client) + JSON file (server)
   - Pool configs: localStorage (client) + JSON file (server)
   - Activity log: IndexedDB (client) for audit trail

3. **Create `src/components/BotSettings.tsx`**
   - Global settings panel (master switch, capital limits, circuit breaker)
   - Per-pool strategy configuration
   - Import/export configurations as JSON

4. **Activity log**
   - Full audit trail of all bot actions
   - Timestamped entries: trigger type, action taken, tx signature, PnL at time of action
   - Filterable by position, pool, action type

---

## 7. Validation Checklists

### Pre-Open Checks (Must Validate Before Opening)

- [ ] Wallet has sufficient SOL for rent + transaction fees (min 0.05 SOL)
- [ ] Wallet has sufficient token X and token Y balances for the strategy
- [ ] Pool is active (not paused/disabled)
- [ ] Pool 24h volume > minimum threshold ($10k)
- [ ] Pool fee rate is within acceptable range
- [ ] Bin step is appropriate for the pair's volatility
- [ ] Position range ≤ 70 bins (SDK hard limit per position)
- [ ] Slippage check: estimated entry price within tolerance
- [ ] No existing position in same pool exceeding concentration limit
- [ ] Global capital limit not exceeded
- [ ] Dry-run mode: simulate without sending transaction

### Monitoring Checks (Every Poll Cycle)

- [ ] Active bin is within position range
- [ ] PnL within acceptable bounds (take-profit / stop-loss)
- [ ] Divergence loss hasn't exceeded threshold
- [ ] Fee earnings tracking against expectations
- [ ] Pool TVL hasn't dropped below minimum threshold
- [ ] Token prices within volatility limits (circuit breaker)
- [ ] RPC endpoint responsive (not rate-limited or down)
- [ ] Wallet has SOL for transaction fees
- [ ] Position hasn't been externally modified (compare on-chain state)
- [ ] No pending transactions for this position

### Pre-Close Checks

- [ ] Position still exists and is owned by bot wallet
- [ ] No pending transactions for this position
- [ ] Fee claim is worthwhile (gas cost < fee value)
- [ ] Close won't cause excessive price impact
- [ ] Rebalance target is sufficiently different from current position (avoid unnecessary rebalances)

### Pre-Rebalance Checks

- [ ] All pre-close checks pass
- [ ] All pre-open checks pass for the new position
- [ ] New bin range is centered around current active bin
- [ ] Sufficient token balances for new position (after swap if needed)
- [ ] Rebalance improves position health score

---

## 8. SDK Method Reference

| Action | SDK Method | Parameters | Notes |
|--------|-----------|------------|-------|
| **Open position** | `initializePositionAndAddLiquidityByStrategy` | `positionPubKey, totalXAmount, totalYAmount, strategy, user, slippage` | Needs `Keypair` for new position |
| **Add liquidity** | `addLiquidityByStrategy` | `positionPubKey, totalXAmount, totalYAmount, strategy, user, slippage` | For existing positions |
| **Add liquidity (chunkable)** | `addLiquidityByStrategyChunkable` | Same as above | For >70 bin positions |
| **Remove liquidity** | `removeLiquidity` | `user, position, fromBinId, toBinId, bps, shouldClaimAndClose` | Already implemented |
| **Claim fees** | `claimSwapFee` | `owner, position` | Already implemented |
| **Close position** | `closePositionIfEmpty` | `owner, position` | Called after removeLiquidity |
| **Get pools** | `DLMM.getLbPairs` | `connection, opt` | For screener |
| **Get active bin** | `getActiveBin` | — | Already used |
| **Get position** | `getPosition` | `positionPubKey` | Already used |
| **Spot distribution** | `calculateSpotDistribution` | `binData, activeBinId, binRange` | Uniform distribution |
| **Curve distribution** | `calculateNormalDistribution` | `binData, activeBinId, binRange` | Concentrated center |
| **Bid-Ask distribution** | `calculateBidAskDistribution` | `binData, activeBinId, binRange` | Asymmetric DCA |
| **Swap** | `swap` / `swapWithPriceImpact` | Various | For zaps (single-token entry) |
| **Get bin ID from price** | `DLMM.getBinIdFromPrice` | `price, binStep, min` | Convert price to bin |

---

## 9. Relevant Files

| File | Purpose | Status |
|------|---------|--------|
| `src/lib/dlmm.ts` | Core DLMM interactions | Extend with `openPosition`, `rebalancePosition` |
| `src/hooks/useAutoClose.ts` | Current monitoring hook | Extend into `usePositionBot` |
| `src/app/api/auto-close/route.ts` | Server-side signing pattern | Reuse pattern for open/rebalance |
| `src/components/PositionProvider.tsx` | Position data refresh | Fixed refresh bug (removed `positions.length` dep) |
| `src/lib/constants.ts` | Pool addresses, token metadata | Extend with screener config |
| `src/components/PnLCurrencyProvider.tsx` | PnL currency context | Reuse for bot PnL calculations |
| `src/app/api/meteora-pnl/route.ts` | PnL data proxy | Reuse for PnL-based triggers |
| `src/app/api/position-activity/route.ts` | On-chain activity tracking | Reuse for audit trail |

### New Files to Create

| File | Purpose |
|------|---------|
| `src/lib/screener.ts` | Pool scoring and ranking engine |
| `src/lib/positionManager.ts` | Open/rebalance position logic |
| `src/lib/risk.ts` | Risk management and validation |
| `src/lib/botConfig.ts` | Zod schemas and config management |
| `src/hooks/usePositionBot.ts` | Full lifecycle monitoring hook |
| `src/hooks/usePoolScreener.ts` | Reactive pool data hook |
| `src/components/PoolScreener.tsx` | Pool discovery UI |
| `src/components/OpenPositionDialog.tsx` | Position opening UI |
| `src/components/BotSettings.tsx` | Bot configuration UI |
| `src/app/api/pools/discover/route.ts` | Pool discovery API |
| `src/app/api/open-position/route.ts` | Open position API |
| `src/app/api/rebalance/route.ts` | Rebalance position API |
| `src/app/api/notify/route.ts` | Webhook notification API |

---

## 10. Decisions & Trade-offs

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Signing** | Server-side (`AUTO_CLOSE_PRIVATE_KEY`) | Enables automated actions without wallet popup |
| **Monitoring** | Client-side polling (15s) | Simple, works with current architecture; production should move to server-side cron |
| **PnL data** | Meteora API | Already integrated; need fallback for outages |
| **Strategy presets** | DLMM SDK distribution calculators | Battle-tested, no custom math needed |
| **70-bin limit** | Hard constraint from SDK | Positions >70 bins require multiple transactions; handle with chunking |
| **Dry-run mode** | Essential for testing | Simulate all actions without real transactions |
| **Config storage** | localStorage + server JSON | Simple, no database needed; production may want PostgreSQL |

---

## 11. Further Considerations

### 11.1 Server-Side Monitoring (Critical for Production)

Current auto-close runs client-side (browser tab must stay open). For a production bot:
- Move monitoring to a server-side cron job or dedicated worker
- Use Helius/QuickNode WebSocket subscriptions for real-time bin changes
- Store position state in a database (PostgreSQL or Redis)
- Add health checks and auto-restart for the monitoring process

### 11.2 Key Management

`AUTO_CLOSE_PRIVATE_KEY` in `.env` is convenient but risky for production:
- Consider AWS KMS, HashiCorp Vault, or hardware wallet delegation
- Never commit private keys to version control
- Rotate keys regularly
- Use separate keys for different risk levels (e.g., small positions vs large positions)

### 11.3 Meteora API Rate Limits

Pool discovery and PnL APIs may have rate limits:
- Cache pool data with 5-10 minute TTL
- Cache PnL data with 30-60 second TTL
- Implement exponential backoff on 429 responses
- Consider fallback data sources (Birdeye, CoinGecko)

### 11.4 Jupiter Integration (Zaps)

For single-token entry (zaps):
- Use Jupiter Aggregator API to swap one token to the required ratio
- Calculate optimal split: how much of token X to swap to token Y
- Execute swap + open position in atomic transaction if possible
- Handle SOL wrapping/unwrapping automatically

### 11.5 MEV Protection

Automated transactions on Solana can be front-run:
- Use Jito bundles for time-sensitive operations (rebalancing, closing)
- Add priority fees during congested network conditions
- Consider using transaction simulation before sending

### 11.6 Testing Strategy

1. **Unit tests**: Screener scoring, risk validation, config parsing
2. **Integration tests**: Position open/close lifecycle with local validator
3. **Dry-run testing**: Run bot against mainnet data without sending transactions
4. **Circuit breaker testing**: Simulate extreme price moves
5. **Gas cost validation**: Estimate transaction costs before sending
6. **RPC resilience**: Test retry logic with simulated RPC failures

### 11.7 Phased Rollout

1. **Week 1-2**: Phase 1 (Pool Screener) — read-only, no risk
2. **Week 3-4**: Phase 2 (Position Opening) — manual, user signs in wallet
3. **Week 5-6**: Phase 3 (Auto-Rebalance) — automated, start with dry-run
4. **Week 7**: Phase 4 (Risk Management) — add safety rails
5. **Week 8**: Phase 5 (Configuration) — polish and persist settings
6. **Week 9+**: Production hardening (server-side monitoring, key management, notifications)