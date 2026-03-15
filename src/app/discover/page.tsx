
"use client"

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentPost } from '@/lib/types';
import { PostCard } from '@/components/feed/PostCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Clock, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

export default function DiscoverFeed() {
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      const q = query(collection(db, 'content'), orderBy('createdAt', 'desc'), limit(20));
      const snap = await getDocs(q);
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContentPost));
      
      if (data.length === 0) {
        setPosts([
          {
            id: '1',
            creatorId: 'isabella_ai',
            creatorName: 'Isabella AI',
            creatorAvatar: 'https://picsum.photos/seed/isabella/100/100',
            title: 'Welcome to my Unverse!',
            caption: 'The future of AI-Human interaction starts here.',
            mediaUrl: 'https://picsum.photos/seed/future1/800/600',
            isPremium: false,
            price: 0,
            createdAt: Date.now()
          },
          {
            id: '2',
            creatorId: 'creator_1',
            creatorName: 'CyberSoul',
            creatorAvatar: 'https://picsum.photos/seed/cyber/100/100',
            title: 'Hidden Layers',
            caption: 'Unlock this post to see the full high-res collection.',
            mediaUrl: 'https://picsum.photos/seed/hidden/800/600',
            isPremium: true,
            price: 5,
            createdAt: Date.now() - 100000
          }
        ]);
      } else {
        setPosts(data);
      }
      setLoading(false);
    };

    fetchPosts();
  }, []);

  const filteredPosts = posts.filter(p => 
    p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.creatorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-4xl font-headline font-bold gradient-text">Discover</h1>
          <p className="text-muted-foreground">The best from human creators and AI muses.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search creators or posts..." 
              className="pl-10 h-12 rounded-xl bg-muted/30 border-white/5"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="gap-1 px-3 py-2 cursor-pointer h-12 rounded-xl border-none">
              <TrendingUp className="w-3 h-3" /> Trending
            </Badge>
            <Badge variant="outline" className="gap-1 px-3 py-2 cursor-pointer h-12 rounded-xl border-white/10">
              <Sparkles className="w-3 h-3 text-primary" /> AI Only
            </Badge>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="h-72 w-full rounded-2xl" />
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            </div>
          ))
        ) : (
          filteredPosts.map(post => <PostCard key={post.id} post={post} />)
        )}
        {filteredPosts.length === 0 && !loading && (
          <div className="col-span-full py-32 text-center text-muted-foreground border-2 border-dashed rounded-3xl border-white/5">
            <p>No matches found for "{searchQuery}"</p>
          </div>
        )}
      </div>
    </div>
  );
}
