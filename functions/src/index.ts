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

// v2 Scheduler Function (Corrected)
export const publishScheduledPosts = onSchedule("every 1 hours synchronized", async (event) => {
    const now = admin.firestore.Timestamp.now();
    
    const query = db.collection("creator_media")
      .where("status", "==", "scheduled")
      .where("scheduledFor", "<=", now.toMillis());
      
    const snapshot = await query.get();
    
    if (snapshot.empty) {
        logger.info("No scheduled posts to publish at this hour.");
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
        };
      
        const newPostRef = postsCollection.doc();
        batch.set(newPostRef, newPostData);
        batch.delete(doc.ref);
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

            // --- 85/15 Split Logic ---
            const creatorShare = price * 0.85;
            const treasuryShare = price * 0.10;
            const stakingShare = price * 0.05;

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

            // 4. Record Ledger Entries
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
                type: "staking_reward",
                toWallet: "SYSTEM_STAKING_POOL",
                amount: stakingShare,
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
    } catch (error: any) {
        logger.error("Purchase confirmation error:", error);
        throw new HttpsError("internal", error.message);
    }
});

/**
 * Creates a new Vesting Schedule for a user.
 * Restricted to the Admin Wallet defined in system config.
 */
export const createVestingSchedule = onCall({ memory: "256MiB" }, async (request: CallableRequest) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    
    const { targetUserId, totalAmount, durationMonths, cliffMonths, description } = request.data;
    if (!targetUserId || !totalAmount || !durationMonths) {
        throw new HttpsError("invalid-argument", "Missing required vesting parameters.");
    }

    const adminId = request.auth.uid;
    const db = admin.firestore();
    const now = Date.now();

    try {
        const configSnap = await db.collection("config").doc("system").get();
        const config = configSnap.data();
        
        // Admin Check (Using address comparison)
        const userSnap = await db.collection("users").doc(adminId).get();
        const adminWallet = userSnap.data()?.walletAddress;
        
        if (!adminWallet || adminWallet.toLowerCase() !== config?.admin_wallet_address?.toLowerCase()) {
            throw new HttpsError("permission-denied", "Only the system admin can create vesting schedules.");
        }

        const durationMs = durationMonths * 30 * 24 * 60 * 60 * 1000;
        const cliffMs = (cliffMonths || 0) * 30 * 24 * 60 * 60 * 1000;

        const scheduleRef = db.collection("vesting_schedules").doc();

        await db.runTransaction(async (transaction) => {
            const targetUserRef = db.collection("users").doc(targetUserId);

            // 1. Create Schedule
            transaction.set(scheduleRef, {
                userId: targetUserId,
                totalAmount,
                startTime: now,
                duration: durationMs,
                cliff: cliffMs,
                releasedAmount: 0,
                description: description || "System Vesting",
                createdAt: now
            });

            // 2. Lock the tokens in User Profile
            transaction.update(targetUserRef, {
                'ulcBalance.locked': admin.firestore.FieldValue.increment(totalAmount)
            });

            // 3. Record Ledger Entry
            transaction.set(db.collection("ledger").doc(), {
                type: "vesting_created",
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
