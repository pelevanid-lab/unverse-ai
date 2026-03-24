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
exports.checkScheduledPosts = exports.joinCreatorProgram = exports.sealEconomy_v2 = exports.createVestingSchedule_v2 = exports.getPostMedia = exports.optimizeMedia = void 0;
const firebase_functions_1 = require("firebase-functions");
const storage_1 = require("firebase-functions/v2/storage");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const admin = __importStar(require("firebase-admin"));
const sharp_1 = __importDefault(require("sharp"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_1 = __importDefault(require("@ffmpeg-installer/ffmpeg"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
if (!admin.apps.length) {
    admin.initializeApp();
}
fluent_ffmpeg_1.default.setFfmpegPath(ffmpeg_1.default.path);
const db = admin.firestore();
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
async function getUserDoc(db, authUid) {
    const directRef = db.collection("users").doc(authUid);
    const directSnap = await directRef.get();
    if (directSnap.exists)
        return { ref: directRef, data: directSnap.data() };
    const lowerAuthUid = authUid.toLowerCase();
    if (authUid !== lowerAuthUid) {
        const lowerRef = db.collection("users").doc(lowerAuthUid);
        const lowerSnap = await lowerRef.get();
        if (lowerSnap.exists)
            return { ref: lowerRef, data: lowerSnap.data() };
    }
    const querySnap = await db.collection("users").where("authUid", "==", authUid).limit(1).get();
    if (!querySnap.empty) {
        return { ref: querySnap.docs[0].ref, data: querySnap.docs[0].data() };
    }
    if (authUid !== lowerAuthUid) {
        const lowerQuerySnap = await db.collection("users").where("authUid", "==", lowerAuthUid).limit(1).get();
        if (!lowerQuerySnap.empty) {
            return { ref: lowerQuerySnap.docs[0].ref, data: lowerQuerySnap.docs[0].data() };
        }
    }
    return null;
}
exports.optimizeMedia = (0, storage_1.onObjectFinalized)({ timeoutSeconds: 540, memory: "1GiB" }, async (event) => {
    const { bucket, name: filePath, contentType } = event.data;
    const storageBucket = admin.storage().bucket(bucket);
    if (!filePath || !contentType || !filePath.startsWith("creator_media/") || filePath.includes("_optimized")) {
        return firebase_functions_1.logger.log("Not a triggerable file:", filePath);
    }
    // We avoid getSignedUrl here to prevent iam.serviceAccounts.signBlob errors
    // and because it's an unreliable way to match documents.
    const tempFilePath = path.join(os.tmpdir(), path.basename(filePath));
    await storageBucket.file(filePath).download({ destination: tempFilePath });
    let optimizedTempPath = "";
    let newFileName = "";
    let newContentType = "";
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
            if (fs.existsSync(tempFilePath))
                fs.unlinkSync(tempFilePath);
            return firebase_functions_1.logger.log("Unsupported content type:", contentType);
        }
        const optimizedFilePath = path.join(path.dirname(filePath), newFileName);
        await storageBucket.upload(optimizedTempPath, {
            destination: optimizedFilePath,
            metadata: { contentType: newContentType },
        });
        // Use publicUrl or simple formatting to avoid getSignedUrl crash if possible
        const optimizedUrl = `https://storage.googleapis.com/${bucket}/${optimizedFilePath}`;
        // Match by SEARCHING for the filePath in the mediaUrl string (robust fallback)
        const snapshot = await db.collection("creator_media")
            .where("mediaUrl", ">=", `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath).replace(/%2F/g, '/')}`)
            .get();
        let matched = false;
        if (!snapshot.empty) {
            for (const doc of snapshot.docs) {
                const data = doc.data();
                // Verify it's the right the right file
                if (data.mediaUrl.includes(filePath)) {
                    const currentData = doc.data();
                    const updates = { mediaUrl: optimizedUrl, isOptimized: true };
                    if (currentData.status !== 'scheduled' && currentData.status !== 'published') {
                        updates.status = 'draft';
                    }
                    await doc.ref.update(updates);
                    matched = true;
                }
            }
        }
        if (!matched) {
            firebase_functions_1.logger.warn("No matching document found in creator_media for path:", filePath);
        }
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
/**
 * SECURE MEDIA ACCESS: Generates a signed URL for authorized users.
 */
exports.getPostMedia = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    const { postId } = request.data;
    if (!postId)
        throw new https_1.HttpsError("invalid-argument", "postId is required.");
    const postRef = db.collection("posts").doc(postId);
    const postSnap = await postRef.get();
    if (!postSnap.exists)
        throw new https_1.HttpsError("not-found", "Post not found.");
    const postData = postSnap.data();
    const userId = request.auth.uid;
    const creatorId = postData.creatorId;
    // 1. Authorization Logic: Resolve UID/Wallet mapping
    const userDocResult = await getUserDoc(db, userId);
    const userRef = userDocResult?.ref;
    const userWallet = userDocResult?.data?.walletAddress || userRef?.id;
    // Check if the requester is the owner (matching UID or Wallet)
    let hasAccess = userId === creatorId || userWallet?.toLowerCase() === creatorId?.toLowerCase();
    if (!hasAccess) {
        // Resolve Creator's identities to be sure
        const creatorDocResult = await getUserDoc(db, creatorId);
        const creatorUid = creatorDocResult?.data?.uid || creatorId;
        const creatorWallet = creatorDocResult?.data?.walletAddress || creatorId;
        // Check Active Subscription (Try both UID and Wallet)
        const subSnap = await db.collection("subscriptions")
            .where("userId", "==", userId)
            .where("creatorId", "in", [creatorUid, creatorWallet])
            .where("status", "==", "active")
            .limit(1).get();
        if (!subSnap.empty)
            hasAccess = true;
        // Check Individual Unlock (Ledger)
        if (!hasAccess) {
            const unlockSnap = await db.collection("ledger")
                .where("fromUserId", "==", userId)
                .where("type", "==", "premium_unlock")
                .where("referenceId", "==", postId)
                .limit(1).get();
            if (!unlockSnap.empty)
                hasAccess = true;
        }
    }
    if (!hasAccess)
        throw new https_1.HttpsError("permission-denied", "You do not have access to this premium content.");
    // 2. Generate Secure URL
    try {
        const bucket = admin.storage().bucket();
        let storagePath = postData.mediaUrl;
        // Robust path extraction from various Firebase/GCP URL formats
        if (storagePath.startsWith("http")) {
            const decoded = decodeURIComponent(storagePath);
            if (decoded.includes("/o/")) {
                // Firebase Storage format
                storagePath = decoded.split("/o/")[1].split("?")[0];
            }
            else if (decoded.includes(bucket.name)) {
                // Google Cloud Storage format
                storagePath = decoded.split(bucket.name + "/")[1]?.split("?")[0] || storagePath;
            }
        }
        firebase_functions_1.logger.log(`Generating signed URL for path: [${storagePath}] from mediaUrl: [${postData.mediaUrl}]`);
        const [url] = await bucket.file(storagePath).getSignedUrl({
            action: 'read',
            expires: Date.now() + 60 * 60 * 1000,
        });
        return { url };
    }
    catch (err) {
        firebase_functions_1.logger.error("getPostMedia Error details:", {
            error: err.message,
            code: err.code,
            mediaUrl: postData.mediaUrl
        });
        throw new https_1.HttpsError("internal", `Secure URL generation failed. Role needed: 'Service Account Token Creator' for the current service account. Error: ${err.message}`);
    }
});
exports.createVestingSchedule_v2 = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const { targetUserId, totalAmount, durationMonths, cliffMonths, description, poolId } = request.data;
    const adminId = request.auth.uid;
    const adminUserDoc = await getUserDoc(db, adminId);
    if (!adminUserDoc)
        throw new https_1.HttpsError("permission-denied", "Admin profile not found.");
    const adminData = adminUserDoc.data;
    let finalCliff = cliffMonths || 0;
    let finalDuration = durationMonths;
    if (poolId !== "promo") {
        const preset = VESTING_PRESETS[poolId];
        if (!preset)
            throw new https_1.HttpsError("invalid-argument", `Invalid pool: ${poolId}`);
        finalCliff = preset.cliffMonths;
        finalDuration = preset.durationMonths;
    }
    const configRef = db.collection("config").doc("system");
    const scheduleRef = db.collection("vesting_schedules").doc();
    return await db.runTransaction(async (transaction) => {
        const configSnap = await transaction.get(configRef);
        const configData = configSnap.data();
        const VERIFIED_ADMIN_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2";
        const userWalletId = adminUserDoc.ref.id;
        const isAdmin = adminId === VERIFIED_ADMIN_UID ||
            adminData?.isAdmin === true ||
            userWalletId.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa" ||
            adminData?.walletAddress?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa" ||
            request.auth?.token?.walletAddress?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";
        if (!isAdmin) {
            firebase_functions_1.logger.error("ACCESS_DENIED_FINAL", { uid: adminId, wallet: userWalletId });
            throw new https_1.HttpsError("permission-denied", "Only the system admin can create vesting schedules.");
        }
        const pools = configData?.pools || {};
        if ((pools[poolId] || 0) < totalAmount) {
            throw new https_1.HttpsError("failed-precondition", `Insufficient balance in ${poolId} pool.`);
        }
        const durationMs = finalDuration * 30 * 24 * 60 * 60 * 1000;
        const cliffMs = finalCliff * 30 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        transaction.update(configRef, { [`pools.${poolId}`]: admin.firestore.FieldValue.increment(-totalAmount) });
        transaction.set(scheduleRef, {
            userId: targetUserId,
            totalAmount,
            releasedAmount: 0,
            startTime: now,
            cliff: cliffMs,
            duration: durationMs,
            description,
            poolId,
            createdAt: now
        });
        transaction.update(db.collection("users").doc(targetUserId), { "ulcBalance.locked": admin.firestore.FieldValue.increment(totalAmount) });
        transaction.set(db.collection("ledger").doc(), {
            type: "vesting_created",
            toUserId: targetUserId,
            amount: totalAmount,
            poolId,
            timestamp: now
        });
        return { success: true, scheduleId: scheduleRef.id };
    });
});
exports.sealEconomy_v2 = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required.");
    const adminId = request.auth.uid;
    const adminUserDoc = await getUserDoc(db, adminId);
    if (!adminUserDoc)
        throw new https_1.HttpsError("permission-denied", "Admin profile not found.");
    const adminData = adminUserDoc.data;
    const userWalletId = adminUserDoc.ref.id;
    const VERIFIED_MASTER_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2";
    const isAdmin = adminId === VERIFIED_MASTER_UID ||
        adminData?.isAdmin === true ||
        userWalletId?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa" ||
        adminData?.walletAddress?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";
    if (!isAdmin)
        throw new https_1.HttpsError("permission-denied", "Unauthorized admin.");
    const configRef = db.collection("config").doc("system");
    await db.runTransaction(async (transaction) => {
        const configSnap = await transaction.get(configRef);
        const data = configSnap.data();
        if (data?.isSealed)
            return;
        transaction.update(configRef, { isSealed: true, sealedAt: Date.now() });
    });
    return { success: true };
});
exports.joinCreatorProgram = (0, https_1.onCall)({ memory: "256MiB" }, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "Authentication required.");
    const authUid = request.auth.uid;
    const userDocResult = await getUserDoc(db, authUid);
    if (!userDocResult)
        throw new https_1.HttpsError("not-found", "User profile not found.");
    const { ref: userRef, data: userData } = userDocResult;
    if (userData.isCreator)
        return { success: true, message: "Already in program." };
    return await db.runTransaction(async (transaction) => {
        const configRef = db.collection("config").doc("system");
        const configSnap = await transaction.get(configRef);
        const configData = configSnap.data();
        const currentCount = configData?.creatorProgramCount || 0;
        if (currentCount >= 100)
            throw new https_1.HttpsError("failed-precondition", "Program is full.");
        transaction.update(userRef, {
            isCreator: true,
            creatorInFirst100Program: true,
            creatorProgramIndex: currentCount + 1
        });
        transaction.update(configRef, { creatorProgramCount: admin.firestore.FieldValue.increment(1) });
        return { success: true };
    });
});
exports.checkScheduledPosts = (0, scheduler_1.onSchedule)("every 30 minutes", async (event) => {
    firebase_functions_1.logger.log("Running scheduled post check...");
    const now = Date.now();
    // 1. Query for scheduled posts that are due
    const snapshot = await admin.firestore().collection("creator_media")
        .where("status", "==", "scheduled")
        .where("scheduledFor", "<=", now)
        .get();
    if (snapshot.empty) {
        firebase_functions_1.logger.log("No pending scheduled posts found.");
        return;
    }
    firebase_functions_1.logger.log(`Found ${snapshot.size} posts to publish.`);
    for (const doc of snapshot.docs) {
        const mediaData = doc.data();
        try {
            // 2. Fetch Creator Metadata
            const userSnap = await admin.firestore().collection("users").doc(mediaData.creatorId).get();
            if (!userSnap.exists) {
                firebase_functions_1.logger.error(`Creator ${mediaData.creatorId} not found for media ${doc.id}`);
                continue;
            }
            const creator = userSnap.data();
            // 3. Construct Post Document
            const postData = {
                creatorId: mediaData.creatorId,
                creatorName: creator?.username || "Unknown",
                creatorAvatar: creator?.avatar || "",
                mediaUrl: mediaData.mediaUrl,
                mediaType: mediaData.mediaType || "image",
                content: mediaData.caption || "",
                contentType: mediaData.contentType || "public",
                unlockPrice: mediaData.priceULC || 0,
                createdAt: now,
                likes: 0,
                unlockCount: 0,
                earningsULC: 0,
                // AI prompts
                ...(mediaData.isAI && {
                    isAI: true,
                    aiPrompt: mediaData.aiPrompt || mediaData.prompt || "",
                    aiEnhancedPrompt: mediaData.aiEnhancedPrompt || mediaData.enhancedPrompt || ""
                }),
                // Limited edition data
                ...(mediaData.contentType === "limited" && {
                    limited: {
                        totalSupply: mediaData.limited?.totalSupply || 100,
                        soldCount: 0,
                        price: mediaData.limited?.price || mediaData.priceULC || 0
                    }
                })
            };
            // 4. Atomic Transaction: Create Post and Delete Media
            const batch = admin.firestore().batch();
            const postRef = admin.firestore().collection("posts").doc();
            batch.set(postRef, postData);
            batch.delete(doc.ref);
            await batch.commit();
            firebase_functions_1.logger.log(`Successfully published post ${postRef.id} for creator ${mediaData.creatorId}`);
        }
        catch (error) {
            firebase_functions_1.logger.error(`Failed to publish media ${doc.id}:`, error);
        }
    }
    firebase_functions_1.logger.log("Scheduled publish cycle completed.");
});
//# sourceMappingURL=index.js.map