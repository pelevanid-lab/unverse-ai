
"use client"

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ContentPost, UserProfile, CreatorProfile } from '@/lib/types';
import { useWallet } from '@/hooks/use-wallet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, Search, Heart, Coins, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { PostViewerModal } from '@/components/profile/PostViewerModal';

export default function DiscoverFeed() {
  const { user: loggedInUser } = useWallet();
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);

  useEffect(() => {
    if (loggedInUser?.uid) {
      // This is a placeholder. In a real app, you'd fetch the user's subscriptions.
      // For now, we'll assume the user object might have a subscriptions array.
      // If not, this will default to empty.
      const userSubscriptions = (loggedInUser as any).subscriptions || [];
      setSubscriptions(userSubscriptions);
    }
  }, [loggedInUser]);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      try {
        const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
        const postsSnap = await getDocs(postsQuery);

        const postsData = await Promise.all(postsSnap.docs.map(async (postDoc) => {
          const post = { id: postDoc.id, ...postDoc.data() } as ContentPost;
          
          // Fetch creator data using the creatorId from the post
          if (post.creatorId) {
             const creatorRef = doc(db, 'creators', post.creatorId);
             const creatorSnap = await getDoc(creatorRef);
             if (creatorSnap.exists()) {
                // Attach the fetched creator data to the post object
                post.creator = creatorSnap.data() as CreatorProfile;
             } else {
                post.creator = { displayName: 'Unknown', avatar: '/img/default-avatar.png' } as CreatorProfile;
             }
          } else {
             post.creator = { displayName: 'Unknown', avatar: '/img/default-avatar.png' } as CreatorProfile;
          }
          return post;
        }));
        
        setPosts(postsData);
      } catch (e) {
        console.error("Failed to fetch posts:", e);
      }
      setLoading(false);
    };

    fetchPosts();
  }, []);

  const filteredPosts = posts.filter(p => 
      (p.caption || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (p.creator?.displayName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {loading ? (
            Array(8).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-96 w-full rounded-2xl bg-muted/20" />
            ))
          ) : (
            filteredPosts.map(post => {
              const isImage = post.mediaType === 'image';
              const isOwner = loggedInUser?.uid === post.creatorId;
              const isSubscribed = subscriptions.includes(post.creatorId);
              const canView = !post.isPremium || isOwner || isSubscribed;

              return (
                   <div 
                      key={post.id} 
                      className="relative aspect-[3/4] rounded-lg overflow-hidden group bg-black/50"
                      onClick={() => canView ? setSelectedPost(post) : toast({ variant: 'default', title: 'Premium Content', description: 'Subscribe to this creator to view their exclusive posts.' })}
                  >
                      {post.isPremium && !canView && (
                          <div className="absolute top-2 right-2 z-10">
                              <Badge variant='premium'><Lock className='w-3 h-3 mr-1'/> Premium</Badge>
                          </div>
                      )}
                      {isImage ? (
                              <img src={post.mediaUrl} alt={post.caption || 'post'} className={`w-full h-full object-cover transition-all group-hover:scale-105 ${!canView && 'blur-lg'}`} />
                      ):(
                          <video src={post.mediaUrl} muted loop playsInline className={`w-full h-full object-cover transition-all group-hover:scale-105 ${!canView && 'blur-lg'}`} />
                      )}
                      
                      {!canView && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 cursor-pointer">
                            <Lock className="w-10 h-10 text-primary" />
                        </div>
                      )}

                      <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent ${canView ? 'opacity-100' : 'opacity-0'}`} />
                      
                      <div className={`absolute bottom-0 left-0 right-0 p-4 text-white ${canView ? 'opacity-100' : 'opacity-0'}`}>
                          <Link href={`/profile/${post.creatorId}`} className="flex items-center gap-2 mb-2 group/creator" onClick={(e) => e.stopPropagation()}>
                              <img src={post.creator?.avatar || '/img/default-avatar.png'} className="w-8 h-8 rounded-full object-cover border-2 border-transparent group-hover/creator:border-primary"/>
                              <p className="text-sm font-bold truncate group-hover/creator:text-primary transition-colors">{post.creator?.displayName || 'Unknown'}</p>
                          </Link>
                          <p className="text-xs text-muted-foreground truncate">{post.caption}</p>
                          <div className="flex items-center gap-4 text-xs mt-2 font-bold">
                              <div className="flex items-center gap-1">
                                  <Heart size={14} /> <span>{post.likes || 0}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                  <Coins size={14} /> <span>{post.earningsULC || 0}</span>
                              </div>
                          </div>
                      </div>
                  </div>
              )
          })
          )}
          {filteredPosts.length === 0 && !loading && (
            <div className="col-span-full py-32 text-center text-muted-foreground border-2 border-dashed rounded-3xl border-white/5">
              <p>No matches found or no content available yet.</p>
            </div>
          )}
        </div>
      </div>

      {selectedPost && selectedPost.creator && (
          <PostViewerModal
              post={selectedPost}
              creator={selectedPost.creator}
              isSubscribed={subscriptions.includes(selectedPost.creatorId) || loggedInUser?.uid === selectedPost.creatorId}
              onClose={() => setSelectedPost(null)}
          />
      )}
    </>
  );
}
