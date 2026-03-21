
"use client";

import { useState, useEffect, useRef } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { CreatorMedia, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Loader2, Video, Calendar } from 'lucide-react';
import { EditMediaModal } from './EditMediaModal';
import { useTranslations } from 'next-intl';

export function ContainerTab() {
  const t = useTranslations('Container');
  const { user } = useWallet();
  const { toast } = useToast();
  const [mediaItems, setMediaItems] = useState<CreatorMedia[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<CreatorMedia | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [user?.uid, toast]);

  useEffect(() => {
    if (!user?.uid) return;

    setLoading(true);
    const q = query(
      collection(db, 'creator_media'),
      where('creatorId', '==', user.uid),
      where('status', 'in', ['draft', 'scheduled']),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia));
      setMediaItems(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.uid) return;

    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/webm'];
    const mediaType = allowedImageTypes.includes(file.type) ? 'image' : allowedVideoTypes.includes(file.type) ? 'video' : null;

    if (!mediaType) {
      toast({ variant: 'destructive', title: t('unsupportedFileType'), description: t('unsupportedFileTypeDesc') });
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `creator_media/${user.uid}/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {},
        (error) => {
          console.error("Upload failed:", error);
          toast({ variant: 'destructive', title: t('uploadFailed') });
          setUploading(false);
        },
        () => {
          getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
            await addDoc(collection(db, 'creator_media'), {
              creatorId: user.uid,
              mediaUrl: downloadURL,
              mediaType,
              caption: '',
              isPremium: false,
              priceULC: 0,
              status: 'draft',
              createdAt: serverTimestamp(),
            });
            toast({ title: t('uploadComplete'), description: t('uploadCompleteDesc') });
            setUploading(false);
          });
        }
      );
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ variant: 'destructive', title: t('uploadError') });
      setUploading(false);
    }
  };

  return (
    <Card className="glass-card border-white/10">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <Button onClick={handleUploadClick} disabled={uploading || !userProfile?.isCreator}>
          {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {t('uploadMedia')}
        </Button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" />
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
                    <h3 className="text-sm font-bold uppercase tracking-wider">Copilot Taslakları</h3>
                    <p className="text-[10px] text-muted-foreground">AI Tarafından Sizin İçin Üretilen Otomatik İçerikler</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {mediaItems.filter(i => i.source === 'ai_auto').map(item => (
                    <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50 border border-primary/20" onClick={() => setSelectedMedia(item)}>
                      <img src={item.mediaUrl} alt={item.caption || 'media'} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors" />
                      <div className="absolute top-2 left-2 px-2 py-0.5 bg-primary text-white text-[8px] font-bold rounded-full">AI DRAFT</div>
                       <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
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
                {mediaItems.filter(i => i.source !== 'ai_auto').map(item => (
                  <div key={item.id} className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group bg-black/50" onClick={() => setSelectedMedia(item)}>
                    {item.mediaType === 'image' ? (
                        <img src={item.mediaUrl} alt={item.caption || 'media'} className="w-full h-full object-cover" />
                    ) : (
                        <video src={item.mediaUrl} muted loop playsInline className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-colors" />
                    {item.mediaType === 'video' && <Video className="absolute top-2 left-2 h-5 w-5 text-white" />}
                    {item.status === 'scheduled' && <Calendar className="absolute top-2 right-2 h-5 w-5 text-white bg-primary/80 p-1 rounded-full" />}
                     <div className="absolute bottom-0 left-0 right-0 p-2 text-white">
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
