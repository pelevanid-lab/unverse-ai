
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentPost } from '@/lib/types';
import { PostGrid } from '@/components/profile/PostGrid';
import { useRouter } from 'next/navigation';

const chunkArray = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
    arr.slice(i * size, i * size + size)
  );

export default function LimitedEditionsPage() {
  const { user, isConnected } = useWallet();
  const router = useRouter();
  const [limitedPosts, setLimitedPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLimitedPosts = async () => {
      if (!user || !user.unlockedPostIds || user.unlockedPostIds.length === 0) {
        setLimitedPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const postChunks = chunkArray(user.unlockedPostIds, 30);
        const finalPosts: ContentPost[] = [];

        for (const idChunk of postChunks) {
          if (idChunk.length === 0) continue;

          const postsQuery = query(
            collection(db, 'posts'), 
            where(documentId(), 'in', idChunk),
            where('contentType', '==', 'limited')
          );
          const postSnaps = await getDocs(postsQuery);
          const postsData = postSnaps.docs.map(snap => ({ id: snap.id, ...snap.data() }) as ContentPost);

          finalPosts.push(...postsData);
        }

        const sortedPosts = finalPosts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setLimitedPosts(sortedPosts);

      } catch (error) {
        console.error("Failed to fetch limited editions:", error);
        setLimitedPosts([]);
      } finally {
        setLoading(false);
      }
    };

    if (isConnected) {
        fetchLimitedPosts();
    }

  }, [user, isConnected]);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="p-6 bg-yellow-500/10 rounded-full"><Clock className="w-12 h-12 text-yellow-400" /></div>
        <h1 className="text-3xl font-headline font-bold">Limited Editions</h1>
        <p className="text-muted-foreground max-w-sm">Connect your wallet to view your owned limited content.</p>
        <Link href="/"><Button className="bg-primary hover:bg-primary/90 mt-4 rounded-xl px-8 py-6">Connect Now</Button></Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6">
        <div className="flex items-center justify-between pb-6 border-b border-white/10">
            <div className='flex items-center gap-4'>
                <Button variant="ghost" size="icon" onClick={() => router.push('/mypage')} className="h-10 w-10 rounded-full bg-white/5">
                    <ChevronLeft className="w-6 h-6" />
                </Button>
                <div>
                    <h1 className="text-3xl font-headline font-bold flex items-center gap-2">
                        <Clock className="w-8 h-8 text-yellow-400" /> Limited Editions
                    </h1>
                    <p className='text-sm text-muted-foreground'>Your restricted supply collection.</p>
                </div>
            </div>
        </div>

       {loading ? (
          <div className="flex items-center justify-center py-32"><Loader2 className="w-12 h-12 animate-spin text-primary" /></div>
        ) : limitedPosts.length > 0 ? (
             <PostGrid 
                postsToShow={limitedPosts}
                unlockedPostIds={user?.unlockedPostIds || []}
                onPostUnlocked={() => {}}
             />
        ) : (
            <div className="text-center py-32 glass-card rounded-[2rem] border-white/5">
                <p className="text-muted-foreground">You don't own any limited editions yet.</p>
                <Link href="/"><Button variant="link" className="text-primary mt-2">Explore available content</Button></Link>
            </div>
        )}
    </div>
  );
}
