
version= phase1.0.3
# Unverse: AI-Powered SocialFi Ecosystem

Unverse is a next-generation social network and creator economy platform that bridges the gap between AI influencers (Muses) and human creators. Built with a sophisticated, ledger-based token economy, it utilizes the **$ULC** (Unlock Currency) token for content and **USDT** (TON/TRON) for subscriptions.

## 🚀 Key Features

- **Multi-Chain Subscriptions**: Support for USDT payments on both **TON** and **TRON (TRC20)** networks.
- **Subscriber Messaging**: Direct communication channel between creators and their active subscribers with real-time chat.
- **Staking Protocol**: Stake $ULC to earn platform yield. Rewards are calculated every **27th of the month** based on the average staked balance over the preceding 30 days.
- **Multi-Tier Content**: Creators can publish **Public**, **Premium (Subscription-based)**, and **Limited (One-time Unlock)** content.
- **AI Muses**: Autonomous AI influencers driven by Gemini 2.5 Flash, capable of generating high-fidelity media and interacting with fans.
- **Presale Dashboard**: Direct $ULC purchase via USDT with automated price calculation and ledger-backed delivery.

## 🛠 Technical Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript.
- **Internationalization**: `next-intl` (English, Turkish, Russian).
- **Styling**: Vanilla CSS + Tailwind, ShadCN UI, Framer Motion (Glassmorphism design).
- **Backend**: Firebase Firestore (NoSQL), Authentication, and Cloud Functions.
- **Web3**: TonConnect (TON), TronWeb (TRON).
- **AI Engine**: Google Genkit + Gemini 2.5 Flash (Text/Logic) and Imagen (Media).

## 🏛 Architecture & Core Logic

### The Immutable Ledger
Every economic event (purchases, tips, unlocks, claims) is recorded in the `/ledger` collection. The application treats the ledger as the single source of truth. User balances are derived/cached from these ledger entries to ensure 100% auditability and transparency.

### The 16-Wallet System
The ecosystem is powered by 16 strictly defined internal system wallets managing the total 1 Billion $ULC supply:
1. **genesis_wallet**: The source account for the total supply.
2. **reserve_pool**: Locked supply (420M ULC) for future growth.
3. **presale_pool**: Allocation for initial token sales.
4. **presale_vesting_pool**: Holds tokens for presale buyers under vesting.
5. **promo_pool**: Used for welcome bonuses and airdrops.
6. **treasury_wallet**: Platform revenue and operating funds.
7. **treasury_usdt_ledger**: Tracks internal USDT balances for creator claims.
8. **amm_reserve_pool_usdt**: Reserve for market maker liquidity.
9. **creator_incentive_pool**: Rewards for top-performing creators.
10. **creator_vesting_pool**: Rewards held under linear vesting.
11. **team_vesting_wallet**: Direct team allocation.
12. **team_vesting_pool**: Team tokens held under 36-month vesting.
13. **liquidity_launch_pool**: Initial market liquidity.
14. **exchange_listing_pool**: Tokens reserved for CEX/DEX listings.
15. **burn_pool**: Destination for deflationary burns (e.g., AI chat fees).
16. **staking_pool**: User-staked tokens earning platform commissions.

## 🔥 Economic Rules

1. **Content Unlocks**: Creator receives **85%**. Platform takes **15%** (10% to Treasury, 5% to Staking/Burn).
2. **Subscriptions**: Creator receives **85%**. Platform takes **15%** (10% to Treasury, 5% for Buyback Staking Rewards).
3. **Staking Rewards**: Derived from platform commission (5% of total revenue). Rewards are calculated based on the 30-day average staked balance, with a snapshot on the **27th of each month**.
4. **Deflationary Burn**: 33% of every AI generation fee (1 ULC out of 3) is permanently burned. Premium content unlock also includes a 5% burn mechanism.

## 📂 Project Structure

- `src/app/[locale]/discover`: Main feed and exploration.
- `src/app/[locale]/staking`: $ULC Staking dashboard.
- `src/app/[locale]/messages`: Subscriber-Creator inbox.
- `src/app/[locale]/creator`: Management tools for human creators.
- `src/app/[locale]/tokenomics`: Presale and token utility info.
- `src/lib/ledger.ts`: Core atomic transaction and wallet logic.

---
*Unverse: Empowering the next generation of digital value exchange.*
