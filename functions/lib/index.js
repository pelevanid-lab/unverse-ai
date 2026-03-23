"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteUserAccount = exports.joinCreatorProgram = exports.executeBuyback = exports.sealEconomy = exports.getPostMedia = exports.distributeStakingRewards = exports.claimVestedULC = exports.createVestingSchedule = exports.confirmPresalePurchase = exports.confirmPurchase = exports.unlockContent = exports.publishScheduledPosts = exports.optimizeMedia = void 0;
const firebase_functions_1 = require("firebase-functions");
const storage_1 = require("firebase-functions/v2/storage");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const sharp_1 = __importDefault(require("sharp"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
admin.initializeApp();
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
const db = admin.firestore();
// v2 Storage Function (Corrected)
exports.optimizeMedia = (0, storage_1.onObjectFinalized)({ timeoutSeconds: 540, memory: "1GiB" }, async (event) => {
    const { bucket, name: filePath, contentType } = event.data;
    const storageBucket = admin.storage().bucket(bucket);
    if (!filePath || !contentType || !filePath.startsWith("creator_media/") || filePath.includes("_optimized")) {
        return firebase_functions_1.logger.log("Not a triggerable file:", filePath);
    }
    const originalFileUrl = await storageBucket.file(filePath).getSignedUrl({ action: 'read', expires: '03-09-2491' }).then(urls => urls[0]);
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
    await storageBucket.file(filePath).download({ destination: tempFilePath });
    let optimizedTempPath = null;
    let newFileName;
    let newContentType;
    try {
        if (contentType.startsWith("image/")) {
            newFileName = path.basename(filePath, path.extname(filePath)) + "_optimized.webp";
            newContentType = "image/webp";
            optimizedTempPath = path.join(os.tmpdir(), newFileName);
            await (0, sharp_1.default)(tempFilePath).webp({ quality: 80 }).toFile(optimizedTempPath);
        }
        else if (contentType.startsWith("video/")) {
            newFileName = path.basename(filePath, path.extname(filePath)) + "_optimized.mp4";
            newContentType = "video/mp4";
            optimizedTempPath = path.join(os.tmpdir(), newFileName);
            await new Promise((resolve, reject) => {
                (0, fluent_ffmpeg_1.default)(tempFilePath)
                    .outputOptions(["-vcodec libx264", "-crf 28", "-preset fast"])
                    .toFormat('mp4')
                    .on("error", reject).on("end", resolve)
                    .save(optimizedTempPath);
            });
        }
        else {
            fs.unlinkSync(tempFilePath);
            return firebase_functions_1.logger.log("Unsupported content type:", contentType);
        }
        const optimizedFilePath = path.join(path.dirname(filePath), newFileName);
        const [uploadedFile] = await storageBucket.upload(optimizedTempPath, {
            destination: optimizedFilePath,
            metadata: { contentType: newContentType },
        });
        const [optimizedUrl] = await uploadedFile.getSignedUrl({ action: 'read', expires: '03-09-2491' });
        const snapshot = await db.collection("creator_media").where("mediaUrl", "==", originalFileUrl).get();
        if (snapshot.empty) {
            firebase_functions_1.logger.error("No matching document found for original file URL:", originalFileUrl);
        }
        else {
            for (const doc of snapshot.docs) {
                const currentData = doc.data();
                const updates = {
                    mediaUrl: optimizedUrl,
                    isOptimized: true
                };
                // Only set to 'draft' if it was effectively 'processing' (not scheduled/published)
                if (currentData.status !== 'scheduled' && currentData.status !== 'published') {
                    updates.status = 'draft';
                }
                await doc.ref.update(updates);
            }
        }
        firebase_functions_1.logger.log("Successfully optimized and updated document for:", filePath);
        await storageBucket.file(filePath).delete();
    }
    catch (error) {
        firebase_functions_1.logger.error("Optimization failed:", error);
    }
    finally {
        if (fs.existsSync(tempFilePath))
            fs.unlinkSync(tempFilePath);
        if (optimizedTempPath && fs.existsSync(optimizedTempPath))
            fs.unlinkSync(optimizedTempPath);
    }
});
// v2 Scheduler Function (Enhanced with logging and higher frequency)
exports.publishScheduledPosts = (0, scheduler_1.onSchedule)("every 15 minutes", async (event) => {
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();
    firebase_functions_1.logger.info(`Starting scheduled publish check at ${now.toDate().toISOString()} (${nowMs})`);
    const query = db.collection("creator_media")
        .where("status", "==", "scheduled");
    const snapshot = await query.get();
    // In-memory filter to bypass missing composite index requirement
    const postsToPublish = snapshot.docs.filter(doc => {
        const data = doc.data();
        return data.scheduledFor && data.scheduledFor <= nowMs;
    });
    if (postsToPublish.length === 0) {
        firebase_functions_1.logger.info("No scheduled posts to publish at this time (after temporal filtering).");
        return;
    }
    const postsCollection = db.collection("posts");
    const batch = db.batch();
    firebase_functions_1.logger.info(`Found ${postsToPublish.length} posts to publish after temporal filtering.`);
    postsToPublish.forEach(doc => {
        const mediaData = doc.data();
        const newPostData = {
            creatorId: mediaData.creatorId,
            creatorName: mediaData.creatorName,
            creatorAvatar: mediaData.creatorAvatar,
            mediaUrl: mediaData.mediaUrl,
            mediaType: mediaData.mediaType,
            content: mediaData.caption || "",
            contentType: mediaData.contentType || "public",
            unlockPrice: mediaData.priceULC || 0,
            createdAt: mediaData.scheduledFor || Date.now(),
            likes: 0,
            unlockCount: 0,
            earningsULC: 0,
            // Carry over AI prompt data if exists
            ...(mediaData.isAI && {
                isAI: true,
                aiPrompt: mediaData.aiPrompt || mediaData.prompt,
                aiEnhancedPrompt: mediaData.aiEnhancedPrompt || mediaData.enhancedPrompt
            }),
            ...(mediaData.contentType === 'limited' && {
                limited: {
                    totalSupply: Number(mediaData.limited?.totalSupply || 100),
                    soldCount: 0,
                    price: Number(mediaData.limited?.price || mediaData.priceULC || 0)
                }
            })
        };
        const newPostRef = postsCollection.doc();
        batch.set(newPostRef, newPostData);
        batch.delete(doc.ref);
        firebase_functions_1.logger.info(`Queued publication for media ID: ${doc.id} (Scheduled for: ${mediaData.scheduledFor})`);
    });
    await batch.commit();
    firebase_functions_1.logger.info("Successfully published all scheduled posts for this hour.");
});
/**
 * Securely handles Premium/Limited Content Unlock.
 * Split: 85% Creator, 10% Treasury, 5% Staking (Burn/Reward)
 */
async function checkSubscriptionInternal(db, userId, creatorId) {
    const q = await db.collection("subscriptions")
        .where("userId", "==", userId)
        .where("creatorId", "==", creatorId)
        .where("status", "==", "active")
        .where("expiresAt", ">", Date.now())
        .limit(1)
        .get();
    return !q.empty;
}
exports.unlockContent = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    // 1. Auth Check
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const { postId } = request.data;
    if (!postId)
        throw new https_1.HttpsError("invalid-argument", "postId is required.");
    const authUid = request.auth.uid;
    const db = admin.firestore();
    try {
        const userDoc = await getUserDoc(db, authUid);
        if (!userDoc)
            throw new https_1.HttpsError("not-found", "User profile not found.");
        const userId = userDoc.ref.id; // Corrected ID
        return await db.runTransaction(async (transaction) => {
            const userRef = userDoc.ref;
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new https_1.HttpsError("not-found", "User profile missing.");
            const userData = userSnap.data();
            const unlockedPostIds = userData?.unlockedPostIds || [];
            if (unlockedPostIds.includes(postId)) {
                throw new https_1.HttpsError("already-exists", "Content already unlocked.");
            }
            const postRef = db.collection("posts").doc(postId);
            const postSnap = await transaction.get(postRef);
            if (!postSnap.exists)
                throw new https_1.HttpsError("not-found", "Post not found.");
            const postData = postSnap.data();
            if (postData?.creatorId === userId) {
                throw new https_1.HttpsError("failed-precondition", "You cannot unlock your own content.");
            }
            // Determine Price
            const price = postData?.contentType === 'limited' ? (postData?.limited?.price || 0) : (postData?.unlockPrice || 0);
            if (price <= 0)
                throw new https_1.HttpsError("failed-precondition", "Invalid post price.");
            // Balance Check
            const balance = userData?.ulcBalance?.available || 0;
            if (balance < price) {
                throw new https_1.HttpsError("failed-precondition", "INSUFFICIENT_BALANCE");
            }
            // Limited Edition Check
            if (postData?.contentType === 'limited') {
                const sold = postData?.limited?.soldCount || 0;
                const total = postData?.limited?.totalSupply || 0;
                if (sold >= total)
                    throw new https_1.HttpsError("resource-exhausted", "Sold out.");
            }
            const configSnap = await transaction.get(db.collection("config").doc("system"));
            const config = configSnap.data();
            // --- Dynamic Split Logic via System Config ---
            const platformFeeSplit = config?.premium_unlock_fee_split ?? 0.15;
            const treasuryRatio = config?.premium_unlock_treasury_ratio ?? 0.67;
            const burnRatio = config?.premium_unlock_burn_ratio ?? 0.33;
            const creatorShare = price * (1 - platformFeeSplit);
            const platformMargin = price * platformFeeSplit;
            const treasuryShare = platformMargin * treasuryRatio;
            const burnShare = platformMargin * burnRatio;
            const referenceId = `unlock_${postId}_${userId}`;
            const now = Date.now();
            const ledgerCol = db.collection("ledger");
            // 1. Deduct from User & Record Unlock
            const serialNumber = postData?.contentType === 'limited' ? (postData?.limited?.soldCount || 0) + 1 : null;
            transaction.update(userRef, {
                unlockedPostIds: admin.firestore.FieldValue.arrayUnion(postId),
                'ulcBalance.available': admin.firestore.FieldValue.increment(-price),
                totalSpent: admin.firestore.FieldValue.increment(price)
            });
            // 1b. Create detailed unlock record for the user (for serialization/history)
            const unlockRef = userRef.collection("unlocked_media").doc(postId);
            transaction.set(unlockRef, {
                postId,
                creatorId: postData?.creatorId,
                unlockedAt: now,
                contentType: postData?.contentType,
                serialNumber: serialNumber,
                mediaType: postData?.mediaType,
                price
            });
            // 2. Credit Creator
            const creatorRef = db.collection("users").doc(postData?.creatorId);
            transaction.update(creatorRef, {
                'ulcBalance.available': admin.firestore.FieldValue.increment(creatorShare),
                totalEarnings: admin.firestore.FieldValue.increment(creatorShare)
            });
            // 2b. Creator Milestone Rewards System (First 100)
            const creatorSnap = await transaction.get(creatorRef);
            const creatorData = creatorSnap.data();
            if (creatorData?.creatorInFirst100Program) {
                const subPrice = creatorData.creatorData?.subscriptionPriceMonthly || 0;
                // Rule: Price >= 10 USDT
                if (subPrice >= 10) {
                    const uniqueBuyers = creatorData.uniquePremiumUnlockBuyerIds || [];
                    if (!uniqueBuyers.includes(userId)) {
                        const isSubscribed = await checkSubscriptionInternal(db, userId, creatorData.uid || postData?.creatorId);
                        if (isSubscribed) {
                            // Valid unique unlock found!
                            const newTotalUnlocks = (creatorData.totalUniquePremiumUnlocks || 0) + 1;
                            const currentRewards = creatorData.totalMilestoneRewardULC || 0;
                            transaction.update(creatorRef, {
                                uniquePremiumUnlockBuyerIds: admin.firestore.FieldValue.arrayUnion(userId),
                                totalUniquePremiumUnlocks: admin.firestore.FieldValue.increment(1)
                            });
                            // Milestone check (every 20 unique buyers)
                            if (newTotalUnlocks % 20 === 0 && currentRewards < 1000) {
                                const rewardAmount = 200;
                                const promoPortion = 60;
                                const incentivePortion = 140;
                                // Grant Reward
                                transaction.update(creatorRef, {
                                    'ulcBalance.available': admin.firestore.FieldValue.increment(promoPortion),
                                    'ulcBalance.locked': admin.firestore.FieldValue.increment(incentivePortion),
                                    totalMilestoneRewardULC: admin.firestore.FieldValue.increment(rewardAmount),
                                    milestoneRewardCount: admin.firestore.FieldValue.increment(1)
                                });
                                // Create Vesting Schedule (140 ULC, 24m duration, 0 cliff)
                                const scheduleRef = db.collection("vesting_schedules").doc();
                                transaction.set(scheduleRef, {
                                    userId: postData?.creatorId,
                                    totalAmount: incentivePortion,
                                    startTime: now,
                                    duration: 24 * 30 * 24 * 60 * 60 * 1000,
                                    cliff: 0,
                                    releasedAmount: 0,
                                    description: `Milestone Reward (${newTotalUnlocks} Unique Unlocks)`,
                                    poolId: "creators",
                                    createdAt: now
                                });
                                // Global Pool Stats
                                transaction.update(configSnap.ref, {
                                    "pools.promo": admin.firestore.FieldValue.increment(-promoPortion),
                                    "pools.creators": admin.firestore.FieldValue.increment(-incentivePortion),
                                    totalCreatorRewardsULC: admin.firestore.FieldValue.increment(rewardAmount),
                                    totalPromoPoolDistributedULC: admin.firestore.FieldValue.increment(promoPortion),
                                    totalCreatorIncentiveDistributedULC: admin.firestore.FieldValue.increment(incentivePortion)
                                });
                                // Ledger
                                transaction.set(db.collection("ledger").doc(), {
                                    type: "creator_milestone_reward",
                                    toUserId: postData?.creatorId,
                                    amount: rewardAmount,
                                    currency: "ULC",
                                    timestamp: now,
                                    metadata: {
                                        milestoneUnlockCount: newTotalUnlocks,
                                        promoPoolPortion: promoPortion,
                                        incentivePoolPortion: incentivePortion
                                    }
                                });
                            }
                        }
                    }
                }
            }
            // 3. Update Post Stats
            if (postData?.contentType === 'limited') {
                transaction.update(postRef, {
                    'limited.soldCount': admin.firestore.FieldValue.increment(1),
                    unlockCount: admin.firestore.FieldValue.increment(1)
                });
            }
            else {
                transaction.update(postRef, {
                    unlockCount: admin.firestore.FieldValue.increment(1)
                });
            }
            // 4. Update Global ULC Stats (Tracked in stats/ulc)
            transaction.set(db.collection("config").doc("stats"), {
                totalTreasuryULC: admin.firestore.FieldValue.increment(treasuryShare),
                totalBurnedULC: admin.firestore.FieldValue.increment(burnShare)
            }, { merge: true });
            // 5. Record Ledger Entries
            transaction.set(ledgerCol.doc(), {
                type: "premium_unlock",
                fromUserId: userId,
                amount: price,
                currency: "ULC",
                referenceId,
                metadata: { postId, contentType: postData?.contentType },
                timestamp: now
            });
            transaction.set(ledgerCol.doc(), {
                type: "creator_earning",
                toUserId: postData?.creatorId,
                amount: creatorShare,
                currency: "ULC",
                referenceId,
                metadata: { postId, from: userId },
                timestamp: now
            });
            transaction.set(ledgerCol.doc(), {
                type: "treasury_fee",
                toWallet: config?.treasury_wallets?.TON || "SYSTEM_TREASURY",
                amount: treasuryShare,
                currency: "ULC",
                referenceId,
                timestamp: now
            });
            transaction.set(ledgerCol.doc(), {
                type: "buyback_burn_fee",
                toWallet: "SYSTEM_BURN_POOL",
                amount: burnShare,
                currency: "ULC",
                referenceId,
                timestamp: now
            });
            return { success: true, postId, newBalance: balance - price };
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Unlock Content error:", error);
        throw new https_1.HttpsError("internal", error.message || "Internal transaction error.");
    }
});
/**
 * Confirms a ULC purchase after a successful on-chain transaction.
 */
exports.confirmPurchase = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const { amount, network, txHash } = request.data;
    if (!amount || !network || !txHash)
        throw new https_1.HttpsError("invalid-argument", "Missing params.");
    const authUid = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    try {
        const userDoc = await getUserDoc(db, authUid);
        if (!userDoc)
            throw new https_1.HttpsError("not-found", "User profile not found.");
        const userId = userDoc.ref.id; // Corrected ID
        await db.runTransaction(async (transaction) => {
            const userRef = userDoc.ref;
            const userSnap = await transaction.get(userRef);
            const userData = userSnap.data();
            const isFirstPurchase = !userData?.firstPurchaseBonusClaimed;
            let bonusAmount = 0;
            if (isFirstPurchase) {
                // Calculate 50% bonus, capped at 85 ULC
                bonusAmount = Math.floor(Math.min(amount * 0.5, 85));
            }
            // 1. Record USDT Entry (Audit)
            const usdtLedgerRef = db.collection("ledger").doc();
            transaction.set(usdtLedgerRef, {
                fromUserId: userId,
                amount: amount * 0.015,
                currency: "USDT",
                type: "ulc_purchase_payment",
                network,
                txHash,
                timestamp: now
            });
            // 2. Record ULC Entry (Main Purchase)
            const ulcLedgerRef = db.collection("ledger").doc();
            transaction.set(ulcLedgerRef, {
                toUserId: userId,
                amount: amount,
                currency: "ULC",
                type: "ulc_purchase",
                referenceId: usdtLedgerRef.id,
                timestamp: now
            });
            // 2b. Record Bonus Entry (If applicable)
            if (bonusAmount > 0) {
                const bonusLedgerRef = db.collection("ledger").doc();
                transaction.set(bonusLedgerRef, {
                    toUserId: userId,
                    amount: bonusAmount,
                    currency: "ULC",
                    type: "first_purchase_bonus",
                    referenceId: usdtLedgerRef.id, // Link to the same payment
                    timestamp: now + 1, // Slight offset for order
                    memo: "50% Welcome Bonus (Capped at 85 ULC)"
                });
            }
            // 3. Update User Balance & Flag
            transaction.update(userRef, {
                'ulcBalance.available': admin.firestore.FieldValue.increment(amount + bonusAmount),
                'firstPurchaseBonusClaimed': true // Set even if bonusAmount was 0 (unexpected) to prevent retries
            });
        });
        return { success: true };
    }
    catch (error) {
        firebase_functions_1.logger.error("Purchase confirmation error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Confirms a Pre-Sale ULC purchase.
 * Supports Tier-Based Pricing (Stage 1-5).
 * Vesting: 12 month cliff, 24 months linear release.
 */
exports.confirmPresalePurchase = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const { amount, network, txHash } = request.data;
    if (!amount || !network || !txHash)
        throw new https_1.HttpsError("invalid-argument", "Missing purchase parameters.");
    const authUid = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    const PRESALE_TIERS = [
        { stage: 1, limit: 20000000, price: 0.009 },
        { stage: 2, limit: 40000000, price: 0.010 },
        { stage: 3, limit: 60000000, price: 0.011 },
        { stage: 4, limit: 80000000, price: 0.012 },
        { stage: 5, limit: 100000000, price: 0.013 },
    ];
    const PRESALE_TOTAL_ALLOCATION = 100000000;
    try {
        const userDoc = await getUserDoc(db, authUid);
        if (!userDoc)
            throw new https_1.HttpsError("not-found", "User profile not found.");
        const userId = userDoc.ref.id;
        const result = await db.runTransaction(async (transaction) => {
            const userRef = userDoc.ref;
            const configRef = db.collection("config").doc("system");
            const configSnap = await transaction.get(configRef);
            const config = configSnap.data();
            const totalSoldBefore = config?.totalPresaleSold || 0;
            const presalePool = config?.pools?.presale || 0;
            if (totalSoldBefore >= PRESALE_TOTAL_ALLOCATION) {
                throw new https_1.HttpsError("resource-exhausted", "Pre-Sale is SOLD OUT.");
            }
            // --- CROSS-STAGE CALCULATION ---
            let remainingUsdt = amount;
            let totalUlc = 0;
            let currentSold = totalSoldBefore;
            const breakdown = [];
            for (const tier of PRESALE_TIERS) {
                if (currentSold >= tier.limit)
                    continue;
                if (remainingUsdt <= 0)
                    break;
                const remainingInTier = tier.limit - currentSold;
                const costForTier = remainingInTier * tier.price;
                if (remainingUsdt <= costForTier) {
                    const ulcInTier = remainingUsdt / tier.price;
                    totalUlc += ulcInTier;
                    breakdown.push({ stage: tier.stage, ulcAmount: ulcInTier, priceUSDT: tier.price });
                    remainingUsdt = 0;
                }
                else {
                    totalUlc += remainingInTier;
                    breakdown.push({ stage: tier.stage, ulcAmount: remainingInTier, priceUSDT: tier.price });
                    remainingUsdt -= costForTier;
                    currentSold = tier.limit;
                }
            }
            const ulcAmount = Math.floor(totalUlc);
            if (presalePool < ulcAmount) {
                throw new https_1.HttpsError("resource-exhausted", "Insufficient Pre-Sale allocation left for this amount.");
            }
            // --- EXECUTION ---
            const usdtLedgerRef = db.collection("ledger").doc();
            const ulcLedgerRef = db.collection("ledger").doc();
            const scheduleRef = db.collection("vesting_schedules").doc();
            // 1. Audit Ledger (USDT Payment)
            transaction.set(usdtLedgerRef, {
                fromUserId: userId,
                amount: amount,
                currency: "USDT",
                type: "ulc_purchase_payment",
                network,
                txHash,
                timestamp: now,
                memo: `Presale Stages: ${breakdown.map(b => `S${b.stage}`).join(', ')}`
            });
            // 2. Pre-Sale Purchase Ledger (ULC)
            transaction.set(ulcLedgerRef, {
                toUserId: userId,
                amount: ulcAmount,
                currency: "ULC",
                type: "presale_purchase",
                referenceId: usdtLedgerRef.id,
                timestamp: now,
                details: {
                    stageBreakdown: breakdown,
                    effectiveAveragePriceUSDT: amount / ulcAmount
                }
            });
            // 3. Vesting Schedule (12m cliff, 24m duration)
            const cliffMs = 12 * 30 * 24 * 60 * 60 * 1000;
            const durationMs = 24 * 30 * 24 * 60 * 60 * 1000;
            transaction.set(scheduleRef, {
                userId,
                totalAmount: ulcAmount,
                releasedAmount: 0,
                startTime: now,
                cliff: cliffMs,
                duration: durationMs,
                description: `Pre-Sale Allocation (Avg Price: $${(amount / ulcAmount).toFixed(4)})`,
                poolId: "presale",
                lastClaimedAt: 0,
                createdAt: now
            });
            // 4. Update Balances
            transaction.update(userRef, {
                'ulcBalance.locked': admin.firestore.FieldValue.increment(ulcAmount)
            });
            // 5. Update Global Stats & Tiers
            const totalSoldAfter = totalSoldBefore + ulcAmount;
            const newStageInfo = PRESALE_TIERS.find(t => totalSoldAfter < t.limit) || PRESALE_TIERS[4];
            transaction.update(configRef, {
                'pools.presale': admin.firestore.FieldValue.increment(-ulcAmount),
                'totalPresaleSold': admin.firestore.FieldValue.increment(ulcAmount),
                'totalTreasuryUSDT': admin.firestore.FieldValue.increment(amount),
                'currentPresaleStage': newStageInfo.stage,
                'presalePriceUSDT': newStageInfo.price,
                'presaleActive': totalSoldAfter < PRESALE_TOTAL_ALLOCATION
            });
            return { success: true, ulcAmount, breakdown };
        });
        return result;
    }
    catch (error) {
        firebase_functions_1.logger.error("Pre-Sale confirmation error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Creates a new Vesting Schedule for a user.
 * Restricted to the Admin Wallet defined in system config.
 */
const VESTING_PRESETS = {
    reserve: { cliffMonths: 0, durationMonths: 240 },
    team: { cliffMonths: 0, durationMonths: 36 },
    creators: { cliffMonths: 0, durationMonths: 24 },
    presale: { cliffMonths: 12, durationMonths: 24 },
    liquidity: { cliffMonths: 0, durationMonths: 0 },
    exchanges: { cliffMonths: 0, durationMonths: 0 },
    promo: { cliffMonths: 0, durationMonths: 0 },
    staking: { cliffMonths: 0, durationMonths: 0 }
};
exports.createVestingSchedule = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const { targetUserId, totalAmount, durationMonths, cliffMonths, description, poolId } = request.data;
    if (!targetUserId || !totalAmount || poolId === undefined) {
        throw new https_1.HttpsError("invalid-argument", "Missing required vesting parameters.");
    }
    const adminId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    // --- ENFORCEMENT ---
    let finalCliff = cliffMonths || 0;
    let finalDuration = durationMonths;
    if (poolId !== "promo") {
        const preset = VESTING_PRESETS[poolId];
        if (!preset)
            throw new https_1.HttpsError("invalid-argument", `Invalid pool: ${poolId}`);
        // Strict Enforcement: Force the preset values
        finalCliff = preset.cliffMonths;
        finalDuration = preset.durationMonths;
    }
    try {
        const configRef = db.collection("config").doc("system");
        const scheduleRef = db.collection("vesting_schedules").doc();
        await db.runTransaction(async (transaction) => {
            const configSnap = await transaction.get(configRef);
            const configData = configSnap.data();
            // 1. Admin Check (Enhanced for Wallet-to-UID mapping)
            const adminWallet = configData?.admin_wallet_address;
            const VERIFIED_ADMIN_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2"; // User's confirmed Auth UID
            // Check multiple sources for admin status
            const userSnap = await transaction.get(db.collection("users").doc(adminId));
            const userData = userSnap.data();
            const tokenWallet = request.auth?.token?.walletAddress;
            const isAdmin = adminId === VERIFIED_ADMIN_UID ||
                userData?.isAdmin === true ||
                userData?.walletAddress?.toLowerCase() === adminWallet?.toLowerCase() ||
                tokenWallet?.toLowerCase() === adminWallet?.toLowerCase();
            if (!isAdmin) {
                firebase_functions_1.logger.error("ACCESS_DENIED", { uid: adminId, wallet: tokenWallet });
                throw new https_1.HttpsError("permission-denied", "Only the system admin can create vesting schedules.");
            }
            // 2. Pool Deduction Logic
            const pools = configData?.pools || {};
            const currentPoolBalance = pools[poolId] || 0;
            if (currentPoolBalance < totalAmount) {
                throw new https_1.HttpsError("failed-precondition", `Insufficient balance in ${poolId} pool.`);
            }
            // --- EXECUTION ---
            const targetUserRef = db.collection("users").doc(targetUserId);
            const durationMs = finalDuration * 30 * 24 * 60 * 60 * 1000;
            const cliffMs = finalCliff * 30 * 24 * 60 * 60 * 1000;
            // Update Pool Balance
            transaction.update(configRef, {
                [`pools.${poolId}`]: admin.firestore.FieldValue.increment(-totalAmount)
            });
            // Create Schedule
            transaction.set(scheduleRef, {
                userId: targetUserId,
                totalAmount,
                startTime: now,
                duration: durationMs,
                cliff: cliffMs,
                releasedAmount: 0,
                description: description || "System Vesting",
                poolId,
                createdAt: now
            });
            // Lock the tokens in User Profile
            transaction.update(targetUserRef, {
                'ulcBalance.locked': admin.firestore.FieldValue.increment(totalAmount)
            });
            // Record Ledger Entry
            transaction.set(db.collection("ledger").doc(), {
                type: "vesting_created",
                fromWallet: poolId,
                toUserId: targetUserId,
                amount: totalAmount,
                currency: "ULC",
                referenceId: scheduleRef.id,
                timestamp: now
            });
        });
        return { success: true, scheduleId: scheduleRef.id };
    }
    catch (error) {
        firebase_functions_1.logger.error("Vesting creation error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Calculates and claims vested ULC for a specific schedule.
 * Moves tokens from 'locked' to 'available'.
 */
exports.claimVestedULC = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const { scheduleId } = request.data;
    if (!scheduleId)
        throw new https_1.HttpsError("invalid-argument", "scheduleId is required.");
    const authUid = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    try {
        const userDoc = await getUserDoc(db, authUid);
        if (!userDoc)
            throw new https_1.HttpsError("not-found", "User profile not found.");
        const userId = userDoc.ref.id;
        return await db.runTransaction(async (transaction) => {
            const scheduleRef = db.collection("vesting_schedules").doc(scheduleId);
            const scheduleSnap = await transaction.get(scheduleRef);
            if (!scheduleSnap.exists)
                throw new https_1.HttpsError("not-found", "Schedule not found.");
            const schedule = scheduleSnap.data();
            if (schedule?.userId !== userId)
                throw new https_1.HttpsError("permission-denied", "Unauthorized.");
            const { totalAmount, startTime, duration, cliff, releasedAmount } = schedule;
            // --- CALCULATION ---
            if (now < startTime + cliff) {
                throw new https_1.HttpsError("failed-precondition", "Cliff period not yet reached.");
            }
            const timePassed = now - startTime;
            const vestingRatio = Math.min(1, timePassed / duration);
            const totalVestedToDate = totalAmount * vestingRatio;
            const claimableNow = Math.max(0, totalVestedToDate - releasedAmount);
            if (claimableNow < 0.01) {
                throw new https_1.HttpsError("failed-precondition", "No claimable tokens at this time.");
            }
            // --- EXECUTION ---
            const userRef = db.collection("users").doc(userId);
            // 1. Update User Balance (Move Locked -> Available)
            transaction.update(userRef, {
                'ulcBalance.locked': admin.firestore.FieldValue.increment(-claimableNow),
                'ulcBalance.available': admin.firestore.FieldValue.increment(claimableNow)
            });
            // 2. Update Schedule
            transaction.update(scheduleRef, {
                releasedAmount: admin.firestore.FieldValue.increment(claimableNow),
                lastClaimedAt: now
            });
            // 3. Record Ledger
            transaction.set(db.collection("ledger").doc(), {
                type: "vesting_claim",
                toUserId: userId,
                amount: claimableNow,
                currency: "ULC",
                referenceId: scheduleId,
                timestamp: now
            });
            return { success: true, claimedAmount: claimableNow };
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Vesting claim error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Monthly Staking Reward Distribution
 * Occurs on the 27th of every month.
 * Logic: Distribution = (UserStaked / TotalEligibleStaked) * StakingPool
 * Multiplier: 1 USDT in pool = 100 ULC rewarded (Simplified buyback simulation)
 */
exports.distributeStakingRewards = (0, scheduler_1.onSchedule)("0 0 27 * *", async (event) => {
    const db = admin.firestore();
    const configRef = db.collection("config").doc("system");
    const configSnap = await configRef.get();
    const config = configSnap.data();
    const rewardPoolUSDT = config?.totalBuybackStakingUSDT || 0;
    if (rewardPoolUSDT <= 0) {
        firebase_functions_1.logger.info("Staking reward pool is empty.");
        return;
    }
    const listingPrice = config?.listingPriceUSDT || 0.015;
    const rewardPoolULC = rewardPoolUSDT / listingPrice;
    const usersSnap = await db.collection("users").where("ulcBalance.staked", ">", 0).get();
    let totalEligibleStaked = 0;
    const eligibleUsers = [];
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    // Filter users who kept tokens for the full month
    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const stakedAmount = userData.ulcBalance?.staked || 0;
        // Optimized check: Look for any withdrawals in the last month
        const withdrawals = await db.collection("ledger")
            .where("userId", "==", userDoc.id)
            .where("type", "==", "staking_withdraw")
            .where("timestamp", ">", thirtyDaysAgo)
            .limit(1).get();
        if (withdrawals.empty) {
            totalEligibleStaked += stakedAmount;
            eligibleUsers.push({ id: userDoc.id, staked: stakedAmount });
        }
    }
    if (totalEligibleStaked === 0) {
        firebase_functions_1.logger.info("No eligible stakers (30-day lock period not met by anyone).");
        return;
    }
    const batch = db.batch();
    eligibleUsers.forEach(u => {
        const userReward = (u.staked / totalEligibleStaked) * rewardPoolULC;
        if (userReward > 0) {
            const userRef = db.collection("users").doc(u.id);
            batch.update(userRef, {
                "ulcBalance.available": admin.firestore.FieldValue.increment(userReward)
            });
            batch.set(db.collection("ledger").doc(), {
                type: "staking_reward",
                toUserId: u.id,
                amount: userReward,
                currency: "ULC",
                timestamp: Date.now(),
                details: {
                    userStaked: u.staked,
                    totalStaked: totalEligibleStaked,
                    poolUSDT: rewardPoolUSDT
                }
            });
        }
    });
    // 1. Update Pool Balance (Subtract total distributed ULC)
    batch.update(configRef, {
        totalBuybackStakingUSDT: 0,
        "pools.staking": admin.firestore.FieldValue.increment(-rewardPoolULC)
    });
    await batch.commit();
    firebase_functions_1.logger.info(`Successfully distributed ${rewardPoolULC} ULC rewards to ${eligibleUsers.length} eligible stakers.`);
});
/**
 * Securely retrieves a 30-minute signed URL for premium/limited content.
 */
exports.getPostMedia = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    const { postId } = request.data;
    if (!postId)
        throw new https_1.HttpsError("invalid-argument", "postId is required.");
    const authUid = request.auth.uid;
    const db = admin.firestore();
    try {
        const userDoc = await getUserDoc(db, authUid);
        if (!userDoc)
            throw new https_1.HttpsError("not-found", "User profile not found.");
        const userId = userDoc.ref.id;
        const postSnap = await db.collection("posts").doc(postId).get();
        if (!postSnap.exists)
            throw new https_1.HttpsError("not-found", "Post not found.");
        const postData = postSnap.data();
        const isOwner = postData?.creatorId === userId;
        const isPublic = postData?.contentType === 'public';
        // 1. Check Access
        if (!isOwner && !isPublic) {
            const unlockSnap = await db.collection("users").doc(userId).collection("unlocked_media").doc(postId).get();
            if (!unlockSnap.exists) {
                // Check legacy arrayUnion if needed, but subcollection is better
                const userSnap = await db.collection("users").doc(userId).get();
                if (!userSnap.get("unlockedPostIds")?.includes(postId)) {
                    throw new https_1.HttpsError("permission-denied", "You haven't unlocked this content.");
                }
            }
        }
        const mediaUrl = postData?.mediaUrl;
        if (!mediaUrl)
            throw new https_1.HttpsError("not-found", "Media URL not found.");
        // If it's already an HTTP URL and not gs://, and it's public, just return it
        // But for premium, we want to generate a fresh signed URL even if mediaUrl was previously a signed URL
        // To be safe, we parse the path from the URL if it's a firebase storage URL
        let filePath = "";
        if (mediaUrl.includes("firebasestorage.googleapis.com")) {
            // Extract path between /o/ and ?
            const match = mediaUrl.match(/\/o\/(.+?)\?/);
            if (match)
                filePath = decodeURIComponent(match[1]);
        }
        else if (mediaUrl.startsWith("gs://")) {
            filePath = mediaUrl.replace(/gs:\/\/.+?\//, "");
        }
        else {
            // Fallback: If it's a direct URL we can't secure easily, just return it
            return { url: mediaUrl };
        }
        if (!filePath)
            return { url: mediaUrl };
        const bucket = admin.storage().bucket();
        const [signedUrl] = await bucket.file(filePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 60 * 1000 // 30 minutes
        });
        return { url: signedUrl };
    }
    catch (error) {
        firebase_functions_1.logger.error("getPostMedia error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * SEAL ECONOMY PROTOCOL
 * 1. Atomically splits 420M ULC Reserve Pool into 4 system schedules.
 * 2. Ratios: Team (126M), Liquidity (84M), Promo (42M), DAO (168M).
 * 3. Terms: 0 month cliff, 240 month linear duration.
 * 4. Locks the economy forever.
 */
exports.sealEconomy = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const db = admin.firestore();
    const now = Date.now();
    const adminId = request.auth.uid;
    const configRef = db.collection("config").doc("system");
    try {
        return await db.runTransaction(async (transaction) => {
            const configSnap = await transaction.get(configRef);
            const configData = configSnap.data();
            if (configData?.isSealed) {
                throw new https_1.HttpsError("already-exists", "Economy is already sealed.");
            }
            // Admin Authorization Check
            const authorizedAdmin = configData?.admin_wallet_address;
            const VERIFIED_MASTER_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2";
            // Allow if either UID matches master OR UID is the configured admin wallet
            if (adminId !== VERIFIED_MASTER_UID && adminId.toLowerCase() !== authorizedAdmin?.toLowerCase()) {
                firebase_functions_1.logger.error(`Seal Attempt Unauthorized. AdminId: ${adminId}, Authorized: ${authorizedAdmin}`);
                throw new https_1.HttpsError("permission-denied", "Unauthorized admin.");
            }
            const reserveBalance = configData?.pools?.reserve || 0;
            if (reserveBalance < 420000000) {
                throw new https_1.HttpsError("failed-precondition", "Insufficient Reserve balance for sealing.");
            }
            // Split Calculations (3:2:1:4)
            const splits = [
                { name: "Team Reserve", amount: 126000000, targetId: "TEAM_POOL_SYSTEM" },
                { name: "Liquidity Reserve", amount: 84000000, targetId: "LIQUIDITY_POOL_SYSTEM" },
                { name: "Promo Reserve", amount: 42000000, targetId: "PROMO_POOL_SYSTEM" },
                { name: "DAO Strategic Reserve", amount: 168000000, targetId: "DAO_POOL_SYSTEM" }
            ];
            const durationMs = 240 * 30 * 24 * 60 * 60 * 1000;
            for (const split of splits) {
                const scheduleRef = db.collection("vesting_schedules").doc();
                transaction.set(scheduleRef, {
                    userId: split.targetId,
                    totalAmount: split.amount,
                    startTime: now,
                    duration: durationMs,
                    cliff: 0,
                    releasedAmount: 0,
                    description: `The Seal: ${split.name} (Automated Split)`,
                    poolId: "reserve",
                    createdAt: now
                });
                transaction.set(db.collection("ledger").doc(), {
                    type: "vesting_created",
                    fromWallet: "reserve",
                    toUserId: split.targetId,
                    amount: split.amount,
                    currency: "ULC",
                    referenceId: scheduleRef.id,
                    timestamp: now,
                    details: { splitName: split.name }
                });
            }
            // 3. Finalize
            transaction.update(configRef, {
                isSealed: true,
                initialSupplyAtSeal: 1000000000,
                targetCapitalizationUSDT: 15000000,
                initialPriceAtSeal: 0.015,
                "pools.reserve": admin.firestore.FieldValue.increment(-420000000)
            });
            return { success: true };
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Seal Economy Error:", error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Executes a strategic Buyback & Burn.
 * Restricted to Admin. Enforces launch gates.
 */
exports.executeBuyback = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const { amountUSDT, description } = request.data;
    if (!amountUSDT)
        throw new https_1.HttpsError("invalid-argument", "Amount is required.");
    const adminId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    try {
        return await db.runTransaction(async (transaction) => {
            const configRef = db.collection("config").doc("system");
            const configSnap = await transaction.get(configRef);
            const config = configSnap.data();
            // 1. Admin Check
            const VERIFIED_ADMIN_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2";
            if (adminId !== VERIFIED_ADMIN_UID && !config?.admin_wallet_address) {
                throw new https_1.HttpsError("permission-denied", "Unauthorized.");
            }
            // 2. Launch Gates Check
            const isReady = config?.presaleCompleted && config?.tokenLaunchCompleted && config?.marketLiquidityReady;
            if (!isReady) {
                throw new https_1.HttpsError("failed-precondition", "LAUNCH_GATED: All conditions must be met.");
            }
            // 3. Execution (Simulated Burn)
            // Dynamic simulation rate based on listing price (current retail price)
            const listingPrice = config?.listingPriceUSDT || 0.015;
            const ulcBurnAmount = amountUSDT / listingPrice;
            const statsRef = db.collection("config").doc("stats");
            transaction.set(statsRef, {
                totalBurnedULC: admin.firestore.FieldValue.increment(ulcBurnAmount)
            }, { merge: true });
            // 4. Record Ledger
            transaction.set(db.collection("ledger").doc(), {
                type: "buyback_burn",
                amount: amountUSDT, // USDT value logged
                ulcBurned: ulcBurnAmount,
                currency: "USDT",
                description: description || "Strategic Buyback & Burn",
                timestamp: now,
                adminId
            });
            return { success: true, ulcBurned: ulcBurnAmount };
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("Buyback execution error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Helper to resolve a Firestore User Reference from a Firebase Auth UID.
 * Supports both Document ID (Wallet) and authUid field (Linked Anonymous sessions).
 */
async function getUserDoc(db, authUid) {
    const directRef = db.collection("users").doc(authUid);
    const directSnap = await directRef.get();
    if (directSnap.exists)
        return { ref: directRef, data: directSnap.data() };
    // Fallback: Lookup by the linked authUid field
    const querySnap = await db.collection("users").where("authUid", "==", authUid).limit(1).get();
    if (!querySnap.empty) {
        return { ref: querySnap.docs[0].ref, data: querySnap.docs[0].data() };
    }
    return null;
}
/**
 * JOIN CREATOR PROGRAM (First 100)
 * Grants Welcome Reward & Sets eligibility for milestones.
 */
exports.joinCreatorProgram = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const authUid = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    try {
        const userDoc = await getUserDoc(db, authUid);
        if (!userDoc)
            throw new https_1.HttpsError("not-found", "Profile not found.");
        const userId = userDoc.ref.id; // The wallet-based ID
        return await db.runTransaction(async (transaction) => {
            const userRef = userDoc.ref;
            const userData = (await transaction.get(userRef)).data();
            if (!userData)
                throw new https_1.HttpsError("not-found", "Profile missing during transaction.");
            if (!userData.isCreator)
                throw new https_1.HttpsError("failed-precondition", "Must be a creator.");
            if (userData.creatorInFirst100Program)
                throw new https_1.HttpsError("already-exists", "Already joined.");
            const configRef = db.collection("config").doc("system");
            const configSnap = await transaction.get(configRef);
            const config = configSnap.data();
            const currentCount = config?.creatorProgramCount || 0;
            if (currentCount >= 100)
                throw new https_1.HttpsError("resource-exhausted", "Program limit reached.");
            const rewardAmount = 200;
            const promoPortion = 60;
            const incentivePortion = 140;
            // 1. Join Program & Grant Reward
            transaction.update(userRef, {
                creatorInFirst100Program: true,
                creatorProgramIndex: currentCount + 1,
                creatorWelcomeRewardGranted: true,
                totalMilestoneRewardULC: admin.firestore.FieldValue.increment(rewardAmount),
                'ulcBalance.available': admin.firestore.FieldValue.increment(promoPortion),
                'ulcBalance.locked': admin.firestore.FieldValue.increment(incentivePortion)
            });
            // 2. Create Vesting Schedule (140 ULC, 24m duration, 0 cliff)
            const scheduleRef = db.collection("vesting_schedules").doc();
            transaction.set(scheduleRef, {
                userId,
                totalAmount: incentivePortion,
                startTime: now,
                duration: 24 * 30 * 24 * 60 * 60 * 1000,
                cliff: 0,
                releasedAmount: 0,
                description: "Creator Welcome Reward (First 100 Plan)",
                poolId: "creators",
                createdAt: now
            });
            // 3. Update Global Config & Stats
            transaction.update(configRef, {
                creatorProgramCount: admin.firestore.FieldValue.increment(1),
                "pools.promo": admin.firestore.FieldValue.increment(-promoPortion),
                "pools.creators": admin.firestore.FieldValue.increment(-incentivePortion),
                totalCreatorRewardsULC: admin.firestore.FieldValue.increment(rewardAmount),
                totalPromoPoolDistributedULC: admin.firestore.FieldValue.increment(promoPortion),
                totalCreatorIncentiveDistributedULC: admin.firestore.FieldValue.increment(incentivePortion)
            });
            // 4. Ledger
            transaction.set(db.collection("ledger").doc(), {
                type: "creator_welcome_reward",
                toUserId: userId,
                amount: rewardAmount,
                currency: "ULC",
                timestamp: now,
                metadata: {
                    promoPoolPortion: promoPortion,
                    incentivePoolPortion: incentivePortion
                }
            });
            return { success: true, reward: rewardAmount };
        });
    }
    catch (error) {
        firebase_functions_1.logger.error("joinCreatorProgram error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * PERMANENTLY DELETES A USER ACCOUNT AND ALL ASSOCIATED DATA.
 */
exports.deleteUserAccount = (0, https_1.onCall)({ memory: "512MiB", timeoutSeconds: 300 }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in to delete their account.");
    }
    const authUid = request.auth.uid;
    const db = admin.firestore();
    const storage = admin.storage();
    const auth = admin.auth();
    try {
        const userDoc = await getUserDoc(db, authUid);
        if (!userDoc) {
            firebase_functions_1.logger.warn(`deleteUserAccount: Profile not found for authUid ${authUid}. Proceeding with Auth deletion.`);
            await auth.deleteUser(authUid);
            return { success: true, message: "Auth account deleted, but no Firestore profile found." };
        }
        const userId = userDoc.ref.id;
        firebase_functions_1.logger.info(`Starting permanent deletion for user: ${userId} (Auth UID: ${authUid})`);
        // Helper to delete in batches (max 500)
        async function deleteInBatches(query) {
            let totalDeleted = 0;
            while (true) {
                const snapshot = await query.limit(500).get();
                if (snapshot.empty)
                    break;
                const batch = db.batch();
                snapshot.docs.forEach((doc) => batch.delete(doc.ref));
                await batch.commit();
                totalDeleted += snapshot.size;
                // If we got exactly 500, there might be more
                if (snapshot.size < 500)
                    break;
            }
            return totalDeleted;
        }
        // 1. Storage Deletion
        const bucket = storage.bucket();
        try {
            // No leading slash for prefix
            await bucket.deleteFiles({ prefix: `creator_media/${userId}/` });
            await bucket.deleteFiles({ prefix: `avatars/${userId}/` });
            firebase_functions_1.logger.info(`Storage cleanup completed for ${userId}`);
        }
        catch (storageError) {
            firebase_functions_1.logger.error(`Storage cleanup failed for ${userId}:`, storageError);
        }
        // 2. Firestore Deletion
        const collectionsToCleanup = [
            { col: "creator_media", field: "creatorId" },
            { col: "posts", field: "creatorId" },
            { col: "subscriptions", field: "userId" },
            { col: "subscriptions", field: "creatorId" },
            { col: "ledger", field: "userId" },
            { col: "ledger", field: "fromUserId" },
            { col: "ledger", field: "toUserId" },
            { col: "ledger", field: "creatorId" },
            { col: "messages", field: "senderId" },
            { col: "vesting_schedules", field: "userId" },
            { col: "ai_generation_logs", field: "userId" }
        ];
        for (const config of collectionsToCleanup) {
            try {
                const count = await deleteInBatches(db.collection(config.col).where(config.field, "==", userId));
                if (count > 0)
                    firebase_functions_1.logger.info(`Deleted ${count} documents from ${config.col}`);
            }
            catch (err) {
                firebase_functions_1.logger.error(`Error cleaning up collection ${config.col}:`, err);
            }
        }
        // 2b. Chats (Array membership)
        try {
            const count = await deleteInBatches(db.collection("chats").where("participants", "array-contains", userId));
            if (count > 0)
                firebase_functions_1.logger.info(`Deleted ${count} documents from chats`);
        }
        catch (err) {
            firebase_functions_1.logger.error(`Error cleaning up chats:`, err);
        }
        // 2c. Sub-collections (unlocked_media)
        try {
            const count = await deleteInBatches(userDoc.ref.collection("unlocked_media"));
            if (count > 0)
                firebase_functions_1.logger.info(`Deleted ${count} unlocked_media documents`);
        }
        catch (err) {
            firebase_functions_1.logger.error(`Error cleaning up unlocked_media:`, err);
        }
        // 2d. Main Documents
        await db.collection("creators").doc(userId).delete();
        await userDoc.ref.delete();
        firebase_functions_1.logger.info(`Deleted main user/creator records for ${userId}`);
        // 3. Auth Deletion 
        // This is done LAST to ensure Firestore is cleaned up while we still have the token context if needed, 
        // and because if this fails (e.g. user already deleted), we still want the return success.
        try {
            await auth.deleteUser(authUid);
            firebase_functions_1.logger.info(`Auth account deleted for authUid ${authUid}`);
        }
        catch (authError) {
            if (authError.code === 'auth/user-not-found') {
                firebase_functions_1.logger.warn(`Auth user ${authUid} not found during deletion. Continuing.`);
            }
            else {
                throw authError;
            }
        }
        return { success: true };
    }
    catch (error) {
        firebase_functions_1.logger.error(`deleteUserAccount FATAL ERROR for ${authUid}:`, error);
        // Map common errors or return a generic one
        throw new https_1.HttpsError("internal", error.message || "Deletion failed");
    }
});
//# sourceMappingURL=index.js.map