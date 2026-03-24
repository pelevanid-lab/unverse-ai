import { db } from './firebase';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    query, 
    where, 
    orderBy, 
    getDocs, 
    serverTimestamp,
    increment,
    limit,
    getDoc,
    Timestamp 
} from 'firebase/firestore';

export interface ForumTopic {
    id?: string;
    title: string;
    content: string;
    authorId: string;
    authorName: string;
    categoryId: string;
    createdAt: any;
    replyCount: number;
    lastReplyAt: any;
    status: 'active' | 'locked' | 'hidden';
}

export interface ForumReply {
    id?: string;
    topicId: string;
    content: string;
    authorId: string;
    authorName: string;
    createdAt: any;
}

export async function createTopicAction(topic: Omit<ForumTopic, 'id' | 'createdAt' | 'replyCount' | 'lastReplyAt' | 'status'>) {
    const topicData: Omit<ForumTopic, 'id'> = {
        ...topic,
        createdAt: serverTimestamp(),
        replyCount: 0,
        lastReplyAt: serverTimestamp(),
        status: 'active'
    };
    
    const docRef = await addDoc(collection(db, 'forum_topics'), topicData);
    return docRef.id;
}

export async function postReplyAction(reply: Omit<ForumReply, 'id' | 'createdAt'>) {
    const replyData: Omit<ForumReply, 'id'> = {
        ...reply,
        createdAt: serverTimestamp()
    };
    
    const docRef = await addDoc(collection(db, 'forum_replies'), replyData);
    
    // Update topic stats
    const topicRef = doc(db, 'forum_topics', reply.topicId);
    await updateDoc(topicRef, {
        replyCount: increment(1),
        lastReplyAt: serverTimestamp()
    });
    
    return docRef.id;
}

export async function getTopicsByCategory(categoryId: string, limitCount = 20) {
    const q = query(
        collection(db, 'forum_topics'),
        where('categoryId', '==', categoryId),
        where('status', '==', 'active'),
        orderBy('lastReplyAt', 'desc'),
        limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumTopic));
}

export async function getRepliesByTopic(topicId: string) {
    const q = query(
        collection(db, 'forum_replies'),
        where('topicId', '==', topicId),
        orderBy('createdAt', 'asc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ForumReply));
}

export async function getTopicById(topicId: string) {
    const docSnap = await getDoc(doc(db, 'forum_topics', topicId));
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ForumTopic;
    }
    return null;
}
