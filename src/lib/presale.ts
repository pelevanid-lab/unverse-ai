
/**
 * TIER-BASED PRESALE LOGIC
 * Total Allocation: 100,000,000 ULC
 * 5 Stages of 20M ULC each.
 */

export const PRESALE_TOTAL_ALLOCATION = 100000000;
export const PRESALE_TIERS = [
  { stage: 1, limit: 20000000, price: 0.009, label: "Genesis Round" },
  { stage: 2, limit: 60000000, price: 0.012, label: "Growth Round" },
  { stage: 3, limit: 100000000, price: 0.014, label: "Launch Round" },
];

export interface PresaleStageInfo {
    currentStage: number;
    currentPrice: number;
    remainingInStage: number;
    nextPrice: number | null;
    isSoldOut: boolean;
    progressInStage: number; // 0 to 100
}

export function getPresaleStageInfo(totalSold: number): PresaleStageInfo {
  const currentTier = PRESALE_TIERS.find(t => totalSold < t.limit) || PRESALE_TIERS[PRESALE_TIERS.length - 1];
  const isSoldOut = totalSold >= PRESALE_TOTAL_ALLOCATION;
  
  const stageStartIndex = currentTier.stage - 1;
  const stageStartLimit = stageStartIndex === 0 ? 0 : PRESALE_TIERS[stageStartIndex - 1].limit;
  const stageSize = currentTier.limit - stageStartLimit;
  const soldInStage = Math.max(0, totalSold - stageStartLimit);
  const progressInStage = isSoldOut ? 100 : (soldInStage / stageSize) * 100;
  
  const remainingInStage = isSoldOut ? 0 : currentTier.limit - totalSold;
  const nextTier = PRESALE_TIERS[currentTier.stage]; // next stage has index of current stage

  return {
    currentStage: currentTier.stage,
    currentPrice: currentTier.price,
    remainingInStage,
    nextPrice: nextTier?.price || null,
    isSoldOut,
    progressInStage
  };
}

/**
 * Calculates how much ULC a user gets for a given USDC amount.
 * Handles split Across multiple stages.
 */
export function calculateUlcForUsdc(totalSold: number, usdcAmount: number) {
  let remainingUsdc = usdcAmount;
  let totalUlc = 0;
  let currentSold = totalSold;
  const breakdown: { stage: number; ulcAmount: number; priceUSDC: number }[] = [];

  if (totalSold >= PRESALE_TOTAL_ALLOCATION) return { totalUlc: 0, breakdown: [] };

  for (const tier of PRESALE_TIERS) {
    if (currentSold >= tier.limit) continue;
    if (remainingUsdc <= 0) break;

    const remainingInTier = tier.limit - currentSold;
    const costForTier = remainingInTier * tier.price;

    if (remainingUsdc <= costForTier) {
      // Purchase fits in this tier
      const ulcInTier = remainingUsdc / tier.price;
      totalUlc += ulcInTier;
      breakdown.push({ stage: tier.stage, ulcAmount: ulcInTier, priceUSDC: tier.price });
      remainingUsdc = 0;
    } else {
      // Purchase crosses to next tier
      totalUlc += remainingInTier;
      breakdown.push({ stage: tier.stage, ulcAmount: remainingInTier, priceUSDC: tier.price });
      remainingUsdc -= costForTier;
      currentSold = tier.limit;
    }
  }

  return { 
    totalUlc: Math.floor(totalUlc), 
    breakdown,
    effectiveAveragePrice: usdcAmount / totalUlc
  };
}

/**
 * Calculates how much USDC is needed for a specific ULC purchase.
 * Handles split across multiple stages.
 */
export function calculateUsdcForUlc(totalSold: number, ulcAmount: number) {
    let remainingUlc = ulcAmount;
    let totalUsdc = 0;
    let currentSold = totalSold;
    const breakdown: { stage: number; ulcAmount: number; priceUSDC: number }[] = [];

    if (totalSold + ulcAmount > PRESALE_TOTAL_ALLOCATION) {
        remainingUlc = Math.max(0, PRESALE_TOTAL_ALLOCATION - totalSold);
    }

    const effectiveUlcToBuy = remainingUlc;

    for (const tier of PRESALE_TIERS) {
        if (currentSold >= tier.limit) continue;
        if (remainingUlc <= 0) break;

        const remainingInTier = tier.limit - currentSold;
        
        if (remainingUlc <= remainingInTier) {
            // Purchase fits in this tier
            const costInTier = remainingUlc * tier.price;
            totalUsdc += costInTier;
            breakdown.push({ stage: tier.stage, ulcAmount: remainingUlc, priceUSDC: tier.price });
            remainingUlc = 0;
        } else {
            // Purchase crosses to next tier
            const costInTier = remainingInTier * tier.price;
            totalUsdc += costInTier;
            breakdown.push({ stage: tier.stage, ulcAmount: remainingInTier, priceUSDC: tier.price });
            remainingUlc -= remainingInTier;
            currentSold = tier.limit;
        }
    }

    return { 
        totalUsdc, 
        breakdown, 
        effectiveUlc: effectiveUlcToBuy,
        effectiveAveragePrice: totalUsdc / effectiveUlcToBuy 
    };
}
