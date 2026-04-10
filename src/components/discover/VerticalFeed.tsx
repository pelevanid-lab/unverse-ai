"use client"

import { useState, useEffect } from 'react';
import { ContentPost, UserProfile, PromoCard } from '@/lib/types';
import { FeedPost } from './FeedPost';
import { PostViewerModal } from '../profile/PostViewerModal';
import { useWallet } from '@/hooks/use-wallet';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPostsMediaAction } from '@/lib/ledger';
import { StoryCarousel } from './StoryCarousel';

interface VerticalFeedProps {
  postsToShow: ContentPost[];
  subscribedToCreatorIds?: string[];
  unlockedPostIds: string[];
  onPostUnlocked: (postId: string) => void;
  promoCards?: PromoCard[];
}

export function VerticalFeed({ postsToShow, subscribedToCreatorIds = [], unlockedPostIds = [], onPostUnlocked, promoCards = [] }: VerticalFeedProps) {
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);
  const [postCreator, setPostCreator] = useState<UserProfile | null>(null);
  const { user } = useWallet();
  const [signedUrls, setSignedUrls] = useState<{ [postId: string]: string }>({});
  const [brokenPostIds, setBrokenPostIds] = useState<Set<string>>(new Set());

  const handleMediaError = (postId: string) => {
    setBrokenPostIds(prev => new Set([...prev, postId]));
  };

  useEffect(() => {
    async function preSignUrls() {
        if (postsToShow.length === 0) return;
        
        const postsToSign = postsToShow.filter(post => {
            if (signedUrls[post.id]) return false;

            // Public posts: only need signing if mediaUrl is not a valid http(s) URL
            if (post.contentType === 'public') {
                return !post.mediaUrl || !post.mediaUrl.startsWith('http');
            }

            // Premium/limited posts: need signing only if user has access
            const isOwner = user?.uid === post.creatorId;
            const isUnlocked = unlockedPostIds.includes(post.id);
            const isSubscribed = subscribedToCreatorIds.includes(post.creatorId || '');
            return isOwner || isUnlocked || isSubscribed;
        }).map(p => p.id);

        if (postsToSign.length === 0) return;

        try {
            const urls = await getPostsMediaAction(postsToSign);
            setSignedUrls(prev => ({ ...prev, ...urls }));
        } catch (error) {
            console.error("Pre-signing failed:", error);
        }
    }

    preSignUrls();
  }, [postsToShow, user, unlockedPostIds, subscribedToCreatorIds]);

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
    <div className="flex flex-col w-full max-w-2xl mx-auto space-y-6">
      {/* Story Carousel at the top */}
      {promoCards && promoCards.length > 0 && (
        <div className="w-full bg-card/10 md:rounded-2xl overflow-hidden mb-6">
            <StoryCarousel promoCards={promoCards} />
        </div>
      )}

      {/* Vertical Feed List */}
      <div className="flex flex-col pb-20 md:pb-10">
        {postsToShow
          .filter(post => !brokenPostIds.has(post.id))
          .map((post) => {
          const isOwner = user?.uid === post.creatorId;
          const isUnlocked = unlockedPostIds.includes(post.id);
          const isSubscribed = subscribedToCreatorIds.includes(post.creatorId || '');
          const canViewContent = isOwner || post.contentType === 'public' || isUnlocked || isSubscribed;

          return (
            <FeedPost 
              key={post.id}
              post={post}
              creator={{
                  uid: post.creatorId,
                  username: post.creatorName || '',
                  avatar: post.creatorAvatar || '',
                  walletAddress: '',
                  isCreator: true,
                  createdAt: 0
              } as UserProfile}
              canViewContent={canViewContent}
              isUnlocked={isUnlocked}
              onPostClick={handlePostClick}
              signedUrl={signedUrls[post.id]}
              onMediaError={() => handleMediaError(post.id)}
            />
          );
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
          initialSecureUrl={signedUrls[selectedPost.id]}
        />
      )}
    </div>
  );
}
