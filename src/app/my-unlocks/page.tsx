
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentPost } from '@/lib/types';
import { PostGrid } from '@/components/profile/PostGrid';

// Helper function to split an array into chunks for Firestore's `in` query limitation (max 30 per query).
const chunkArray = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

export default function MyUnlocksPage() {
  const { user, isConnected } = useWallet();
  const [unlockedPosts, setUnlockedPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  // This state is for the PostGrid, which is now used to display the posts consistently.
  const [locallyUnlockedPostIds, setLocallyUnlockedPostIds] = useState<string[]>([]);
  const handlePostUnlocked = (postId: string) => {
    setLocallyUnlockedPostIds(prev => [...new Set([...prev, postId])]);
  };

  useEffect(() => {
    const fetchUnlockedPosts = async () => {
      if (!user || !user.unlockedPostIds || user.unlockedPostIds.length === 0) {
        setUnlockedPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Chunk the unlockedPostIds to handle Firestore's query limits.
        const postChunks = chunkArray(user.unlockedPostIds, 30);
        const finalPosts: ContentPost[] = [];

        for (const idChunk of postChunks) {
          if (idChunk.length === 0) continue;

          // **FIXED**: The query now correctly targets the `posts` collection.
          const postsQuery = query(collection(db, 'posts'), where(documentId(), 'in', idChunk));
          const postSnaps = await getDocs(postsQuery);
          const postsData = postSnaps.docs
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.id, ...snap.data() }) as ContentPost);

          finalPosts.push(...postsData);
        }

        // Sort posts by creation date, newest first.
        const sortedPosts = finalPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setUnlockedPosts(sortedPosts);

      } catch (error) {
        console.error("Failed to fetch unlocked posts:", error);
        setUnlockedPosts([]);
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
        fetchUnlockedPosts();
    }

  }, [user, isConnected]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="p-6 bg-primary/10 rounded-full"><Sparkles className="w-12 h-12 text-primary" /></div>
        <h1 className="text-3xl font-headline font-bold">Access Your Content</h1>
        <p className="text-muted-foreground max-w-sm">Connect your wallet to view your premium unlocks.</p>
        <Link href="/"><Button className="bg-primary hover:bg-primary/90 mt-4 rounded-xl px-8 py-6">Connect Now</Button></Link>
      </div>
    );
  }
  
  const allUnlockedIds = [...new Set([...(user?.unlockedPostIds || []), ...locallyUnlockedPostIds])];

  return (
    <div className="space-y-8 pb-12">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                <Sparkles className="w-8 h-8 text-primary" /> Premium Unlocks
            </h1>
            <Link href="/mypage">
                <Button variant="outline">Back to Dashboard</Button>
            </Link>
        </div>

       {loading ? (
          <div className="flex items-center justify-center min-h-[400px]"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>
        ) : unlockedPosts.length > 0 ? (
             <PostGrid 
                postsToShow={unlockedPosts}
                unlockedPostIds={allUnlockedIds}
                subscribedToCreatorIds={user?.activeSubscriptionIds || []}
                onPostUnlocked={handlePostUnlocked}
             />
        ) : (
            <Card className="glass-card border-white/5 bg-white/[0.02]">
                <CardContent className="p-12 text-center space-y-4">
                    <p className="text-muted-foreground text-sm">You haven't unlocked any premium content yet.</p>
                    <Link href="/discover"><Button variant="outline" className="rounded-xl px-8 border-white/10">Explore Creators</Button></Link>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
