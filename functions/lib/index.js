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
exports.getPostMedia = exports.distributeStakingRewards = exports.claimVestedULC = exports.createVestingSchedule = exports.confirmPresalePurchase = exports.confirmPurchase = exports.unlockContent = exports.publishScheduledPosts = exports.optimizeMedia = void 0;
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
// v2 Scheduler Function (Corrected)
exports.publishScheduledPosts = (0, scheduler_1.onSchedule)("every 1 hours synchronized", async (event) => {
    const now = admin.firestore.Timestamp.now();
    const query = db.collection("creator_media")
        .where("status", "==", "scheduled")
        .where("scheduledFor", "<=", now.toMillis());
    const snapshot = await query.get();
    if (snapshot.empty) {
        firebase_functions_1.logger.info("No scheduled posts to publish at this hour.");
        return;
    }
    const postsCollection = db.collection("posts");
    const batch = db.batch();
    firebase_functions_1.logger.info(`Found ${snapshot.docs.length} posts to publish.`);
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
        };
        const newPostRef = postsCollection.doc();
        batch.set(newPostRef, newPostData);
        batch.delete(doc.ref);
    });
    await batch.commit();
    firebase_functions_1.logger.info("Successfully published all scheduled posts for this hour.");
});
/**
 * Securely handles Premium/Limited Content Unlock.
 * Split: 85% Creator, 10% Treasury, 5% Staking (Burn/Reward)
 */
exports.unlockContent = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    // 1. Auth Check
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "User must be logged in.");
    }
    const { postId } = request.data;
    if (!postId)
        throw new https_1.HttpsError("invalid-argument", "postId is required.");
    const userId = request.auth.uid;
    const db = admin.firestore();
    try {
        return await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists)
                throw new https_1.HttpsError("not-found", "User profile not found.");
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
            // --- 85/15 Split Logic (Dynamic) ---
            const creatorShare = price * 0.85;
            const platformMargin = price * 0.15;
            const treasuryRatio = 0.67; // 10% of total (0.15 * 0.67 approx 0.10)
            const burnRatio = 0.33; // 5% of total (0.15 * 0.33 approx 0.05)
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
    const userId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
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
            // 2. Record ULC Entry
            const ulcLedgerRef = db.collection("ledger").doc();
            transaction.set(ulcLedgerRef, {
                toUserId: userId,
                amount: amount,
                currency: "ULC",
                type: "ulc_purchase",
                referenceId: usdtLedgerRef.id,
                timestamp: now
            });
            // 3. Update User Balance
            transaction.update(userRef, {
                'ulcBalance.available': admin.firestore.FieldValue.increment(amount)
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
 * Price: 0.01 USDT / ULC
 * Vesting: 1 month cliff, 12 months linear release.
 */
exports.confirmPresalePurchase = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const { amount, network, txHash } = request.data;
    if (!amount || !network || !txHash)
        throw new https_1.HttpsError("invalid-argument", "Missing params.");
    const userId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    const ulcAmount = amount * 100; // 0.01 USDT price -> 1 USDT = 100 ULC
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const configRef = db.collection("config").doc("system");
            const scheduleRef = db.collection("vesting_schedules").doc();
            const configSnap = await transaction.get(configRef);
            const configData = configSnap.data();
            const presalePool = configData?.pools?.presale || 0;
            if (presalePool < ulcAmount) {
                throw new https_1.HttpsError("resource-exhausted", "Not enough tokens left in Pre-Sale allocation.");
            }
            // 1. Audit Ledger (USDT Payment)
            const usdtLedgerRef = db.collection("ledger").doc();
            transaction.set(usdtLedgerRef, {
                fromUserId: userId,
                amount: amount,
                currency: "USDT",
                type: "ulc_purchase_payment",
                network,
                txHash,
                timestamp: now
            });
            // 2. Pre-Sale Purchase Ledger (ULC)
            transaction.set(db.collection("ledger").doc(), {
                toUserId: userId,
                amount: ulcAmount,
                currency: "ULC",
                type: "presale_purchase",
                referenceId: usdtLedgerRef.id,
                timestamp: now
            });
            // 3. Automatic Vesting Schedule
            // Preset: presale (1 month cliff, 12 months duration)
            const cliffMs = 1 * 30 * 24 * 60 * 60 * 1000;
            const durationMs = 12 * 30 * 24 * 60 * 60 * 1000;
            transaction.set(scheduleRef, {
                userId,
                totalAmount: ulcAmount,
                releasedAmount: 0,
                startTime: now,
                cliff: cliffMs,
                duration: durationMs,
                description: "Pre-Sale Allocation",
                poolId: "presale",
                lastClaimedAt: 0,
                createdAt: now
            });
            // 4. Update User Profile (Move to Locked)
            transaction.update(userRef, {
                'ulcBalance.locked': admin.firestore.FieldValue.increment(ulcAmount)
            });
            // 5. Update Global Stats
            transaction.update(configRef, {
                'pools.presale': admin.firestore.FieldValue.increment(-ulcAmount),
                'totalPresaleSold': admin.firestore.FieldValue.increment(ulcAmount),
                'totalTreasuryUSDT': admin.firestore.FieldValue.increment(amount)
            });
        });
        return { success: true, ulcAmount };
    }
    catch (error) {
        firebase_functions_1.logger.error("Pre-Sale purchase error:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
/**
 * Creates a new Vesting Schedule for a user.
 * Restricted to the Admin Wallet defined in system config.
 */
const VESTING_PRESETS = {
    reserve: { cliffMonths: 6, durationMonths: 48 },
    team: { cliffMonths: 12, durationMonths: 48 },
    creators: { cliffMonths: 0, durationMonths: 24 },
    presale: { cliffMonths: 1, durationMonths: 12 },
    liquidity: { cliffMonths: 0, durationMonths: 0 },
    exchanges: { cliffMonths: 0, durationMonths: 0 }
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
    const userId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();
    try {
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
    const rewardPoolULC = rewardPoolUSDT * 100; // 1 USDT = 100 ULC fixed for internal reward calculation
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
    // Reset USDT Pool after successful 'buyback' reward distribution
    batch.update(configRef, { totalBuybackStakingUSDT: 0 });
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
    const userId = request.auth.uid;
    const db = admin.firestore();
    try {
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
//# sourceMappingURL=index.js.map