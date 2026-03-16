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
exports.publishScheduledPosts = exports.optimizeMedia = void 0;
const firebase_functions_1 = require("firebase-functions");
const storage_1 = require("firebase-functions/v2/storage");
const scheduler_1 = require("firebase-functions/v2/scheduler");
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
                await doc.ref.update({ mediaUrl: optimizedUrl, status: "processed" });
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
    firebase_functions_1.logger.info("Successfully published all scheduled posts for this hour.");
});
//# sourceMappingURL=index.js.map