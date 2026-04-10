"use client"

import { ContentPost, UserProfile } from '@/lib/types';
import { 
  MoreHorizontal, 
  Lock, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { VideoPreview } from '@/components/ui/VideoPreview';
import { useTranslations } from 'next-intl';
import { formatDistanceToNow } from 'date-fns';
import { tr, enUS, ru, arSA } from 'date-fns/locale';
import { useLocale } from 'next-intl';

interface FeedPostProps {
  post: ContentPost;
  creator: UserProfile;
  canViewContent: boolean;
  isUnlocked: boolean;
  onPostClick: (post: ContentPost) => void;
  signedUrl?: string;
  onMediaError?: () => void;
}

export function FeedPost({ post, creator, canViewContent, isUnlocked, onPostClick, signedUrl, onMediaError }: FeedPostProps) {
  const t = useTranslations('Post');
  const locale = useLocale();

  const getDateLocale = () => {
    switch (locale) {
      case 'tr': return tr;
      case 'ru': return ru;
      case 'ar': return arSA;
      default: return enUS;
    }
  };

  // Prefer signed URL; fall back to mediaUrl only if it's a valid http(s) URL (not gs://)
  const rawMediaUrl = post.mediaUrl?.startsWith('http') ? post.mediaUrl : null;
  const displayUrl = signedUrl || rawMediaUrl;
  const isSoldOut = post.contentType === 'limited' && post.limited && post.limited.soldCount >= post.limited.totalSupply;

  return (
    <article className="w-full max-w-xl mx-auto mb-10 overflow-hidden bg-card/20 md:border md:border-white/10 md:rounded-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between p-3 md:p-4">
        <Link href={`/profile/${post.creatorId}`} className="flex items-center gap-3 group">
          <Avatar className="w-8 h-8 md:w-10 md:h-10 border-2 border-primary/20 group-hover:border-primary transition-colors">
            <AvatarImage src={creator?.avatar || post.creatorAvatar} />
            <AvatarFallback>{post.creatorName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-bold font-headline group-hover:text-primary transition-colors">{post.creatorName}</span>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(post.createdAt || 0, { addSuffix: true, locale: getDateLocale() })}
            </span>
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <MoreHorizontal className="w-5 h-5" />
        </Button>
      </div>

      {/* Content area */}
      <div 
        className="relative aspect-square w-full bg-muted/30 cursor-pointer overflow-hidden group"
        onClick={() => onPostClick(post)}
      >
        {/* Media Layer */}
        {post.mediaUrl && (canViewContent || post.contentType === 'public') ? (
            (() => {
                if (!displayUrl && post.contentType !== 'public') {
                    return (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <img src={post.mediaUrl} className="w-full h-full object-cover blur-3xl opacity-50" alt="post" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <Sparkles className="w-10 h-10 text-primary/40 animate-pulse" />
                            </div>
                        </div>
                    );
                }
                return (post.mediaType === 'image' || !post.mediaType) ? (
                    <img 
                        src={displayUrl || post.mediaUrl} 
                        alt="post" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        onError={() => onMediaError?.()}
                    />
                ) : (
                    <VideoPreview 
                        src={displayUrl || post.mediaUrl} 
                        className="transition-transform duration-700 group-hover:scale-105" 
                    />
                );
            })()
        ) : (
            // Placeholder for locked content
            <div className="w-full h-full bg-gradient-to-br from-primary/5 via-primary/10 to-transparent flex items-center justify-center relative">
                <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
                <div className="flex flex-col items-center gap-4 z-10 p-8 text-center">
                    <div className="p-5 rounded-full bg-white/5 border border-white/10 shadow-2xl scale-125">
                        {post.contentType === 'limited' ? <Clock className="w-10 h-10 text-yellow-400" /> : <Lock className="w-10 h-10 text-primary" />}
                    </div>
                    <div className="space-y-1">
                        <p className="font-bold text-lg text-white font-headline">{post.contentType === 'limited' ? t('limited') : t('premium')}</p>
                        <p className="text-sm text-muted-foreground">{t('unlockDescription')}</p>
                    </div>
                    <Button 
                        size="lg" 
                        className="rounded-full bg-primary hover:bg-primary/90 font-bold px-8 shadow-lg shadow-primary/20"
                    >
                        {post.contentType === 'limited' ? post.limited?.price : post.unlockPrice} ULC
                    </Button>
                </div>
            </div>
        )}

        {/* Badges Layer */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            {post.contentType === 'limited' && (
                <Badge className="bg-yellow-400 text-black border-none font-black text-[10px] tracking-tighter px-2 py-0.5 rounded-lg shadow-xl">
                    {t('limited')} {isSoldOut && `• ${t('soldOut')}`}
                </Badge>
            )}
            {post.contentType === 'premium' && (
                <Badge className="bg-primary text-white border-none font-black text-[10px] tracking-tighter px-2 py-0.5 rounded-lg shadow-xl">
                    {t('premium')}
                </Badge>
            )}
        </div>
      </div>

      {/* Caption */}
      {(() => {
        const caption = post.content || post.title || '';
        // Only show caption if it has real content (not empty, not just an emoji placeholder like "🖼️post")
        const isPlaceholder = caption.length < 3 || /^[\p{Emoji}\s]*post$/u.test(caption.trim());
        if (!caption || isPlaceholder) return null;
        return (
          <div className="p-3 md:p-4 pt-0">
            <div className="space-y-1">
              <p className="text-sm">
                <span className="font-bold mr-2">{post.creatorName}</span>
                <span className="text-muted-foreground leading-relaxed">{caption}</span>
              </p>
            </div>
          </div>
        );
      })()}
    </article>
  );
}
