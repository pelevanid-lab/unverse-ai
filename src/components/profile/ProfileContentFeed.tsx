
"use client";

import { useState } from 'react';
import { ContentPost, UserProfile } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Lock, Heart, Coins } from 'lucide-react';
import { PostViewerModal } from './PostViewerModal';

interface ProfileContentFeedProps {
  posts: ContentPost[];
  creator: UserProfile;
  isSubscribed: boolean;
}

export function ProfileContentFeed({ posts, creator, isSubscribed }: ProfileContentFeedProps) {
  const [selectedPost, setSelectedPost] = useState<ContentPost | null>(null);

  const publicPosts = posts.filter(p => !p.isPremium);
  const premiumPosts = posts.filter(p => p.isPremium);

  const PostGrid = ({ postsToShow }: { postsToShow: ContentPost[] }) => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-4">
      {postsToShow.map(post => {
        const canView = !post.isPremium || isSubscribed;
        const isImage = post.mediaUrl.includes('.webp') || post.mediaUrl.includes('.png') || post.mediaUrl.includes('.jpg') || post.mediaUrl.includes('.jpeg') || post.mediaUrl.includes('image');

        return (
          <div 
            key={post.id} 
            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50"
            onClick={() => setSelectedPost(post)}
          >
            {isImage ? (
               <img src={post.mediaUrl} alt={post.caption || 'post'} className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!canView && 'blur-sm'}`} />
            ) : (
                <video src={post.mediaUrl} muted loop playsInline className={`w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 ${!canView && 'blur-sm'}`} />
            )}
           
            {!canView && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            )}
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80 group-hover:opacity-100 transition-opacity"/>
            <div className="absolute bottom-0 left-0 right-0 p-2 text-white text-xs">
                <p className='font-bold truncate text-sm'>{post.caption}</p>
                <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1"><Heart size={12} /><span>{post.likes}</span></div>
                    <div className="flex items-center gap-1"><Coins size={12} /><span>{post.earningsULC.toFixed(0)}</span></div>
                </div>
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
  );

  return (
    <>
      <Tabs defaultValue="public" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="public">Public Feed</TabsTrigger>
          <TabsTrigger value="premium">Premium Feed</TabsTrigger>
        </TabsList>
        <TabsContent value="public" className="mt-4">
          <PostGrid postsToShow={publicPosts} />
        </TabsContent>
        <TabsContent value="premium" className="mt-4">
          <PostGrid postsToShow={premiumPosts} />
        </TabsContent>
      </Tabs>

      {selectedPost && (
        <PostViewerModal
          post={selectedPost}
          creator={creator}
          isSubscribed={isSubscribed}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </>
  );
}
