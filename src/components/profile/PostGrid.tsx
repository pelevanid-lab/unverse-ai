
"use client";

import { useState } from 'react';
import { ContentPost, UserProfile } from '@/lib/types';
import { Lock } from 'lucide-react';
import { PostViewerModal } from './PostViewerModal';
import { useWallet } from '@/hooks/use-wallet';

interface PostGridProps {
  postsToShow: ContentPost[];
  creator?: UserProfile;
  subscribedToCreatorIds?: string[];
  unlockedPostIds: string[];
  onPostUnlocked: (postId: string) => void;
}

export function PostGrid({ postsToShow, creator: initialCreator, subscribedToCreatorIds = [], unlockedPostIds = [], onPostUnlocked }: PostGridProps) {
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [postCreator, setPostCreator] = useState<UserProfile | null>(null);
  const { user } = useWallet();

  const handlePostClick = (post: ContentPost) => {
    const creatorForModal: UserProfile = {
        uid: post.creatorId,
        username: post.creatorName,
        avatar: post.creatorAvatar || '',
        walletAddress: '',
        followerCount: 0,
        followingCount: 0,
        totalTips: 0,
        referralCode: ''
    };
    
    setPostCreator(creatorForModal);
    setSelectedPost(post);
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
          const isSubscribedToThisCreator = subscribedToCreatorIds?.includes(post.creatorId);
          const isUnlocked = unlockedPostIds.includes(post.id);
          const canView = isOwner || !post.isPremium || isSubscribedToThisCreator || isUnlocked;
          const mediaUrl = post.media?.url || post.mediaUrl;
          const isImage = post.media?.type === 'image' || (mediaUrl && (mediaUrl.includes('.webp') || mediaUrl.includes('.png') || mediaUrl.includes('.jpg') || mediaUrl.includes('.jpeg') || mediaUrl.includes('image')));

          return (
            <div 
              key={post.id} 
              className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-muted/20"
              onClick={() => handlePostClick(post)}
            >
              {mediaUrl && (
                isImage ? (
                  <img src={mediaUrl} alt={post.caption || 'post'} className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!canView && 'blur-md'}`} />
                ) : (
                  <video src={mediaUrl} muted loop playsInline className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!canView && 'blur-md'}`} />
                )
              )}
             
              {!canView && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
              )}
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"/>
              <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
                  <p className='font-bold truncate text-sm'>{post.caption}</p>
                  {post.isPremium && (
                    <div className="flex items-center gap-3 text-xs font-semibold mt-1">
                        <div className="flex items-center gap-1">
                            <Lock size={14} />
                            <span>{post.unlockCount || 0}</span>
                        </div>
                    </div>
                  )}
              </div>
            </div>
          )
        })}
         {postsToShow.length === 0 && (
           <div className="col-span-full py-24 text-center glass-card rounded-3xl border-dashed border-2 border-white/5">
             <p className="text-muted-foreground">No content in this feed yet.</p>
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
