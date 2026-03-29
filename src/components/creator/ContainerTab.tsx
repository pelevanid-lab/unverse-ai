
"use client";

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, and, getDocs } from 'firebase/firestore';
import { CreatorMedia, UserProfile, ContentPost, LedgerEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Video, Calendar, MessageSquare, Upload, Wand2, Sparkles, ChevronLeft, ChevronRight, TrendingUp, Zap, Lock, Clock, Megaphone } from 'lucide-react';
import { EditMediaModal } from './EditMediaModal';
import { ViewPostModal } from './ViewPostModal';
import { useTranslations } from 'next-intl';
import { VideoPreview } from '../ui/VideoPreview';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export function ContainerTab() {
  const t = useTranslations('Container');
  const tPub = useTranslations('Published');
  const { user } = useWallet();
  const { toast } = useToast();
  
  // Media Pool State
  const [mediaItems, setMediaItems] = useState<CreatorMedia[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<CreatorMedia | null>(null);
  const [brokenItems, setBrokenItems] = useState<Set<string>>(new Set());

  // Published Content State
  const [posts, setPosts] = useState<ContentPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);

  const handleItemError = (id: string) => {
    setBrokenItems(prev => new Set(prev).add(id));
  };

  // 1. Fetch User Profile
  useEffect(() => {
    if (!user?.uid) return;

    const profileDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(profileDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        console.error("User profile not found in 'users' collection!");
        // toast({ variant: "destructive", title: t('errorTitle'), description: t('profileLoadError') });
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 2. Fetch Media Pool (Drafts/Scheduled)
  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    const q = query(
      collection(db, 'creator_media'),
      and(
        where('creatorId', '==', user.uid),
        where('status', 'in', ['draft', 'scheduled', 'planned'])
      ),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia));
      setMediaItems(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // 3. Fetch Published Posts & Stats
  useEffect(() => {
    if (!user?.uid) return;

    setPostsLoading(true);
    const q = query(collection(db, 'posts'), where('creatorId', '==', user.uid));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedPosts = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as ContentPost))
        .filter(p => !!p.contentType);
      
      const premiumAndLimitedPostIds = fetchedPosts
        .filter(p => p.contentType === 'premium' || p.contentType === 'limited')
        .map(p => p.id);

      let postsWithStats = fetchedPosts;

      if (premiumAndLimitedPostIds.length > 0) {
        // Stats for premium unlocks
        const ledgerQuery = query(
          collection(db, 'ledger'),
          where('type', '==', 'premium_unlock'),
          where('creatorId', '==', user.uid),
          where('referenceId', 'in', premiumAndLimitedPostIds)
        );
        
        const ledgerSnapshot = await getDocs(ledgerQuery);
        const unlocks = ledgerSnapshot.docs.map(doc => doc.data() as LedgerEntry);

        postsWithStats = fetchedPosts.map(post => {
          if (post.contentType === 'premium' || post.contentType === 'limited') {
            const postUnlocks = unlocks.filter(u => u.referenceId === post.id);
            return {
              ...post,
              unlockCount: postUnlocks.length,
              revenue: postUnlocks.reduce((sum, u) => sum + u.amount, 0),
            };
          }
          return post;
        });
      }
      
      const sortedPosts = postsWithStats.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPosts(sortedPosts);
      setPostsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Growth Stats Calculation (Mocked for engagement/motivation)
  const totalRevenue = (posts as any[]).reduce((sum, p) => sum + (p.revenue || 0), 0);
  const totalUnlocks = (posts as any[]).reduce((sum, p) => sum + (p.unlockCount || 0), 0);
  const growthVelocity = totalUnlocks > 0 ? Math.min(99, (totalUnlocks * 12.5)) : 0;

  // Refs for Horizontal Scrolling
  const mediaScrollRef = useRef<HTMLDivElement>(null);
  const publishedScrollRef = useRef<HTMLDivElement>(null);

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      const scrollAmount = 600;
      ref.current.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">


      <Card className="glass-card border-white/10">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7 border-b border-white/5 mb-6">
          {/* Left: Your Media Title */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-blue-400" />
            </div>
            <div className="hidden sm:block">
                <h3 className="text-sm font-bold uppercase tracking-wider">{t('yourMedia') || "Sizin İçerikleriniz"}</h3>
                <p className="text-[9px] text-muted-foreground uppercase font-medium leading-none">Ready to be published</p>
            </div>
          </div>

          {/* Center: Shortcuts */}
          <div className="flex items-center gap-2">
              {[
                  { id: 'messages', icon: MessageSquare, color: 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 border-fuchsia-500/20', href: '/creator/messages' },
                  { id: 'edit', icon: Upload, color: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20', href: '/creator/upload' },
                  { id: 'muse', icon: Wand2, color: 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 border-pink-500/20', href: '/creator/muse' },
                  { id: 'animate', icon: Video, color: 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 border-yellow-500/20', href: '/creator/animate' },
                  { id: 'freeArt', icon: Sparkles, color: 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20', href: '/creator/free-art' }
              ].map((shortcut) => (
                  <Link key={shortcut.id} href={shortcut.href}>
                      <div className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-2xl border transition-all cursor-pointer group",
                          shortcut.color
                      )}>
                          <shortcut.icon size={16} className="group-hover:scale-110 transition-transform" />
                          <span className="text-[10px] font-bold uppercase tracking-wider hidden md:inline-block">
                              {t(`shortcuts.${shortcut.id}`)}
                          </span>
                      </div>
                  </Link>
              ))}
          </div>

          {/* Right: Navigation Arrows */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => scroll(mediaScrollRef, 'left')} className="p-2 rounded-full glass-card border-white/10 hover:bg-white/10 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => scroll(mediaScrollRef, 'right')} className="p-2 rounded-full glass-card border-white/10 hover:bg-white/10 transition-colors">
              <ChevronRight size={16} />
            </button>
          </div>
        </CardHeader>
        <CardContent className="space-y-12">
          {loading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-12">
              {/* Common Drafts Grid (AI + User) */}
              <div className="space-y-4">
                <div 
                  ref={mediaScrollRef}
                  className="grid grid-rows-4 grid-flow-col auto-cols-[calc(50%-1rem)] md:auto-cols-[calc(33.33%-1rem)] lg:auto-cols-[calc(25%-1rem)] gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4"
                  style={{ maxHeight: '800px' }}
                >
                  {mediaItems.filter(i => !brokenItems.has(i.id)).map(item => (
                    <div key={item.id} className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group bg-black/50 snap-start">
                      {item.mediaType === 'image' ? (
                        <img src={item.mediaUrl} alt={item.caption || 'media'} className="w-full h-full object-cover" onClick={() => setSelectedMedia(item)} onError={() => handleItemError(item.id)} />
                      ) : (
                        <div onClick={() => setSelectedMedia(item)} className="h-full">
                          <VideoPreview src={item.mediaUrl} onError={() => handleItemError(item.id)} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors pointer-events-none" />
                      {item.source === 'ai_auto' && (
                        <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[8px] font-bold rounded-full z-10">AI DRAFT</div>
                      )}
                      {item.mediaType === 'video' && (
                        <Video className={cn("absolute top-2 h-5 w-5 text-white pointer-events-none", item.source === 'ai_auto' ? 'left-14' : 'left-2')} />
                      )}
                      {item.status === 'scheduled' && (
                        <Calendar className="absolute top-2 right-2 h-5 w-5 text-white bg-primary/80 p-1 rounded-full pointer-events-none" />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2 text-white pointer-events-none">
                        <p className='text-xs font-bold truncate'>{item.caption || (item.source === 'ai_auto' ? 'Yeni Taslak' : t('untitled'))}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Growth Stats Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-primary/5 border border-primary/20 p-6 rounded-[2rem] flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-125 transition-transform">
                    <TrendingUp className="w-24 h-24 text-primary" />
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0 border border-primary/20">
                    <TrendingUp className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary uppercase tracking-[0.2em] mb-1">Growth Potential</p>
                    <h3 className="text-2xl font-bold font-headline">+{growthVelocity.toFixed(1)}% Velocity</h3>
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">Protocol expansion active. Style diversity is increasing engagement.</p>
                  </div>
                </div>
                
                <div className="bg-amber-500/5 border border-amber-500/20 p-6 rounded-[2rem] flex items-center gap-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:rotate-12 transition-transform">
                    <Zap className="w-24 h-24 text-amber-500" />
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/20 flex items-center justify-center shrink-0 border border-amber-500/20">
                    <Zap className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em] mb-1">Monetization Score</p>
                    <h3 className="text-2xl font-bold font-headline">{totalRevenue.toFixed(2)} USDC Earned</h3>
                    <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">Optimal yield reached. Your content is generating consistent protocol value.</p>
                  </div>
                </div>
              </div>

              {/* Published Content Section */}
              {!postsLoading && posts.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Zap className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider">{tPub('title')}</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">{posts.length} Live Items</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => scroll(publishedScrollRef, 'left')} className="p-2 rounded-full glass-card border-white/10 hover:bg-white/10 transition-colors">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={() => scroll(publishedScrollRef, 'right')} className="p-2 rounded-full glass-card border-white/10 hover:bg-white/10 transition-colors">
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                  <div 
                    ref={publishedScrollRef}
                    className="grid grid-rows-4 grid-flow-col auto-cols-[calc(50%-1rem)] md:auto-cols-[calc(33.33%-1rem)] lg:auto-cols-[calc(25%-1rem)] gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-4"
                    style={{ maxHeight: '800px' }}
                  >
                    {posts.map(post => {
                      const isImage = post.mediaUrl?.includes('.webp') || post.mediaUrl?.includes('.png') || post.mediaUrl?.includes('.jpg') || post.mediaUrl?.includes('.jpeg') || post.mediaUrl?.includes('image');
                      return (
                        <div key={post.id} className="relative aspect-square rounded-2xl overflow-hidden cursor-pointer group bg-black/50 snap-start" onClick={() => setSelectedPost(post)}>
                          {isImage ? (
                            <img src={post.mediaUrl || ''} alt={post.content || 'post'} className="w-full h-full object-cover" />
                          ) : (
                            <VideoPreview src={post.mediaUrl || ''} />
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                          <div className="absolute top-2 right-2 flex items-center gap-1">
                             {post.contentType === 'premium' && <Badge className="bg-primary/20 text-primary border-primary/30 text-[8px] font-black px-1.5 py-0">PRM</Badge>}
                             {post.contentType === 'limited' && <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-[8px] font-black px-1.5 py-0">LTD</Badge>}
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                              <div className="flex items-center gap-2">
                                  {post.contentType === 'premium' && <Lock size={12} className="text-primary" />}
                                  {post.contentType === 'limited' && <Clock size={12} className="text-yellow-400" />}
                                  {(post.contentType !== 'public') && (
                                      <span className="text-[9px] font-bold tracking-tight uppercase">{post.unlockCount || 0} {tPub('unlocks')}</span>
                                  )}
                              </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedMedia && userProfile && (
        <EditMediaModal
          media={selectedMedia}
          creatorProfile={userProfile}
          onClose={() => setSelectedMedia(null)}
          onPublished={() => {
            const idToRemove = selectedMedia.id;
            if (idToRemove) {
              setMediaItems(prev => prev.filter(item => item.id !== idToRemove));
            }
            setSelectedMedia(null);
          }}
        />
      )}

      {selectedPost && (
        <ViewPostModal 
          post={selectedPost} 
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}
