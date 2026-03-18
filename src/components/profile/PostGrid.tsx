
"use client";

import { useState } from 'react';
import { ContentPost, UserProfile } from '@/lib/types';
import { Lock, Clock } from 'lucide-react';
import { PostViewerModal } from './PostViewerModal';
import { useWallet } from '@/hooks/use-wallet';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
        {postsToShow.map(post => {
          const isOwner = user?.uid === post.creatorId;
          const isUnlocked = unlockedPostIds.includes(post.id);
          
          // Logic clarification: Subscription only unlocks the SECTION (tab).
          // Individual content access is ONLY granted if it's public, owned, or unlocked.
          const canViewContent = isOwner || post.contentType === 'public' || isUnlocked;
          
          const mediaUrl = post.mediaUrl;
          const isImage = mediaUrl && (mediaUrl.includes('.webp') || mediaUrl.includes('.png') || mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('image'));
          
          // Derived state for limited edition
          const isSoldOut = post.contentType === 'limited' && post.limited && post.limited.soldCount >= post.limited.totalSupply;

          return (
            <div 
              key={post.id} 
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-muted/20"
              onClick={() => handlePostClick(post)}
            >
              {mediaUrl && (
                isImage ? (
                  <img src={mediaUrl} alt="post" className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!canViewContent && 'blur-xl'}`} />
                ) : (
                  <video src={mediaUrl} muted loop playsInline className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!canViewContent && 'blur-xl'}`} />
                )
              )}
             
              {!canViewContent && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm group-hover:bg-black/20 transition-colors">
                  {post.contentType === 'limited' ? <Clock className="w-8 h-8 text-yellow-400" /> : <Lock className="w-8 h-8 text-primary" />}
                </div>
              )}
              
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"/>
              
              <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                  <p className='font-bold truncate text-xs'>{post.content}</p>
                  
                  <div className="flex items-center justify-between mt-1">
                    {post.contentType === 'premium' && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                            <Lock size={10} />
                            <span>{post.unlockPrice} ULC</span>
                        </div>
                    )}
                    {post.contentType === 'limited' && (
                        <div className="flex items-center gap-1 text-[10px] font-black text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded border border-yellow-400/20">
                            <Clock size={10} />
                            <span>{isSoldOut ? 'SOLD OUT' : `${post.limited?.price} ULC`}</span>
                        </div>
                    )}
                  </div>
              </div>
            </div>
          )
        })}
         {postsToShow.length === 0 && (
           <div className="col-span-full py-24 text-center glass-card rounded-3xl border-dashed border-2 border-white/5">
             <p className="text-muted-foreground">No content in this section yet.</p>
           </div>
         )}
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
