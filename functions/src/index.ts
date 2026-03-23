import { logger } from "firebase-functions";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

if (!admin.apps.length) {
    admin.initializeApp();
}
ffmpeg.setFfmpegPath(ffmpegPath.path);

const db = admin.firestore();

const VESTING_PRESETS: any = {
    reserve: { cliffMonths: 0, durationMonths: 240 },
    team: { cliffMonths: 0, durationMonths: 36 },
    creators: { cliffMonths: 0, durationMonths: 24 },
    presale: { cliffMonths: 12, durationMonths: 24 },
    liquidity: { cliffMonths: 0, durationMonths: 0 },
    exchanges: { cliffMonths: 0, durationMonths: 0 },
    promo: { cliffMonths: 0, durationMonths: 0 },
    staking: { cliffMonths: 0, durationMonths: 0 }
};

async function getUserDoc(db: admin.firestore.Firestore, authUid: string) {
    const directRef = db.collection("users").doc(authUid);
    const directSnap = await directRef.get();
    if (directSnap.exists) return { ref: directRef, data: directSnap.data() as any };

    const lowerAuthUid = authUid.toLowerCase();
    if (authUid !== lowerAuthUid) {
        const lowerRef = db.collection("users").doc(lowerAuthUid);
        const lowerSnap = await lowerRef.get();
        if (lowerSnap.exists) return { ref: lowerRef, data: lowerSnap.data() as any };
    }

    const querySnap = await db.collection("users").where("authUid", "==", authUid).limit(1).get();
    if (!querySnap.empty) {
        return { ref: querySnap.docs[0].ref, data: querySnap.docs[0].data() as any };
    }
    
    if (authUid !== lowerAuthUid) {
        const lowerQuerySnap = await db.collection("users").where("authUid", "==", lowerAuthUid).limit(1).get();
        if (!lowerQuerySnap.empty) {
            return { ref: lowerQuerySnap.docs[0].ref, data: lowerQuerySnap.docs[0].data() as any };
        }
    }
    return null;
}

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
            const updates: any = { mediaUrl: optimizedUrl, isOptimized: true };
            if (currentData.status !== 'scheduled' && currentData.status !== 'published') {
                updates.status = 'draft'; 
            }
            await doc.ref.update(updates);
          }
        }
        await storageBucket.file(filePath).delete();
    } catch (error) {
        logger.error("Optimization failed:", error);
    } finally {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        if (optimizedTempPath && fs.existsSync(optimizedTempPath)) fs.unlinkSync(optimizedTempPath);
    }
});

export const createVestingSchedule_v2 = onCall({ memory: "256MiB" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const { targetUserId, totalAmount, durationMonths, cliffMonths, description, poolId } = request.data;
    const adminId = request.auth.uid;
    const adminUserDoc = await getUserDoc(db, adminId);
    if (!adminUserDoc) throw new HttpsError("permission-denied", "Admin profile not found.");
    const adminData: any = adminUserDoc.data;

    let finalCliff = cliffMonths || 0;
    let finalDuration = durationMonths;
    if (poolId !== "promo") {
        const preset = VESTING_PRESETS[poolId];
        if (!preset) throw new HttpsError("invalid-argument", `Invalid pool: ${poolId}`);
        finalCliff = preset.cliffMonths;
        finalDuration = preset.durationMonths;
    }

    const configRef = db.collection("config").doc("system");
    const scheduleRef = db.collection("vesting_schedules").doc();

    return await db.runTransaction(async (transaction) => {
        const configSnap = await transaction.get(configRef);
        const configData: any = configSnap.data();
        const VERIFIED_ADMIN_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2";
        const userWalletId = adminUserDoc.ref.id;

        const isAdmin = adminId === VERIFIED_ADMIN_UID ||
            adminData?.isAdmin === true ||
            userWalletId.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa" ||
            adminData?.walletAddress?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa" ||
            (request.auth?.token as any)?.walletAddress?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";

        if (!isAdmin) {
            logger.error("ACCESS_DENIED_FINAL", { uid: adminId, wallet: userWalletId });
            throw new HttpsError("permission-denied", "Only the system admin can create vesting schedules.");
        }

        const pools = configData?.pools || {};
        if ((pools[poolId] || 0) < totalAmount) {
            throw new HttpsError("failed-precondition", `Insufficient balance in ${poolId} pool.`);
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

export const sealEconomy_v2 = onCall({ memory: "256MiB" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Auth required.");
    const adminId = request.auth.uid;
    const adminUserDoc = await getUserDoc(db, adminId);
    if (!adminUserDoc) throw new HttpsError("permission-denied", "Admin profile not found.");
    const adminData: any = adminUserDoc.data;
    const userWalletId = adminUserDoc.ref.id;

    const VERIFIED_MASTER_UID = "ib2oJUss0NYEJjo7e9CKhod5pvh2";
    const isAdmin = adminId === VERIFIED_MASTER_UID || 
                    adminData?.isAdmin === true ||
                    userWalletId?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa" ||
                    adminData?.walletAddress?.toLowerCase() === "0xd42861f901dec20eb3f0c19ee238b9f5495f63fa";

    if (!isAdmin) throw new HttpsError("permission-denied", "Unauthorized admin.");

    const configRef = db.collection("config").doc("system");
    await db.runTransaction(async (transaction) => {
        const configSnap = await transaction.get(configRef);
        const data: any = configSnap.data();
        if (data?.isSealed) return;
        transaction.update(configRef, { isSealed: true, sealedAt: Date.now() });
    });
    return { success: true };
});

export const joinCreatorProgram = onCall({ memory: "256MiB" }, async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Authentication required.");
    const authUid = request.auth.uid;
    const userDocResult = await getUserDoc(db, authUid);
    if (!userDocResult) throw new HttpsError("not-found", "User profile not found.");
    const { ref: userRef, data: userData } = userDocResult as any;
    if (userData.isCreator) return { success: true, message: "Already in program." };

    return await db.runTransaction(async (transaction) => {
        const configRef = db.collection("config").doc("system");
        const configSnap = await transaction.get(configRef);
        const configData: any = configSnap.data();
        const currentCount = configData?.creatorProgramCount || 0;
        if (currentCount >= 100) throw new HttpsError("failed-precondition", "Program is full.");

        transaction.update(userRef, {
            isCreator: true,
            creatorInFirst100Program: true,
            creatorProgramIndex: currentCount + 1
        });
        transaction.update(configRef, { creatorProgramCount: admin.firestore.FieldValue.increment(1) });
        return { success: true };
    });
});
