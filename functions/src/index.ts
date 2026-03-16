import { logger } from "firebase-functions";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";
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
            await doc.ref.update({ mediaUrl: optimizedUrl, status: "processed" });
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
            caption: mediaData.caption,
            isPremium: mediaData.isPremium,
            priceULC: mediaData.priceULC,
            createdAt: mediaData.scheduledFor,
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
