
"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@/hooks/use-wallet';
import { db, storage } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { UserProfile, PromoCard } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Upload, Sparkles, Megaphone, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useTranslations } from 'next-intl';

export function PromoCardTab() {
  const t = useTranslations('PromoCard');
  const { user } = useWallet();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [promo, setPromo] = useState<Partial<PromoCard>>({
      title: '',
      description: '',
      ctaText: 'Subscribe',
      imageUrl: ''
  });

  const isVideo = promo.imageUrl?.toLowerCase().includes('.mp4') || 
                  promo.imageUrl?.toLowerCase().includes('.webm') ||
                  promo.imageUrl?.toLowerCase().includes('.mov');

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(
        doc(db, 'users', user.uid), 
        (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as UserProfile;
                if (data.promoCard) setPromo(data.promoCard);
            }
        },
        (error) => {
            console.error("PromoCardTab onSnapshot error:", error);
        }
    );
    return () => unsub();
  }, [user?.uid]);

  const extractThumbnail = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const url = URL.createObjectURL(file);
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto'; // Ensure it preloads

        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            reject(new Error('Thumbnail extraction timed out'));
        }, 5000);

        video.onloadedmetadata = () => {
            // Seek to 0.8 seconds (or mid-video if shorter)
            video.currentTime = Math.min(video.duration / 2, 0.8);
        };

        video.onseeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 360;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get canvas context');
                
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob((blob) => {
                    clearTimeout(timeout);
                    URL.revokeObjectURL(url);
                    if (blob) resolve(blob);
                    else reject(new Error('Thumbnail blob is empty'));
                }, 'image/jpeg', 0.8);
            } catch (err) {
                clearTimeout(timeout);
                URL.revokeObjectURL(url);
                reject(err);
            }
        };

        video.onerror = (err) => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            reject(err);
        };

        video.load(); // Force load
    });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.uid) return;

    setLoading(true);
    try {
        const isVideoFile = file.type.startsWith('video/');
        
        // 🗑️ Cleanup previous promo image and thumbnail if they exist
        if (promo.imageUrl && promo.imageUrl.includes('firebasestorage.googleapis.com')) {
            try {
                await deleteObject(ref(storage, promo.imageUrl));
                if (promo.thumbnailUrl) await deleteObject(ref(storage, promo.thumbnailUrl));
            } catch (e) {
                console.warn("Failed to delete previous promo media:", e);
            }
        }

        const timestamp = Date.now();
        const sRef = ref(storage, `promo_cards/${user.uid}/${timestamp}_${file.name}`);
        
        // If it's a video, generate thumbnail first
        let thumbUrl = '';
        if (isVideoFile) {
            try {
                const thumbBlob = await extractThumbnail(file);
                const tRef = ref(storage, `promo_cards/${user.uid}/thumb_${timestamp}.jpg`);
                await uploadBytesResumable(tRef, thumbBlob);
                thumbUrl = await getDownloadURL(tRef);
            } catch (thumbErr) {
                console.warn("Non-critical: Thumbnail generation failed", thumbErr);
            }
        }

        const task = uploadBytesResumable(sRef, file);
        task.on('state_changed', null, (err) => { throw err; }, async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            setPromo(prev => ({ ...prev, imageUrl: url, thumbnailUrl: thumbUrl }));
            setLoading(false);
        });
    } catch (err) {
        toast({ variant: 'destructive', title: t('uploadFailed') });
        setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.uid || !promo.imageUrl || !promo.title) {
        toast({ variant: 'destructive', title: t('missingInfo'), description: t('missingInfoDesc') });
        return;
    }

    setLoading(true);
    try {
        const userRef = doc(db, 'users', user.uid);
        const fullPromo: PromoCard = {
            imageUrl: promo.imageUrl,
            thumbnailUrl: promo.thumbnailUrl || '',
            title: promo.title,
            description: promo.description || '',
            ctaText: promo.ctaText || 'Subscribe',
            creatorId: user.uid,
            creatorName: user.username,
            // Sync current avatar to promo card on save to ensure data consistency
            creatorAvatar: user.avatar || (user as any).photoURL || '',
            updatedAt: Date.now()
        };

        await updateDoc(userRef, { promoCard: fullPromo });
        toast({ title: t('saveSuccess'), description: t('saveSuccessDesc') });
    } catch (err) {
        toast({ variant: 'destructive', title: t('saveFailed') });
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Editor */}
        <Card className="glass-card border-white/10">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" /> {t('title')}</CardTitle>
                <CardDescription>{t('subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-4">
                    <Label>{t('promoMedia') || t('promoImage')}</Label>
                    <div className="relative aspect-[16/9] rounded-2xl border-2 border-dashed border-white/10 overflow-hidden group">
                        {promo.imageUrl ? (
                            <>
                                {isVideo ? (
                                    <video src={promo.imageUrl} className="w-full h-full object-cover" autoPlay loop muted playsInline />
                                ) : (
                                    <img src={promo.imageUrl} className="w-full h-full object-cover" alt="Promo" />
                                )}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <Button variant="secondary" size="sm" onClick={async () => {
                                        if (promo.imageUrl && promo.imageUrl.includes('firebasestorage.googleapis.com')) {
                                            await deleteObject(ref(storage, promo.imageUrl)).catch(() => {});
                                        }
                                        setPromo(p => ({ ...p, imageUrl: '' }));
                                    }}><Trash2 className="w-4 h-4 mr-2"/> {t('replaceMedia')}</Button>
                                </div>
                            </>
                        ) : (
                            <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-white/5 transition-colors">
                                <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                <span className="text-xs font-bold text-muted-foreground">{t('uploadInstruction')}</span>
                                <input type="file" className="hidden" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={handleUpload} />
                            </label>
                        )}
                        {loading && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>{t('cardTitle')}</Label>
                        <Input value={promo.title} onChange={e => setPromo(p => ({ ...p, title: e.target.value }))} placeholder={t('titlePlaceholder')} className="bg-white/5" maxLength={40} />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('shortDesc')}</Label>
                        <Textarea value={promo.description} onChange={e => setPromo(p => ({ ...p, description: e.target.value }))} placeholder={t('descPlaceholder')} className="bg-white/5 resize-none h-20" maxLength={100} />
                    </div>
                    <div className="space-y-2">
                        <Label>{t('buttonText')}</Label>
                        <Input value={promo.ctaText} onChange={e => setPromo(p => ({ ...p, ctaText: e.target.value }))} placeholder="Subscribe" className="bg-white/5" />
                    </div>
                </div>

                <Button onClick={handleSave} disabled={loading} className="w-full h-12 font-bold shadow-xl shadow-primary/20 rounded-xl">
                    {loading ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    {t('saveButton')}
                </Button>
            </CardContent>
        </Card>

        {/* Preview */}
        <div className="space-y-4">
            <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">{t('livePreview')}</Label>
            <div className="w-full max-w-sm mx-auto aspect-[4/5] relative rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl group">
                 <div className="absolute inset-0 bg-muted animate-pulse" />
                 {promo.imageUrl && (
                     isVideo ? (
                         <video src={promo.imageUrl} className="absolute inset-0 w-full h-full object-cover" autoPlay loop muted playsInline />
                     ) : (
                         <img src={promo.imageUrl} className="absolute inset-0 w-full h-full object-cover" alt="Preview" />
                     )
                 )}
                 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                 
                 <div className="absolute top-4 left-4 flex items-center gap-2">
                    <Avatar className="w-8 h-8 border border-white/20">
                        <AvatarImage src={user?.avatar} />
                        <AvatarFallback>{user?.username?.[0]}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-bold text-white shadow-sm">{user?.username}</span>
                 </div>

                 <div className="absolute bottom-0 left-0 right-0 p-6 space-y-3">
                    <h3 className="text-2xl font-headline font-bold text-white leading-tight">{promo.title || t('previewDefaultTitle')}</h3>
                    <p className="text-sm text-white/70 line-clamp-2">{promo.description || t('previewDesc')}</p>
                    <Button className="w-full h-12 rounded-xl font-bold bg-white text-black hover:bg-white/90">
                        {promo.ctaText || "Subscribe"}
                    </Button>
                 </div>
            </div>
            <p className="text-center text-[10px] text-muted-foreground italic">{t('carouselNote')}</p>
        </div>
    </div>
  );
}
