
"use client";

import { useState } from 'react';
import { CreatorMedia, ContentPost, UserProfile, PostContentType } from '@/lib/types';
import { useWallet } from '@/hooks/use-wallet';
import { useToast } from '@/hooks/use-toast';
import { db, storage } from '@/lib/firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, X, Calendar as CalendarIcon, Upload, Globe, Lock, Clock, Wand2, Sparkles, Video } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTranslations, useLocale } from 'next-intl';
import { Copilot } from '@/lib/copilot';
import { useEffect } from 'react';

interface EditMediaModalProps {
  media: CreatorMedia;
  creatorProfile: UserProfile;
  onClose: () => void;
  onPublished: () => void;
}

export function EditMediaModal({ creatorProfile, media, onClose, onPublished }: EditMediaModalProps) {
  const t = useTranslations('EditMedia');
  const locale = useLocale();
  const { user } = useWallet();
  const { toast } = useToast();
  const [caption, setCaption] = useState(media.caption || '');
  const [contentType, setContentType] = useState<PostContentType>(media.contentType || 'public');
  const [priceULC, setPriceULC] = useState(media.priceULC || 10);
  const [totalSupply, setTotalSupply] = useState(100);
  const [loadingAction, setLoadingAction] = useState<'publish' | 'schedule' | 'delete' | null>(null);
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(
    media.scheduledFor ? new Date(media.scheduledFor) : undefined
  );
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [monetizationSuggestion, setMonetizationSuggestion] = useState<{ premiumPrice: number, limitedPrice: number, limitedSupply: number, score: number, recommendation: string } | null>(null);

  const copilot = new Copilot(user?.uid || '');

  // 🚀 Smart Flow: Auto-check for monetization suggestions (Images only)
  useEffect(() => {
    if (user?.uid) {
      copilot.init().then(() => {
        // Get suggestion for this media (V2)
        const suggestion = copilot.getMonetizationSuggestion(media.prompt || media.aiPrompt || "", !!media.isAI);
        setMonetizationSuggestion(suggestion);
      });
    }
  }, [user?.uid, media.id]);

  const handleGenerateCaption = async () => {
    if (!media.mediaUrl || media.mediaType !== 'image') return;
    setIsGeneratingCaption(true);
    try {
      await copilot.init();
      const promptToUse = media.prompt || media.aiPrompt || "";
      const generatedCaption = await copilot.generateContainerCopy({
        imageUrl: media.mediaUrl,
        contentType,
        originalPrompt: promptToUse,
        locale: locale
      });

      if (generatedCaption) {
        setCaption(generatedCaption);
        toast({ title: t('captionGenerated') || "Copilot: Açıklama Hazır", description: t('captionGeneratedDesc') || "Görseliniz için en iyi açıklama oluşturuldu." });
      }
    } catch (error: any) {
      console.error("Caption generation error:", error);
      toast({ variant: 'destructive', title: "Hata", description: error.message });
    } finally {
      setIsGeneratingCaption(false);
    }
  };


  const handlePublish = async () => {
    if (!user) {
      toast({ variant: "destructive", title: t('authError'), description: t('authErrorDesc') });
      return;
    }

    setLoadingAction('publish');
    try {
      const postData: any = {
        creatorId: user.uid,
        creatorName: creatorProfile.username,
        creatorAvatar: creatorProfile.avatar,
        mediaUrl: media.mediaUrl,
        mediaType: media.mediaType,
        content: caption,
        contentType: contentType,
        unlockPrice: contentType === 'premium' ? priceULC : (contentType === 'limited' ? priceULC : 0),
        createdAt: Date.now(),
        likes: 0,
        unlockCount: 0,
        earningsULC: 0,
        // Carry over AI prompt data if exists
        ...(media.isAI && {
          isAI: true,
          aiPrompt: media.aiPrompt || media.prompt,
          aiEnhancedPrompt: media.aiEnhancedPrompt || media.enhancedPrompt
        }),
        ...(contentType === 'limited' && {
          limited: {
            totalSupply: Number(totalSupply),
            soldCount: 0,
            price: Number(priceULC)
          }
        })
      };

      await addDoc(collection(db, 'posts'), postData);
      await deleteDoc(doc(db, 'creator_media', media.id));

      // Update onboarding completion
      if (user.onboardingState?.step === 'first_container') {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          'onboardingState.step': 'completed',
          'onboardingState.completedSteps': [...(user.onboardingState.completedSteps || []), 'first_publish']
        });
      }

      toast({ title: t('publishSuccess'), description: t('publishSuccessDesc') });
      onPublished();
      onClose();
    } catch (error) {
      console.error("Publishing failed:", error);
      toast({ variant: 'destructive', title: t('publishFailedTitle') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleScheduleOrUpdate = async () => {
    if (!scheduledFor) {
      toast({ variant: 'destructive', title: t('scheduleMissingDate') });
      return;
    }
    setLoadingAction('schedule');
    try {
      const finalScheduleTime = new Date(scheduledFor);
      // No longer resetting minutes to 0, 0, 0 to allow 15-min precision
      finalScheduleTime.setSeconds(0, 0);

      await updateDoc(doc(db, 'creator_media', media.id), {
        status: 'scheduled',
        scheduledFor: finalScheduleTime.getTime(),
        caption,
        contentType,
        priceULC: Number(priceULC),
        ...(contentType === 'limited' && {
          limited: {
            totalSupply: Number(totalSupply),
            price: Number(priceULC)
          }
        })
      });
      toast({ title: t('scheduleSuccess'), description: t('scheduleSuccessDesc', { time: format(finalScheduleTime, "PPP 'at' HH:00") }) });
      onClose();
    } catch (error) {
      console.error("Scheduling/updating failed:", error);
      toast({ variant: 'destructive', title: t('actionFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    setLoadingAction('delete');
    try {
      const fileRef = ref(storage, media.mediaUrl);
      await deleteObject(fileRef);
      await deleteDoc(doc(db, 'creator_media', media.id));
      toast({ title: t('deleteTitle') });
      onClose();
    } catch (error) {
      console.error("Delete failed:", error);
      toast({ variant: 'destructive', title: t('deleteFailed') });
    } finally {
      setLoadingAction(null);
    }
  };

  const isScheduled = media.status === 'scheduled';

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-full h-full max-h-[90vh] flex flex-col bg-background border border-white/10 p-0 overflow-hidden">
        <Button onClick={onClose} className="absolute top-2 right-2 z-50 h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black/80 text-white">
          <X className="h-4 w-4" />
        </Button>
        <DialogTitle className="sr-only">{t('editContent')}</DialogTitle>
        <DialogDescription className="sr-only">{t('configureContent')}</DialogDescription>

        <div className="flex flex-col md:grid md:grid-cols-12 h-full overflow-y-auto md:overflow-hidden">
          <div className="md:col-span-7 flex items-center justify-center bg-black/80 overflow-hidden relative group">
            {media.mediaType === 'image' ? (
              <img src={media.mediaUrl} alt="Preview" className="max-w-full max-h-full w-auto h-auto object-contain" />
            ) : (
              <video src={media.mediaUrl} controls autoPlay className="max-w-full max-h-full w-auto h-auto" />
            )}
          </div>
          <div className="md:col-span-5 flex flex-col justify-between p-6 bg-background/50 overflow-y-auto custom-scrollbar">
            <div className="space-y-6">

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="caption" className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>{t('caption')}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateCaption}
                    disabled={isGeneratingCaption || media.mediaType !== 'image'}
                    className="h-7 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10 rounded-full disabled:opacity-30"
                  >
                    {isGeneratingCaption ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {caption ? "Açıklamayı İyileştir" : "Açıklama Oluştur"}
                  </Button>
                </div>
                <Textarea id="caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('captionPlaceholder')} className="bg-input/50 resize-none h-24" maxLength={280} />
              </div>

              {/* Copilot V2: Monetization Intelligence */}
              {monetizationSuggestion && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3 animate-in fade-in transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="text-primary w-4 h-4" />
                      <span className="text-xs font-bold uppercase text-primary tracking-widest">Copilot V2 Değerlendirmesi</span>
                    </div>
                    <Badge variant="secondary" className="bg-primary text-white text-[10px]">Skor: {monetizationSuggestion.score}/100</Badge>
                  </div>
                  
                  <div className="p-3 bg-black/40 rounded-xl border border-white/5">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1 tracking-wider">Akıllı Öneri</p>
                    <p className="text-sm font-bold text-white leading-relaxed">{monetizationSuggestion.recommendation}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setContentType('premium'); setPriceULC(monetizationSuggestion.premiumPrice); }} 
                      className="flex-1 h-9 text-[10px] rounded-full border border-primary/20 hover:bg-primary/20 font-bold transition-all"
                    >
                      Premium ({monetizationSuggestion.premiumPrice} ULC)
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => { setContentType('limited'); setPriceULC(monetizationSuggestion.limitedPrice); setTotalSupply(monetizationSuggestion.limitedSupply); }} 
                      className="flex-1 h-9 text-[10px] rounded-full border border-primary/20 hover:bg-primary/20 font-bold transition-all"
                    >
                      Limited ({monetizationSuggestion.limitedPrice} ULC)
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>{t('contentType')}</Label>
                <RadioGroup value={contentType} onValueChange={(v) => setContentType(v as PostContentType)} className="grid grid-cols-1 gap-2">
                  <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <RadioGroupItem value="public" id="public" />
                    <Label htmlFor="public" className="flex-1 cursor-pointer flex items-center gap-2">
                      <Globe className="w-4 h-4 text-green-400" />
                      <div className="flex flex-col">
                        <span className="font-bold">{t('public')}</span>
                        <span className="text-[10px] opacity-60">{t('publicDesc')}</span>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <RadioGroupItem value="premium" id="premium" />
                    <Label htmlFor="premium" className="flex-1 cursor-pointer flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      <div className="flex flex-col">
                        <span className="font-bold">{t('premium')}</span>
                        <span className="text-[10px] opacity-60">{t('premiumDesc')}</span>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 bg-white/5 p-3 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-colors">
                    <RadioGroupItem value="limited" id="limited" />
                    <Label htmlFor="limited" className="flex-1 cursor-pointer flex items-center gap-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <div className="flex flex-col">
                        <span className="font-bold">{t('limited')}</span>
                        <span className="text-[10px] opacity-60">{t('limitedDesc')}</span>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {contentType !== 'public' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="space-y-2">
                    <Label htmlFor="price" className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>{t('priceULC')}</Label>
                    <Input id="price" type="number" value={priceULC} onChange={(e) => setPriceULC(Number(e.target.value))} className="bg-input/50 h-11 font-bold" />
                  </div>

                  {contentType === 'limited' && (
                    <div className="space-y-2">
                      <Label htmlFor="supply" className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>{t('totalSupply')}</Label>
                      <Input id="supply" type="number" value={totalSupply} onChange={(e) => setTotalSupply(Number(e.target.value))} className="bg-input/50 h-11 font-bold" />
                      <p className='text-[10px] text-muted-foreground'>{t('supplyDesc')}</p>
                    </div>
                  )}
                </div>
              )}

              {/* 🎬 Animate Section - Relocated from thumbnails */}
              {media.mediaType === 'image' && (
                <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-2xl animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold uppercase text-primary tracking-widest">Görseli Hareketlendir</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">Bu görseli Kling AI ile profesyonel bir videoya dönüştürün.</p>
                  <Button 
                    variant="secondary" 
                    className="w-full h-11 rounded-xl font-bold gap-2 shadow-lg hover:bg-primary hover:text-white transition-all"
                    onClick={() => {
                      window.location.href = `/creator/animate?imageId=${media.id}`;
                    }}
                  >
                    <Sparkles className="w-4 h-4" />
                    Hareketlendir (60 ULC)
                  </Button>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Label className='text-sm font-bold uppercase tracking-wider text-muted-foreground'>{isScheduled ? t('updateSchedule') : t('scheduleForLater')}</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "flex-1 justify-start text-left font-normal h-11 bg-input/30",
                          !scheduledFor && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {scheduledFor ? format(scheduledFor, "MMM d") : <span>{t('date')}</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-white/10">
                      <Calendar
                        mode="single"
                        selected={scheduledFor}
                        onSelect={(date) => {
                          const newDate = date || new Date();
                          const currentHour = scheduledFor?.getHours() || new Date().getHours();
                          newDate.setHours(currentHour);
                          setScheduledFor(newDate);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <Select
                    value={scheduledFor ? String(scheduledFor.getHours()) : undefined}
                    onValueChange={(value) => {
                      const hour = parseInt(value, 10);
                      const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                      newDate.setHours(hour);
                      setScheduledFor(newDate);
                    }}
                  >
                    <SelectTrigger className="w-20 h-11 bg-input/30">
                      <SelectValue placeholder="HH" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 24 }, (_, i) => (
                        <SelectItem key={i} value={String(i)}>
                          {String(i).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-xl self-center opacity-50">:</span>
                  <Select
                    value={scheduledFor ? String(scheduledFor.getMinutes()) : undefined}
                    onValueChange={(value) => {
                      const min = parseInt(value, 10);
                      const newDate = scheduledFor ? new Date(scheduledFor) : new Date();
                      newDate.setMinutes(min);
                      setScheduledFor(newDate);
                    }}
                  >
                    <SelectTrigger className="w-20 h-11 bg-input/30">
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 15, 30, 45].map((m) => (
                        <SelectItem key={m} value={String(m)}>
                          {String(m).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex flex-col space-y-3 mt-8">
              <Button onClick={handlePublish} disabled={!!loadingAction} className='h-14 w-full text-lg font-bold gap-2 rounded-2xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20'>
                {loadingAction === 'publish' ? <Loader2 className="animate-spin" /> : <><Upload size={20} />{t('publishNow')}</>}
              </Button>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleScheduleOrUpdate} disabled={!!loadingAction || !scheduledFor} className='flex-1 h-12 gap-2 rounded-xl'>
                  {loadingAction === 'schedule' ? <Loader2 className="animate-spin h-4 w-4" /> : <><CalendarIcon size={16} />{isScheduled ? t('update') : t('schedule')}</>}
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" disabled={!!loadingAction} className='h-12 w-12 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10'>
                      {loadingAction === 'delete' ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 size={18} />}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2rem]">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t('deleteAlertTitle')}</AlertDialogTitle>
                      <AlertDialogDescription>{t('deleteAlertDesc')}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">{t('cancel')}</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl">{t('delete')}</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
