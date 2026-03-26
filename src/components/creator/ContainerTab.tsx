
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, or, and } from 'firebase/firestore';
import { CreatorMedia, UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Video, Calendar, MessageSquare, Upload, Wand2, Sparkles } from 'lucide-react';
import { EditMediaModal } from './EditMediaModal';
import { useTranslations } from 'next-intl';
import { VideoPreview } from '../ui/VideoPreview';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';

export function ContainerTab() {
  const t = useTranslations('Container');
  const { user } = useWallet();
  const { toast } = useToast();
  const [mediaItems, setMediaItems] = useState<CreatorMedia[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<CreatorMedia | null>(null);
  const [brokenItems, setBrokenItems] = useState<Set<string>>(new Set());

  const handleItemError = (id: string) => {
    setBrokenItems(prev => new Set(prev).add(id));
  };

  useEffect(() => {
    if (!user?.uid) return;

    const profileDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(profileDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        console.error("User profile not found in 'users' collection!");
        toast({ variant: "destructive", title: t('errorTitle'), description: t('profileLoadError') });
      }
    });

    return () => unsubscribe();
  }, [user?.uid, toast, t]);

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


  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
            {[
                { id: 'uniq', icon: MessageSquare, color: 'bg-fuchsia-500/10 text-fuchsia-400 hover:bg-fuchsia-500/20 border-fuchsia-500/20', href: '/creator/studio?tab=standard' },
                { id: 'edit', icon: Upload, color: 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20', href: '/creator/studio?tab=aiEdit' },
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
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : mediaItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>{t('emptyStateTitle')}</p>
            <p>{t('emptyStateDesc')}</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* AI Generated Drafts Section */}
            {mediaItems.some(i => i.source === 'ai_auto') && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Loader2 className="h-4 w-4 text-primary animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider">{t('aiDrafts')}</h3>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">{t('aiDraftsSubtitle')}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {mediaItems.filter(i => i.source === 'ai_auto' && !brokenItems.has(i.id)).map(item => (
                    <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50 border border-primary/20">
                      <img 
                        src={item.mediaUrl} 
                        alt={item.caption || 'media'} 
                        className="w-full h-full object-cover" 
                        onClick={() => setSelectedMedia(item)}
                        onError={() => handleItemError(item.id)}
                      />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors pointer-events-none" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[8px] font-bold rounded-full">AI DRAFT</div>
                      
                      <div className="absolute bottom-0 left-0 right-0 p-2 text-white pointer-events-none">
                          <p className='text-xs font-bold truncate'>{item.caption || 'Yeni Taslak'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Normal Drafts Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider">{t('yourMedia') || "Sizin İçerikleriniz"}</h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {mediaItems.filter(i => i.source !== 'ai_auto' && !brokenItems.has(i.id)).map(item => (
                  <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50">
                    {item.mediaType === 'image' ? (
                      <img 
                        src={item.mediaUrl} 
                        alt={item.caption || 'media'} 
                        className="w-full h-full object-cover" 
                        onClick={() => setSelectedMedia(item)}
                        onError={() => handleItemError(item.id)}
                      />
                    ) : (
                        <div onClick={() => setSelectedMedia(item)}>
                          <VideoPreview 
                            src={item.mediaUrl} 
                            onError={() => handleItemError(item.id)}
                          />
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors pointer-events-none" />

                    {item.mediaType === 'video' && <Video className="absolute top-2 left-2 h-5 w-5 text-white pointer-events-none" />}
                    {item.status === 'scheduled' && <Calendar className="absolute top-2 right-2 h-5 w-5 text-white bg-primary/80 p-1 rounded-full pointer-events-none" />}
                    
                     <div className="absolute bottom-0 left-0 right-0 p-2 text-white pointer-events-none">
                        <p className='text-xs font-bold truncate'>{item.caption || t('untitled')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {selectedMedia && userProfile && (
        <EditMediaModal
          media={selectedMedia}
          creatorProfile={userProfile}
          onClose={() => setSelectedMedia(null)}
          onPublished={() => setMediaItems(prev => prev.filter(item => item.id !== selectedMedia.id))}
        />
      )}
    </Card>
  );
}
