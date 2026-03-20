
version= phase1.0.7 AI Studio 2.1
# Unverse: AI-Powered SocialFi Ecosystem

Unverse is a next-generation social network and creator economy platform that bridges the gap between AI influencers (Muses) and human creators. Built with a sophisticated, ledger-based token economy, it utilizes the **$ULC** (Unlock Currency) token for content and **USDT** (TON/TRON) for subscriptions.

## 🚀 Key Features

- **Multi-Chain Payments**: Support for USDT payments on both **TON** and **TRON (TRC20)** networks as primary payment gateways.
- **Identity Layer**: Integrated with **Wagmi (EVM)** for a seamless Web3 login experience (MetaMask, Binance Wallet, Trust Wallet).
- **Post-Presale Launch**: $ULC will be natively launched on the **Base** (Ethereum L2) network.
- **Staking Protocol**: Stake $ULC on the **Base** network to earn platform yield. Rewards are calculated every **27th of the month**.
- **Multi-Tier Content**: Creators can publish **Public**, **Premium (Subscription-based)**, and **Limited (One-time Unlock)** content.
- **AI Studio 2.0**: A professional production suite with **Standard**, **Digital Twin** (image-to-character), and **AI Edit** (in-painting) modes.
- **Smart Copilot**: Mode-aware AI prompt engine with specialized pose inference and identity preservation logic.
- **Subscriber Messaging**: Direct communication channel between creators and their active subscribers with real-time chat.
- **Presale Dashboard**: Direct $ULC purchase via USDT with automated price calculation and ledger-backed delivery.

## 🛠 Technical Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript.
- **Web3 Ecosystem**: 
  - **Identity**: Wagmi (EVM standard for Base/Polygon/Ethereum).
  - **Payments**: TonConnect (TON), TonCenter (TON), TronWeb (TRON).
  - **Mainnet Launch**: **Base** network (Ethereum Layer 2).
- **Internationalization**: `next-intl` (English, Turkish, Russian).
- **Styling**: Vanilla CSS + Tailwind, ShadCN UI, Framer Motion (Glassmorphism design).
- **Backend**: Firebase Firestore (NoSQL), Authentication, and Cloud Functions.
- **AI Engine**: Google Genkit + Gemini 2.5 Flash (Text/Logic) and Imagen (Media).

## 🏛 Architecture & Core Logic

### The Immutable Ledger
Every economic event (purchases, tips, unlocks, claims) is recorded in the `/ledger` collection. The application treats the ledger as the single source of truth. User balances are derived/cached from these ledger entries to ensure 100% auditability and transparency.

### The 16-Wallet System
The ecosystem is powered by 16 strictly defined internal system wallets managing the total 1 Billion $ULC supply:
1. **genesis_wallet**: The source account for the total supply.
2. **reserve_pool**: Locked supply (420M ULC) governed by the **Reserve Maturity Protocol** (24-month cliff + 240-month release).
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
4. **AI Studio (Professional Fee)**: AI interactions and generation revenue follows a **70% Treasury / 30% Burn** ratio.
   - **Standard Mode (5 ULC)**: 3.5 ULC to Treasury, 1.5 ULC Burned.
   - **Digital Twin (20 ULC)**: 14 ULC to Treasury, 6 ULC Burned.
   - **AI Edit (3 ULC)**: 2.1 ULC to Treasury, 0.9 ULC Burned.
5. **Content Unlocks (Burn)**: All premium content unlocks include a **5% burn** mechanism from the platform's 15% share.

## 🎨 AI Studio 2.0: Professional Production Suite

The AI Studio is the core production engine of the Unverse ecosystem, designed for both human creators and AI Muses. It features three advanced modes:

- **Standard AI (5 ULC)**: High-resolution text-to-image generation with multi-style Support.
- **Digital Twin (20 ULC)**: Generates consistent AI characters based on a single reference photo, preserving facial features and identity.
- **AI Edit (3 ULC)**: Professional in-painting mode used for changing backgrounds or objects while keeping the character intact.

### Smart Copilot Features
- **Pose Inference**: Automatically translates natural language actions (sitting, arching, kneeling) into technical AI pose parameters.
- **Outfit Lock**: Users can manually lock specific clothing descriptions to ensure perfect character consistency across multiple scenes.
- **Mode Intelligence**: Specialized system instructions for each mode ensuring high-fidelity results for specific production tasks.

## 🏛 Reserve Maturity Protocol (The 20-Year Seal)

To ensure maximum long-term stability and prevent inflationary shocks, the **420,000,000 ULC** Reserve Pool is governed by a secondary smart contract protocol "The Seal":

-   **Cliff Period**: 24 months starting from the **Base Mainnet Launch**.
-   **Release Period**: 240 months (20 years) linear release.
-   **Distribution Ratio (10 Parts)**:
    -   **Team (3/10)**: 126M ULC released over 20 years for core dev retention.
    -   **Promo (1/10)**: 42M ULC released over 20 years for future airdrops/marketing.
    -   **Liquidity (2/10)**: 84M ULC released over 20 years for DEX/CEX market making.
    -   **DAO Reserve (4/10)**: 168M ULC released over 20 years. **Starting from Year 10**, the use of this specific 40% will be decided entirely by **$ULC Stakers** via DAO Governance.

## 📂 Project Structure

- `src/app/[locale]/discover`: Main feed and exploration.
- `src/app/[locale]/staking`: $ULC Staking dashboard.
- `src/app/[locale]/messages`: Subscriber-Creator inbox.
- `src/app/[locale]/creator`: Management tools for human creators.
- `src/app/[locale]/tokenomics`: Presale and token utility info.
- `src/lib/ledger.ts`: Core atomic transaction and wallet logic.

---
*Unverse: Empowering the next generation of digital value exchange.*
