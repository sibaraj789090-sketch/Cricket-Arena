# Cricket Arena — Ludo Bots Feature & Cleanup Documentation

## Overview
This document specifies the architecture, feature flag controls, file registry, and complete cleanup/removal procedures for the temporary **Pre-Launch Ludo Virtual Bots & QA Match Outcome Simulation** subsystem in the Cricket Arena project.

---

## 1. Safety & Isolation Guarantee
* **Zero Database Mutation:** The bot subsystem **does NOT create or modify any Supabase database tables or records**.
* **Zero Real Cash Impact:** All 5,200 virtual bots hold non-purchasable simulated `testTokenBalance` (test tokens). They are **strictly barred by the Express server from entering production Real Cash tables** (`entryFee > 0`).
* **Real User Balance Protection:** QA simulation matches never deduct entry fees or award cash prizes to real user accounts. Wallet balances in `public.coin_wallets` and `public.coin_transactions` remain 100% untouched.
* **Separation of Concerns:** Bot pools, documented strategies (`beginner`, `random_legal`, `stronger_legal`), and logs reside in dedicated, isolated modules.

---

## 2. Global Feature Flag (`LUDO_BOTS_ENABLED`)
The feature is controlled by a single global setting:
* **Environment Variable:** `LUDO_BOTS_ENABLED=false` (defaults to `false` in production).
* **Server-Side Variable:** `LUDO_BOTS_ENABLED` exported from `src/server/ludoBotEngine.ts`.
* **Admin Toggle:** Controlled live via `POST /api/admin/bots/toggle` in the Admin Dashboard (`🤖 Ludo Bots` tab).
* **Effect when `false`:**
  * All 5000+ bots are halted in idle state.
  * Any attempt to launch bot matches returns HTTP 403 (`Bot system is globally disabled`).
  * The Admin UI clearly indicates `○ BOTS DISABLED`.

---

## 3. Files Created for this Feature
To cleanly remove the feature in the future, delete the following files:

| File Path | Purpose |
| :--- | :--- |
| `src/types/ludoBot.ts` | TypeScript interfaces for bots, strategies, pool config, logs, and simulation modes |
| `src/server/ludoBotEngine.ts` | 5,000+ bot generator, 3 decision strategies, QA outcome simulation engine, and in-memory stores |
| `src/server/ludoBotRouter.ts` | Express API router mounted at `/api/admin/bots` (requires admin authorization) |
| `src/components/admin/AdminBotsSection.tsx` | Admin control panel: pool browser (search/paginate 5000+ bots), match starter, safe reset, and QA simulation config |
| `src/components/ludo/LudoSimulationBanner.tsx` | Prominent `SIMULATION — NOT A REAL MATCH` warning watermark banner |
| `LUDO_BOTS_CLEANUP.md` | This documentation file |

---

## 4. Files Modified (Integration Touchpoints)
The following files include minimal, cleanly commented hooks that can be restored:

1. **`server.ts`**
   - Lines ~28: Mounted `app.use('/api/admin/bots', ludoBotRouter)`.
   - *Removal:* Remove the router import and `app.use` line.

2. **`src/server/ludoMatchServer.ts`**
   - Imports: `selectBotMove`, `getBotById`, `addBotLog`, `LUDO_BOTS_ENABLED` from `./ludoBotEngine`.
   - In `/queue/join`: Check preventing bots from entering production cash tables.
   - In `checkAndRunBotTurn`: Calls `selectBotMove` to execute documented bot moves.
   - In `executeTokenMove`: Checks `(match as any).isSimulation` to prevent recording test matches in real player history.
   - *Removal:* Revert bot turn execution back to local fallback.

3. **`src/components/admin/AdminDashboard.tsx`**
   - Added `'bots'` tab option, `Bot` icon, and `<AdminBotsSection />` rendering.
   - *Removal:* Remove `'bots'` from the tab union and remove the component render block.

4. **`src/components/ludo/LudoOnlineMatchView.tsx`**
   - Renders `<LudoSimulationBanner />` when `match.isSimulation` is true.
   - Adds `[BOT]` label tag to bot players in the match list.
   - Bypasses real prize credit (`settleGameReward`) during QA simulations.
   - *Removal:* Remove simulation banner import and conditional check.

5. **`src/components/ludo/LudoCashLobbyView.tsx`**
   - Added Fair Play Real Player guarantee notice stating bots cannot enter production tables.
   - *Removal:* None strictly required, or update notice text.

---

## 5. Step-by-Step Complete Removal Procedure
When this temporary pre-launch feature is ready for decommissioning:

1. **Step 1: Disable via Flag**
   Set `LUDO_BOTS_ENABLED=false` or toggle it off in the Admin Dashboard.
2. **Step 2: Delete Created Files**
   ```bash
   rm -f src/types/ludoBot.ts
   rm -f src/server/ludoBotEngine.ts
   rm -f src/server/ludoBotRouter.ts
   rm -f src/components/admin/AdminBotsSection.tsx
   rm -f src/components/ludo/LudoSimulationBanner.tsx
   rm -f LUDO_BOTS_CLEANUP.md
   ```
3. **Step 3: Unmount in `server.ts` and `AdminDashboard.tsx`**
   Remove the imports and router mount.
4. **Step 4: Verify Compilation**
   Run `npm run build` or `compile_applet`.

*Result:* The Cricket game, Ludo UI, Real cash wallet, player tables, and admin management remain 100% operational with zero residual data.
