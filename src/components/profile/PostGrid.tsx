
"use client";

import { useState } from 'react';
import { ContentPost, UserProfile } from '@/lib/types';
import { Lock, Clock, Sparkles } from 'lucide-react';
import { PostViewerModal } from './PostViewerModal';
import { useWallet } from '@/hooks/use-wallet';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';

interface PostGridProps {
  postsToShow: ContentPost[];
  subscribedToCreatorIds?: string[];
  unlockedPostIds: string[];
  onPostUnlocked: (postId: string) => void;
}

export function PostGrid({ postsToShow, subscribedToCreatorIds = [], unlockedPostIds = [], onPostUnlocked }: PostGridProps) {
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [postCreator, setPostCreator] = useState<UserProfile | null>(null);
  const { user } = useWallet();

  const handlePostClick = async (post: ContentPost) => {
    if (!post.creatorId) return;
    const creatorRef = doc(db, "users", post.creatorId);
    const creatorSnap = await getDoc(creatorRef);
    if (creatorSnap.exists()) {
      setPostCreator(creatorSnap.data() as UserProfile);
      setSelectedPost(post);
    } else {
      const creatorForModal: UserProfile = {
          uid: post.creatorId,
          username: post.creatorName || 'Creator',
          avatar: post.creatorAvatar || '',
          walletAddress: '',
          isCreator: true,
          createdAt: 0,
      };
      setPostCreator(creatorForModal);
      setSelectedPost(post);
    }
  }

  const handleCloseModal = () => {
    setSelectedPost(null);
    setPostCreator(null);
  }

  // Filter out legacy posts that don't have contentType
  const validPosts = postsToShow.filter(post => !!post.contentType);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
        {validPosts.map(post => {
          const isOwner = user?.uid === post.creatorId;
          const isUnlocked = unlockedPostIds.includes(post.id);
          const canViewContent = isOwner || post.contentType === 'public' || isUnlocked;
          const isSoldOut = post.contentType === 'limited' && post.limited && post.limited.soldCount >= post.limited.totalSupply;

          return (
            <div 
              key={post.id} 
              className="group relative aspect-square rounded-3xl overflow-hidden cursor-pointer bg-muted/20 border border-white/5 hover:border-primary/30 transition-all duration-500"
              onClick={() => handlePostClick(post)}
            >
                {/* Media Layer */}
                <div className="absolute inset-0">
                    {post.mediaUrl && (
                        post.mediaType === 'image' || !post.mediaType ? (
                            <img src={post.mediaUrl} alt="post" className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${!canViewContent ? 'blur-2xl scale-125 opacity-50' : 'opacity-100'}`} />
                        ) : (
                            <video src={post.mediaUrl} muted loop playsInline className={`w-full h-full object-cover transition-all duration-700 group-hover:scale-110 ${!canViewContent ? 'blur-2xl scale-125 opacity-50' : 'opacity-100'}`} />
                        )
                    )}
                </div>

                {/* Gated Overlay */}
                {!canViewContent && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all group-hover:bg-black/20">
                        <div className="p-4 rounded-full bg-black/50 border border-white/10 shadow-2xl scale-100 group-hover:scale-110 transition-transform">
                            {post.contentType === 'limited' ? <Clock className="w-8 h-8 text-yellow-400" /> : <Lock className="w-8 h-8 text-primary" />}
                        </div>
                    </div>
                )}

                {/* Badges Layer */}
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
                    {post.contentType === 'limited' && (
                        <Badge className="bg-yellow-400 text-black border-none font-black text-[10px] tracking-tighter px-2 py-0.5 rounded-lg shadow-xl">
                            LIMITED {isSoldOut && '• SOLD OUT'}
                        </Badge>
                    )}
                    {post.contentType === 'premium' && (
                        <Badge className="bg-primary text-white border-none font-black text-[10px] tracking-tighter px-2 py-0.5 rounded-lg shadow-xl">
                            PREMIUM
                        </Badge>
                    )}
                </div>

                {/* Info Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />
                
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white transform translate-y-2 group-hover:translate-y-0 transition-transform">
                    <p className="font-bold text-sm truncate mb-1">{post.content || post.title}</p>
                    
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{post.creatorName}</span>
                        </div>
                        
                        {!canViewContent && (
                            <div className="flex items-center gap-1 text-xs font-black text-primary bg-primary/20 px-2 py-1 rounded-lg border border-primary/30 backdrop-blur-md">
                                <Sparkles size={12} className="fill-current" />
                                <span>{post.contentType === 'limited' ? post.limited?.price : post.unlockPrice} ULC</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          )
        })}
      </div>

      {selectedPost && postCreator && (
        <PostViewerModal
          post={selectedPost}
          creator={postCreator}
          isSubscribed={subscribedToCreatorIds.includes(selectedPost.creatorId)}
          unlockedPostIds={unlockedPostIds}
          onClose={handleCloseModal}
          onPostUnlocked={onPostUnlocked}
        />
      )}
    </>
  );
}
