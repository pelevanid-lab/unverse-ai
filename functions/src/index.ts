import { logger } from "firebase-functions";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

admin.initializeApp();
ffmpeg.setFfmpegPath(ffmpegPath.path);

const db = admin.firestore();

// v2 Storage Function (Corrected)
export const optimizeMedia = onObjectFinalized({ timeoutSeconds: 540, memory: "1GiB" }, async (event) => {
    const { bucket, name: filePath, contentType } = event.data;
    const storageBucket = admin.storage().bucket(bucket);

    if (!filePath || !contentType || !filePath.startsWith("creator_media/") || filePath.includes("_optimized")) {
        return logger.log("Not a triggerable file:", filePath);
    }
    
    const originalFileUrl = await storageBucket.file(filePath).getSignedUrl({ action: 'read', expires: '03-09-2491' }).then(urls => urls[0]);

    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
    await storageBucket.file(filePath).download({ destination: tempFilePath });

    let optimizedTempPath: string | null = null;
    let newFileName: string;
    let newContentType: string;

    try {
        if (contentType.startsWith("image/")) {
            newFileName = path.basename(filePath, path.extname(filePath)) + "_optimized.webp";
            newContentType = "image/webp";
            optimizedTempPath = path.join(os.tmpdir(), newFileName);
            await sharp(tempFilePath).webp({ quality: 80 }).toFile(optimizedTempPath);
        } else if (contentType.startsWith("video/")) {
            newFileName = path.basename(filePath, path.extname(filePath)) + "_optimized.mp4";
            newContentType = "video/mp4";
            optimizedTempPath = path.join(os.tmpdir(), newFileName);
            await new Promise((resolve, reject) => {
                ffmpeg(tempFilePath)
                    .outputOptions(["-vcodec libx264", "-crf 28", "-preset fast"])
                    .toFormat('mp4')
                    .on("error", reject).on("end", resolve)
                    .save(optimizedTempPath as string);
            });
        } else {
            fs.unlinkSync(tempFilePath);
            return logger.log("Unsupported content type:", contentType);
        }

        const optimizedFilePath = path.join(path.dirname(filePath), newFileName);
        const [uploadedFile] = await storageBucket.upload(optimizedTempPath, {
            destination: optimizedFilePath,
            metadata: { contentType: newContentType },
        });

        const [optimizedUrl] = await uploadedFile.getSignedUrl({ action: 'read', expires: '03-09-2491' });
        
        const snapshot = await db.collection("creator_media").where("mediaUrl", "==", originalFileUrl).get();
        
        if (snapshot.empty) {
          logger.error("No matching document found for original file URL:", originalFileUrl);
        } else {
          for (const doc of snapshot.docs) {
            const currentData = doc.data();
            const updates: any = { 
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
        
        logger.log("Successfully optimized and updated document for:", filePath);
        await storageBucket.file(filePath).delete();

    } catch (error) {
        logger.error("Optimization failed:", error);
    } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (optimizedTempPath && fs.existsSync(optimizedTempPath)) fs.unlinkSync(optimizedTempPath);
    }
});

// v2 Scheduler Function (Enhanced with logging and higher frequency)
export const publishScheduledPosts = onSchedule("every 15 minutes", async (event) => {
    const now = admin.firestore.Timestamp.now();
    const nowMs = now.toMillis();
    
    logger.info(`Starting scheduled publish check at ${now.toDate().toISOString()} (${nowMs})`);

    const query = db.collection("creator_media")
      .where("status", "==", "scheduled")
      .where("scheduledFor", "<=", nowMs);
      
    const snapshot = await query.get();
    
    if (snapshot.empty) {
        logger.info("No scheduled posts to publish at this time.");
        return;
    }
    
    const postsCollection = db.collection("posts");
    const batch = db.batch();
    
    logger.info(`Found ${snapshot.docs.length} posts to publish.`);
    
    snapshot.docs.forEach(doc => {
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
        logger.info(`Queued publication for media ID: ${doc.id} (Scheduled for: ${mediaData.scheduledFor})`);
    });
    
    await batch.commit();
    
    logger.info("Successfully published all scheduled posts for this hour.");
});

/**
 * Securely handles Premium/Limited Content Unlock.
 * Split: 85% Creator, 10% Treasury, 5% Staking (Burn/Reward)
 */
export const unlockContent = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    // 1. Auth Check
    if (!request.auth) {
        throw new HttpsError("unauthenticated", "User must be logged in.");
    }

    const { postId } = request.data;
    if (!postId) throw new HttpsError("invalid-argument", "postId is required.");

    const userId = request.auth.uid;
    const db = admin.firestore();

    try {
        return await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) throw new HttpsError("not-found", "User profile not found.");
            
            const userData = userSnap.data();
            const unlockedPostIds = userData?.unlockedPostIds || [];
            
            if (unlockedPostIds.includes(postId)) {
                throw new HttpsError("already-exists", "Content already unlocked.");
            }

            const postRef = db.collection("posts").doc(postId);
            const postSnap = await transaction.get(postRef);
            if (!postSnap.exists) throw new HttpsError("not-found", "Post not found.");
            
            const postData = postSnap.data();
            if (postData?.creatorId === userId) {
                throw new HttpsError("failed-precondition", "You cannot unlock your own content.");
            }

            // Determine Price
            const price = postData?.contentType === 'limited' ? (postData?.limited?.price || 0) : (postData?.unlockPrice || 0);
            if (price <= 0) throw new HttpsError("failed-precondition", "Invalid post price.");

            // Balance Check
            const balance = userData?.ulcBalance?.available || 0;
            if (balance < price) {
                throw new HttpsError("failed-precondition", "INSUFFICIENT_BALANCE");
            }

            // Limited Edition Check
            if (postData?.contentType === 'limited') {
                const sold = postData?.limited?.soldCount || 0;
                const total = postData?.limited?.totalSupply || 0;
                if (sold >= total) throw new HttpsError("resource-exhausted", "Sold out.");
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

            // 3. Update Post Stats
            if (postData?.contentType === 'limited') {
                transaction.update(postRef, {
                    'limited.soldCount': admin.firestore.FieldValue.increment(1),
                    unlockCount: admin.firestore.FieldValue.increment(1)
                });
            } else {
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
    } catch (error: any) {
        logger.error("Unlock Content error:", error);
        throw new HttpsError("internal", error.message || "Internal transaction error.");
    }
});

/**
 * Confirms a ULC purchase after a successful on-chain transaction.
 */
export const confirmPurchase = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const { amount, network, txHash } = request.data;
    if (!amount || !network || !txHash) throw new HttpsError("invalid-argument", "Missing params.");

    const userId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();

    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
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
    } catch (error: any) {
        logger.error("Purchase confirmation error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Confirms a Pre-Sale ULC purchase.
 * Supports Tier-Based Pricing (Stage 1-5).
 * Vesting: 12 month cliff, 24 months linear release.
 */
export const confirmPresalePurchase = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const { amount, network, txHash } = request.data;
    if (!amount || !network || !txHash) throw new HttpsError("invalid-argument", "Missing purchase parameters.");

    const userId = request.auth.uid;
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
        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const configRef = db.collection("config").doc("system");
            const configSnap = await transaction.get(configRef);
            const config = configSnap.data();

            const totalSoldBefore = config?.totalPresaleSold || 0;
            const presalePool = config?.pools?.presale || 0;

            if (totalSoldBefore >= PRESALE_TOTAL_ALLOCATION) {
                throw new HttpsError("resource-exhausted", "Pre-Sale is SOLD OUT.");
            }

            // --- CROSS-STAGE CALCULATION ---
            let remainingUsdt = amount;
            let totalUlc = 0;
            let currentSold = totalSoldBefore;
            const breakdown: { stage: number; ulcAmount: number; priceUSDT: number }[] = [];

            for (const tier of PRESALE_TIERS) {
                if (currentSold >= tier.limit) continue;
                if (remainingUsdt <= 0) break;

                const remainingInTier = tier.limit - currentSold;
                const costForTier = remainingInTier * tier.price;

                if (remainingUsdt <= costForTier) {
                    const ulcInTier = remainingUsdt / tier.price;
                    totalUlc += ulcInTier;
                    breakdown.push({ stage: tier.stage, ulcAmount: ulcInTier, priceUSDT: tier.price });
                    remainingUsdt = 0;
                } else {
                    totalUlc += remainingInTier;
                    breakdown.push({ stage: tier.stage, ulcAmount: remainingInTier, priceUSDT: tier.price });
                    remainingUsdt -= costForTier;
                    currentSold = tier.limit;
                }
            }

            const ulcAmount = Math.floor(totalUlc);
            if (presalePool < ulcAmount) {
                throw new HttpsError("resource-exhausted", "Insufficient Pre-Sale allocation left for this amount.");
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
                description: `Pre-Sale Allocation (Avg Price: $${(amount/ulcAmount).toFixed(4)})`,
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
    } catch (error: any) {
        logger.error("Pre-Sale confirmation error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Creates a new Vesting Schedule for a user.
 * Restricted to the Admin Wallet defined in system config.
 */
const VESTING_PRESETS: Record<string, { cliffMonths: number; durationMonths: number }> = {
    reserve: { cliffMonths: 0, durationMonths: 240 },
    team: { cliffMonths: 0, durationMonths: 36 },
    creators: { cliffMonths: 0, durationMonths: 24 },
    presale: { cliffMonths: 12, durationMonths: 24 },
    liquidity: { cliffMonths: 0, durationMonths: 0 },
    exchanges: { cliffMonths: 0, durationMonths: 0 },
    promo: { cliffMonths: 0, durationMonths: 0 },
    staking: { cliffMonths: 0, durationMonths: 0 }
};

export const createVestingSchedule = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const { targetUserId, totalAmount, durationMonths, cliffMonths, description, poolId } = request.data;
    if (!targetUserId || !totalAmount || poolId === undefined) {
        throw new HttpsError("invalid-argument", "Missing required vesting parameters.");
    }

    const adminId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();

    // --- ENFORCEMENT ---
    let finalCliff = cliffMonths || 0;
    let finalDuration = durationMonths;

    if (poolId !== "promo") {
        const preset = VESTING_PRESETS[poolId];
        if (!preset) throw new HttpsError("invalid-argument", `Invalid pool: ${poolId}`);
        
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
            const tokenWallet = (request.auth?.token as any)?.walletAddress;

            const isAdmin = adminId === VERIFIED_ADMIN_UID || 
                            userData?.isAdmin === true || 
                            userData?.walletAddress?.toLowerCase() === adminWallet?.toLowerCase() ||
                            tokenWallet?.toLowerCase() === adminWallet?.toLowerCase();

            if (!isAdmin) {
                logger.error("ACCESS_DENIED", { uid: adminId, wallet: tokenWallet });
                throw new HttpsError("permission-denied", "Only the system admin can create vesting schedules.");
            }

            // 2. Pool Deduction Logic
            const pools = configData?.pools || {};
            const currentPoolBalance = pools[poolId] || 0;

            if (currentPoolBalance < totalAmount) {
                throw new HttpsError("failed-precondition", `Insufficient balance in ${poolId} pool.`);
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
    } catch (error: any) {
        logger.error("Vesting creation error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Calculates and claims vested ULC for a specific schedule.
 * Moves tokens from 'locked' to 'available'.
 */
export const claimVestedULC = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const { scheduleId } = request.data;
    if (!scheduleId) throw new HttpsError("invalid-argument", "scheduleId is required.");

    const userId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();

    try {
        return await db.runTransaction(async (transaction) => {
            const scheduleRef = db.collection("vesting_schedules").doc(scheduleId);
            const scheduleSnap = await transaction.get(scheduleRef);
            
            if (!scheduleSnap.exists) throw new HttpsError("not-found", "Schedule not found.");
            
            const schedule = scheduleSnap.data();
            if (schedule?.userId !== userId) throw new HttpsError("permission-denied", "Unauthorized.");

            const { totalAmount, startTime, duration, cliff, releasedAmount } = schedule as any;
            
            // --- CALCULATION ---
            if (now < startTime + cliff) {
                throw new HttpsError("failed-precondition", "Cliff period not yet reached.");
            }

            const timePassed = now - startTime;
            const vestingRatio = Math.min(1, timePassed / duration);
            const totalVestedToDate = totalAmount * vestingRatio;
            const claimableNow = Math.max(0, totalVestedToDate - releasedAmount);

            if (claimableNow < 0.01) {
                throw new HttpsError("failed-precondition", "No claimable tokens at this time.");
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
    } catch (error: any) {
        logger.error("Vesting claim error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Monthly Staking Reward Distribution
 * Occurs on the 27th of every month.
 * Logic: Distribution = (UserStaked / TotalEligibleStaked) * StakingPool
 * Multiplier: 1 USDT in pool = 100 ULC rewarded (Simplified buyback simulation)
 */
export const distributeStakingRewards = onSchedule("0 0 27 * *", async (event) => {
    const db = admin.firestore();
    const configRef = db.collection("config").doc("system");
    const configSnap = await configRef.get();
    const config = configSnap.data();
    
    const rewardPoolUSDT = config?.totalBuybackStakingUSDT || 0;
    if (rewardPoolUSDT <= 0) {
        logger.info("Staking reward pool is empty.");
        return;
    }

    const listingPrice = config?.listingPriceUSDT || 0.015;
    const rewardPoolULC = rewardPoolUSDT / listingPrice; 
    const usersSnap = await db.collection("users").where("ulcBalance.staked", ">", 0).get();
    
    let totalEligibleStaked = 0;
    const eligibleUsers: { id: string, staked: number }[] = [];
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
        logger.info("No eligible stakers (30-day lock period not met by anyone).");
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
    logger.info(`Successfully distributed ${rewardPoolULC} ULC rewards to ${eligibleUsers.length} eligible stakers.`);
});
/**
 * Securely retrieves a 30-minute signed URL for premium/limited content.
 */
export const getPostMedia = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "User must be logged in.");
    
    const { postId } = request.data;
    if (!postId) throw new HttpsError("invalid-argument", "postId is required.");
    
    const userId = request.auth.uid;
    const db = admin.firestore();

    try {
        const postSnap = await db.collection("posts").doc(postId).get();
        if (!postSnap.exists) throw new HttpsError("not-found", "Post not found.");
        
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
                    throw new HttpsError("permission-denied", "You haven't unlocked this content.");
                }
            }
        }

        const mediaUrl = postData?.mediaUrl;
        if (!mediaUrl) throw new HttpsError("not-found", "Media URL not found.");

        // If it's already an HTTP URL and not gs://, and it's public, just return it
        // But for premium, we want to generate a fresh signed URL even if mediaUrl was previously a signed URL
        // To be safe, we parse the path from the URL if it's a firebase storage URL
        
        let filePath = "";
        if (mediaUrl.includes("firebasestorage.googleapis.com")) {
            // Extract path between /o/ and ?
            const match = mediaUrl.match(/\/o\/(.+?)\?/);
            if (match) filePath = decodeURIComponent(match[1]);
        } else if (mediaUrl.startsWith("gs://")) {
            filePath = mediaUrl.replace(/gs:\/\/.+?\//, "");
        } else {
            // Fallback: If it's a direct URL we can't secure easily, just return it
            return { url: mediaUrl };
        }

        if (!filePath) return { url: mediaUrl };

        const bucket = admin.storage().bucket();
        const [signedUrl] = await bucket.file(filePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 60 * 1000 // 30 minutes
        });

        return { url: signedUrl };

    } catch (error: any) {
        logger.error("getPostMedia error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * SEAL ECONOMY PROTOCOL
 * 1. Atomically splits 420M ULC Reserve Pool into 4 system schedules.
 * 2. Ratios: Team (126M), Liquidity (84M), Promo (42M), DAO (168M).
 * 3. Terms: 0 month cliff, 240 month linear duration.
 * 4. Locks the economy forever.
 */
export const sealEconomy = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const db = admin.firestore();
    const now = Date.now();
    const adminId = request.auth.uid;

    const configRef = db.collection("config").doc("system");
    
    try {
        return await db.runTransaction(async (transaction) => {
            const configSnap = await transaction.get(configRef);
            const configData = configSnap.data();

            if (configData?.isSealed) {
                throw new HttpsError("already-exists", "Economy is already sealed.");
            }

            // Admin Authorization
            const VERIFIED_ADMIN_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2";
            if (adminId !== VERIFIED_ADMIN_UID) {
                throw new HttpsError("permission-denied", "Unauthorized admin.");
            }

            const reserveBalance = configData?.pools?.reserve || 0;
            if (reserveBalance < 420000000) {
                throw new HttpsError("failed-precondition", "Insufficient Reserve balance for sealing.");
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
    } catch (error: any) {
        logger.error("Seal Economy Error:", error);
        throw new HttpsError("internal", error.message);
    }
});
/**
 * Executes a strategic Buyback & Burn.
 * Restricted to Admin. Enforces launch gates.
 */
export const executeBuyback = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const { amountUSDT, description } = request.data;
    if (!amountUSDT) throw new HttpsError("invalid-argument", "Amount is required.");

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
                 throw new HttpsError("permission-denied", "Unauthorized.");
            }

            // 2. Launch Gates Check
            const isReady = config?.presaleCompleted && config?.tokenLaunchCompleted && config?.marketLiquidityReady;
            if (!isReady) {
                throw new HttpsError("failed-precondition", "LAUNCH_GATED: All conditions must be met.");
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
    } catch (error: any) {
        logger.error("Buyback execution error:", error);
        throw new HttpsError("internal", error.message);
    }
});
