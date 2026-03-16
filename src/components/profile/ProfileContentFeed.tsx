
"use client";

import { useState } from 'react';
import { ContentPost, UserProfile } from '@/lib/types';
import { PostGrid } from './PostGrid';
import { Button } from '@/components/ui/button';

interface ProfileContentFeedProps {
  posts: ContentPost[];
  creator: UserProfile;
  isSubscribed: boolean;
  unlockedPostIds: string[];
  onPostUnlocked: (postId: string) => void;
}

export function ProfileContentFeed({ posts, creator, isSubscribed, unlockedPostIds, onPostUnlocked }: ProfileContentFeedProps) {
  const [showPremium, setShowPremium] = useState(false);

  const publicPosts = posts.filter(p => !p.isPremium);
  const premiumPosts = posts.filter(p => p.isPremium);

  const postsToShow = showPremium ? premiumPosts : publicPosts;

  return (
    <div>
      <div className="flex justify-center mb-4 bg-muted p-1 rounded-xl w-fit mx-auto">
        <Button 
          variant={!showPremium ? 'default' : 'ghost'} 
          onClick={() => setShowPremium(false)}
          className="rounded-lg px-6"
        >
          Public Feed
        </Button>
        <Button 
          variant={showPremium ? 'default' : 'ghost'} 
          onClick={() => setShowPremium(true)}
          className="rounded-lg px-6"
        >
          Premium Feed
        </Button>
      </div>
      <PostGrid 
        postsToShow={postsToShow} 
        creator={creator} 
        isSubscribed={isSubscribed}
        unlockedPostIds={unlockedPostIds}
        onPostUnlocked={onPostUnlocked}
      />
    </div>
  );
}
