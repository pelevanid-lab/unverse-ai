import { db } from '../firebase';
import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    serverTimestamp,
    query,
    where,
    orderBy,
    limit,
    getDocs
} from 'firebase/firestore';
import { SceneState } from '../types';

let adminDb: any;

export class SceneStateManager {
    private static COLLECTION = 'scene_states';

    private static getDb() {
        if (typeof window === 'undefined') {
            if (!adminDb) adminDb = require('../firebase-admin').adminDb;
            return adminDb;
        }
        return db;
    }

    /**
     * Creates a new SceneState in Firestore.
     */
    static async createSceneState(state: Omit<SceneState, 'createdAt' | 'updatedAt' | 'scene_id'>): Promise<string> {
        const database = this.getDb();
        
        if (typeof window === 'undefined') {
            // Admin SDK Implementation
            const docRef = database.collection(this.COLLECTION).doc();
            const newState: SceneState = {
                ...state,
                scene_id: docRef.id,
                createdAt: Date.now(),
                updatedAt: Date.now()
            } as SceneState;
            await docRef.set(newState);
            return docRef.id;
        }

        // Client SDK Implementation
        const docRef = doc(collection(database, this.COLLECTION));
        const newState: SceneState = {
            ...state,
            scene_id: docRef.id,
            createdAt: Date.now(),
            updatedAt: Date.now()
        } as SceneState;
        await setDoc(docRef, newState);
        return docRef.id;
    }

    /**
     * Gets a SceneState by ID.
     */
    static async getSceneState(sceneId: string): Promise<SceneState | null> {
        const database = this.getDb();

        if (typeof window === 'undefined') {
            const snap = await database.collection(this.COLLECTION).doc(sceneId).get();
            return snap.exists ? (snap.data() as SceneState) : null;
        }

        const docRef = doc(database, this.COLLECTION, sceneId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? (docSnap.data() as SceneState) : null;
    }

    /**
     * Updates an existing SceneState.
     */
    static async updateSceneState(sceneId: string, updates: Partial<SceneState>): Promise<void> {
        const database = this.getDb();

        if (typeof window === 'undefined') {
            await database.collection(this.COLLECTION).doc(sceneId).update({
                ...updates,
                updatedAt: Date.now()
            });
            return;
        }

        const docRef = doc(database, this.COLLECTION, sceneId);
        await updateDoc(docRef, {
            ...updates,
            updatedAt: Date.now()
        });
    }

    /**
     * Adds a media URL or log ID to the variation history.
     */
    static async addVariationToHistory(sceneId: string, entryId: string): Promise<void> {
        const state = await this.getSceneState(sceneId);
        if (!state) return;

        const history = [...(state.variation_history || []), entryId];
        await this.updateSceneState(sceneId, { variation_history: history });
    }

    /**
     * Finds the most recent SceneState for a character.
     */
    static async getLatestStateForCharacter(characterId: string): Promise<SceneState | null> {
        const q = query(
            collection(db, this.COLLECTION),
            where('character_id', '==', characterId),
            orderBy('updatedAt', 'desc'),
            limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            return snap.docs[0].data() as SceneState;
        }
        return null;
    }
}
