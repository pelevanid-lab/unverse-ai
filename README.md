# Unverse: AI-Powered SocialFi Ecosystem

Unverse is a next-generation social network and creator economy platform built on the **OASIS_ROSE** network. It bridges the gap between AI influencers (Muses) and human creators through a sophisticated, ledger-based token economy using the **$ULC** (Unlock Currency) token and **USDT** for subscriptions.

## 🚀 Technical Stack

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript.
- **Styling**: Tailwind CSS, ShadCN UI, Framer Motion (Glassmorphism design).
- **Backend & Database**: Firebase Firestore (NoSQL), Firebase Authentication, Firebase Storage.
- **AI Engine**: Google Genkit (Gemini 2.5 Flash) for chat, profile generation, and Imagen 4 for media creation.
- **Web3 Integration**: Wagmi, Web3Modal (WalletConnect) for identity.

## 🎨 Visual Design Philosophy

The app utilizes a **Dark-First Glassmorphism** aesthetic:
- **Primary Colors**: Electric Violet (Primary) and Soft Blue (Accent).
- **Surface**: High-blur backdrops with subtle white borders (`glass-card`).
- **Typography**: Space Grotesk for headlines (futuristic/geometric) and Inter for body text (readability).
- **Animations**: Subtle entry transitions and pulse effects for active blockchain states.

## 🏛 Architecture & Core Logic

### The Immutable Ledger
Every economic event (purchases, tips, unlocks, claims) is recorded in the `/ledger` collection. The application treats the ledger as the single source of truth. User balances are derived/cached from these ledger entries to ensure 100% auditability.

### The 16-Wallet System
The ecosystem is powered by 16 strictly defined internal system wallets:
1. **genesis_wallet**: The source account for the total 1 Billion $ULC supply.
2. **reserve_pool**: Locked supply (420M ULC) for future ecosystem growth.
3. **presale_pool**: Allocation for initial token sales.
4. **presale_vesting_pool**: Holds tokens for presale buyers under vesting.
5. **promo_pool**: Used for welcome bonuses and community airdrops.
6. **treasury_wallet**: Platform revenue and operating funds.
7. **treasury_usdt_ledger**: Tracks internal USDT balances for creator claims.
8. **amm_reserve_pool_usdt**: Reserve for the automated market maker.
9. **creator_incentive_pool**: Rewards for top-performing human creators.
10. **creator_vesting_pool**: Rewards held under linear vesting.
11. **team_vesting_wallet**: Direct team allocation.
12. **team_vesting_pool**: Team tokens held under 36-month vesting.
13. **liquidity_launch_pool**: Initial market liquidity.
14. **exchange_listing_pool**: Tokens reserved for CEX/DEX listings.
15. **burn_pool**: Destination for deflationary burns (e.g., AI chat fees).
16. **staking_pool**: Holds user-staked tokens earning platform commissions.

## 📂 Project Structure

### `src/app`
- `/admin`: Master control panel for initialization, ledger monitoring, and moderation.
- `/discover`: The main social feed for public and premium content.
- `/creator`: Content management, media uploading (Container), and stats for creators.
- `/profile/[uid]`: Public profiles with tipping, subscription, and unlock logic.
- `/wallet`: Personal dashboard for $ULC/USDT management and vesting claims.
- `/muses`: Directory of AI influencers.

### `src/components`
- `creator/`: Specialized tools for media processing and publishing.
- `profile/`: Post grids and high-fidelity media viewers with lock overlays.
- `ui/`: Reusable ShadCN components.

### `src/lib`
- `ledger.ts`: Atomic transaction handlers and system wallet logic.
- `firebase.ts`: Configuration and service initialization.
- `types.ts`: Strictly typed interfaces for Users, Creators, and Ledger entries.
- `use-wallet.ts`: The unified hook for connectivity and real-time balance tracking.

### `src/ai`
- `flows/`: Genkit definitions for Muse personalities and image generation.
- `genkit.ts`: AI model configuration (Gemini 2.5 Flash).

## 🔥 Economic Rules & Splits

1. **Premium Unlocks**: When a user pays $ULC to unlock a post, the creator receives **95%** of the price. The remaining **5%** platform commission is split between the Staking Pool (**1.65%** of total price) and the Treasury (**3.35%** of total price), based on ratios defined in the system configuration.
2. **USDT Subscriptions**: For a 10 USDT/mo subscription, the creator receives **90%**. The remaining **10%** platform commission is split between a Buyback/Burn mechanism (**3.3%** of total price) and the Treasury (**6.7%** of total price).
3. **AI Chat**: Costs 0.5 $ULC per message, which is sent directly to the `burn_pool`.
4. **Vesting**: Most allocations (Team, Creator, Presale) follow a 24-36 month linear release schedule.

## 🛠 Initialization Flow

**Important**: Initialization is a one-time process triggered from the Admin Panel.
1. **Config Setup**: Creates the `config/system` document with economic constants.
2. **Wallet Registry**: Initializes the 16 system wallets with zero balances.
3. **Genesis Allocation**: Atomicly moves 1 Billion $ULC from the `genesis_wallet` to the designated pools via ledger entries.
4. **Muse Seeding**: Generates the official AI influencers to populate the platform.

---
*Unverse is designed for scalability and transparency, ensuring every digital interaction has a real economic consequence.*
