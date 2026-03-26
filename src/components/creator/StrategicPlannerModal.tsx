"use client";

import { useState, useEffect } from 'react';
import { CreatorMedia, UserProfile, PostContentType } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, updateDoc, or, and } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Sparkles, Calendar, Clock, Lock, Globe, CheckCircle2, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Uniq } from '@/lib/uniq';
import { cn } from '@/lib/utils';

interface DayPlannerProps {
    dayIndex: number;
    initialDate: number;
    userId: string;
    isOpen: boolean;
    onClose: () => void;
    onPlanned: () => void;
}

    export function StrategicPlannerModal({ dayIndex, initialDate, userId, isOpen, onClose, onPlanned }: DayPlannerProps) {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [containerMedia, setContainerMedia] = useState<CreatorMedia[]>([]);
    const [slots, setSlots] = useState<{
        public: CreatorMedia | null;
        premium: CreatorMedia | null;
        limited: CreatorMedia | null;
    }>({ public: null, premium: null, limited: null });
    
    const [initialSlots, setInitialSlots] = useState<{
        public: CreatorMedia | null;
        premium: CreatorMedia | null;
        limited: CreatorMedia | null;
    }>({ public: null, premium: null, limited: null });

    const [editValues, setEditValues] = useState<{
        public: { caption: string };
        premium: { caption: string; price: number };
        limited: { caption: string; price: number; supply: number };
    }>({
        public: { caption: '' },
        premium: { caption: '', price: 25 },
        limited: { caption: '', price: 50, supply: 5 }
    });

    const uniq = new Uniq(userId);

    useEffect(() => {
        if (isOpen) {
            fetchContainerMedia();
        }
    }, [isOpen]);

    // Sync editValues when slots change
    useEffect(() => {
        const newValues = { ...editValues };
        if (slots.public) newValues.public.caption = slots.public.caption || slots.public.aiPrompt || '';
        if (slots.premium) {
            newValues.premium.caption = slots.premium.caption || slots.premium.aiPrompt || '';
            newValues.premium.price = slots.premium.priceULC || 25;
        }
        if (slots.limited) {
            newValues.limited.caption = slots.limited.caption || slots.limited.aiPrompt || '';
            newValues.limited.price = slots.limited.limited?.price || slots.limited.priceULC || 50;
            newValues.limited.supply = slots.limited.limited?.totalSupply || 5;
        }
        setEditValues(newValues);
    }, [slots]);

    const fetchContainerMedia = async () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, 'creator_media'),
                and(
                    where('creatorId', '==', userId),
                    where('status', 'in', ['draft', 'planned'])
                )
            );
            const snap = await getDocs(q);
            const media = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia));
            setContainerMedia(media);

            // Fetch already scheduled for this day if any
            const qScheduled = query(
                collection(db, 'creator_media'),
                and(
                    or(
                        where('creatorId', '==', userId),
                        where('userId', '==', userId)
                    ),
                    where('status', 'in', ['scheduled', 'planned'])
                )
            );
            const snapScheduled = await getDocs(qScheduled);
            const scheduled = snapScheduled.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia));
            
            // Look for items scheduled for this specific day (roughly)
            // DayIndex 0 = today, etc.
            const today = new Date();
            today.setHours(0,0,0,0);
            const targetDayStart = today.getTime() + (dayIndex * 24 * 60 * 60 * 1000);
            const targetDayEnd = targetDayStart + (24 * 60 * 60 * 1000);

            const dayItems = scheduled.filter(item => item.scheduledFor && item.scheduledFor >= targetDayStart && item.scheduledFor < targetDayEnd);
            
            const newSlots: {
                public: CreatorMedia | null;
                premium: CreatorMedia | null;
                limited: CreatorMedia | null;
            } = { public: null, premium: null, limited: null };
            dayItems.forEach(item => {
                if (item.contentType === 'public') newSlots.public = item;
                if (item.contentType === 'premium') newSlots.premium = item;
                if (item.contentType === 'limited') newSlots.limited = item;
            });
            setSlots(newSlots);
            setInitialSlots(newSlots);

        } catch (error) {
            console.error("Error fetching media:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAutoSuggest = async () => {
        if (containerMedia.length === 0) {
            toast({ title: "Konteyner Boş", description: "Öneri yapabilmem için önce konteynere içerik yüklemelisin." });
            return;
        }

        await uniq.init();
        const scoredMedia = containerMedia.map(m => ({
            media: m,
            suggestion: uniq.getMonetizationSuggestion(m.prompt || m.aiPrompt || "", !!m.isAI)
        }));

        // Sort by score descending
        scoredMedia.sort((a, b) => b.suggestion.score - a.suggestion.score);

        setSlots({
            limited: scoredMedia[0]?.media || null,
            premium: scoredMedia[1]?.media || null,
            public: scoredMedia[scoredMedia.length - 1]?.media || null
        });

        toast({ title: "Stratejik Öneri Hazır", description: "En kaliteli içeriklerin Limited ve Premium slotlarına yerleştirildi." });
    };

    const handleScheduleDay = async () => {
        if (!slots.public && !slots.premium && !slots.limited) {
            toast({ variant: "destructive", title: "Hata", description: "Lütfen en az bir slot için içerik seçin." });
            return;
        }

        setSaving(true);
        try {
            const baseTime = initialDate + (dayIndex * 24 * 60 * 60 * 1000);

            // Slot Times: Public (10 AM), Premium (4 PM), Limited (8 PM)
            const times = {
                public: baseTime + (10 * 60 * 60 * 1000), 
                premium: baseTime + (16 * 60 * 60 * 1000),
                limited: baseTime + (20 * 60 * 60 * 1000)
            };

            const promises: Promise<any>[] = [];
            
            // Process slots
            const processSlot = (type: 'public' | 'premium' | 'limited') => {
                const current = slots[type];
                const initial = initialSlots[type];
                const values = editValues[type];

                if (current) {
                    // Update or Keep
                    const updateData: any = {
                        status: 'scheduled',
                        scheduledFor: times[type],
                        contentType: type,
                        caption: (values as any).caption || ''
                    };

                    if (type === 'premium') {
                        updateData.priceULC = (values as any).price || 25;
                    } else if (type === 'limited') {
                        updateData.priceULC = (values as any).price || 50;
                        updateData.limited = {
                            totalSupply: (values as any).supply || 5,
                            price: (values as any).price || 50
                        };
                    } else {
                        updateData.priceULC = 0;
                    }

                    promises.push(updateDoc(doc(db, 'creator_media', current.id), updateData));
                } else if (initial) {
                    // Item was removed
                    promises.push(updateDoc(doc(db, 'creator_media', initial.id), {
                        status: 'draft',
                        scheduledFor: null,
                        contentType: null,
                        limited: null
                    }));
                }
            };

            processSlot('public');
            processSlot('premium');
            processSlot('limited');

            await Promise.all(promises);
            onPlanned();
            toast({ title: `Day ${dayIndex + 1} Planlandı`, description: "Seçilen içerikler takvime işlendi ve otomatik yayınlanacak." });
            onClose();
        } catch (error) {
            console.error("Save error:", error);
            toast({ variant: "destructive", title: "Hata", description: "Plan kaydedilemedi." });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl bg-background border-white/5 p-0 overflow-hidden rounded-[2.5rem]">
                <div className="flex flex-col h-[80vh]">
                    <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                        <div>
                            <DialogTitle asChild>
                                <h2 className="text-2xl font-headline font-black italic uppercase tracking-tighter">
                                    Day {dayIndex + 1} 
                                    <span className="text-white/70 text-sm not-italic ml-3 font-medium">
                                        {new Intl.DateTimeFormat('tr-TR', { 
                                            weekday: 'long', 
                                            day: 'numeric', 
                                            month: 'long' 
                                        }).format(new Date(initialDate + (dayIndex * 24 * 60 * 60 * 1000)))}
                                    </span>
                                </h2>
                            </DialogTitle>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">İçerik Strateji ve Yayın Akışı</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={handleAutoSuggest} className="rounded-full gap-2 text-primary hover:bg-primary/10 font-bold text-[10px] uppercase tracking-widest">
                            <Sparkles size={14} /> Otomatik Strateji Oluştur
                        </Button>
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <SlotView 
                                type="public" 
                                media={slots.public} 
                                availableMedia={containerMedia} 
                                values={editValues.public}
                                onSelect={(m) => setSlots(s => ({ ...s, public: m }))} 
                                onEdit={(v) => setEditValues(s => ({ ...s, public: { ...s.public, ...v } }))}
                            />
                            <SlotView 
                                type="premium" 
                                media={slots.premium} 
                                availableMedia={containerMedia} 
                                values={editValues.premium}
                                onSelect={(m) => setSlots(s => ({ ...s, premium: m }))} 
                                onEdit={(v) => setEditValues(s => ({ ...s, premium: { ...s.premium, ...v } }))}
                            />
                            <SlotView 
                                type="limited" 
                                media={slots.limited} 
                                availableMedia={containerMedia} 
                                values={editValues.limited}
                                onSelect={(m) => setSlots(s => ({ ...s, limited: m }))} 
                                onEdit={(v) => setEditValues(s => ({ ...s, limited: { ...s.limited, ...v } }))}
                            />
                        </div>
                    </div>

                    <div className="p-8 border-t border-white/5 bg-black/40 flex items-center justify-end gap-4">
                        <Button variant="ghost" onClick={onClose} disabled={saving} className="rounded-xl px-8 font-bold text-muted-foreground uppercase text-[10px] tracking-widest">Vazgeç</Button>
                        <Button onClick={handleScheduleDay} disabled={saving} className="rounded-xl px-12 font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20">
                            {saving ? <Loader2 className="animate-spin" /> : "Günü Onayla ve Planla"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function SlotView({ type, media, availableMedia, values, onSelect, onEdit }: { 
    type: 'public' | 'premium' | 'limited', 
    media: CreatorMedia | null, 
    availableMedia: CreatorMedia[],
    values: any,
    onSelect: (m: CreatorMedia | null) => void,
    onEdit: (v: any) => void
}) {
    const [isPicking, setIsPicking] = useState(false);

    const icons = {
        public: <Globe className="w-4 h-4 text-green-400" />,
        premium: <Lock className="w-4 h-4 text-primary" />,
        limited: <Clock className="w-4 h-4 text-yellow-400" />
    };

    const labels = {
        public: "General Drop",
        premium: "Exclusive Drop",
        limited: "Legacy Event"
    };

    const times = {
        public: "10:00",
        premium: "16:00",
        limited: "20:00"
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {icons[type]}
                    <span className="text-[10px] font-black uppercase tracking-widest">{type}</span>
                    <span className="text-[9px] opacity-40 font-bold uppercase">{labels[type]}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                    <Clock size={10} className="text-muted-foreground" />
                    <span className="text-[9px] font-bold text-muted-foreground">{times[type]}</span>
                </div>
            </div>

            <div className={cn(
                "aspect-[3/4] rounded-[2rem] border relative overflow-hidden flex flex-col items-center justify-center gap-3 transition-all group cursor-pointer",
                media ? "border-primary/50 bg-primary/5 shadow-lg shadow-primary/10" : "border-white/5 bg-white/[0.02] border-dashed hover:border-white/20"
            )} onClick={() => !media && setIsPicking(true)}>
                {media ? (
                    <>
                        <img src={media.mediaUrl} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Planned" />
                        <div 
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2"
                            onClick={(e) => { e.stopPropagation(); setIsPicking(true); }}
                        >
                             <div className="w-10 h-10 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center border border-primary/30">
                                <Sparkles size={16} className="text-primary" />
                             </div>
                             <span className="text-[10px] font-black tracking-widest text-white uppercase">Değiştir</span>
                        </div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onSelect(null); }} 
                            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center hover:bg-red-500 transition-colors border border-white/10"
                        >
                            <X size={14} className="text-white" />
                        </button>
                    </>
                ) : (
                    <>
                        <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center opacity-30">
                            <Calendar size={20} />
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsPicking(true)} className="rounded-full text-[10px] font-black border-white/10 bg-white/5">İÇERİK SEÇ</Button>
                    </>
                )}
            </div>

            {isPicking && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl animate-in fade-in flex items-center justify-center p-12">
                     <div className="max-w-4xl w-full flex flex-col gap-8">
                        <div className="flex items-center justify-between">
                            <h3 className="text-2xl font-headline font-black uppercase italic tracking-tighter">İçerik Seç <span className="text-primary text-sm not-italic opacity-50 ml-2">{type.toUpperCase()}</span></h3>
                            <Button variant="ghost" onClick={() => setIsPicking(false)} className="rounded-full h-10 w-10 p-0 hover:bg-white/10">
                                <X size={20} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto custom-scrollbar p-1">
                            {availableMedia.length === 0 ? (
                                <div className="col-span-full py-20 text-center opacity-30">
                                    <p className="text-xs font-bold uppercase tracking-widest">Konteyner boş. Önce içerik üretmelisin.</p>
                                </div>
                            ) : (
                                availableMedia.map((m) => (
                                    <div 
                                        key={m.id} 
                                        onClick={() => { onSelect(m); setIsPicking(false); }}
                                        className="aspect-square rounded-2xl border border-white/5 overflow-hidden group cursor-pointer hover:border-primary transition-all relative"
                                    >
                                        <img src={m.mediaUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
                                        <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Badge className="bg-primary text-white text-[10px]">SEÇ</Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                     </div>
                </div>
            )}

            {media && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Açıklama / Caption</Label>
                        <Textarea 
                            value={values.caption} 
                            onChange={(e) => onEdit({ caption: e.target.value })}
                            placeholder="İçerik hakkında kısa bir yazı..."
                            className="bg-white/5 border-white/5 text-[11px] min-h-[60px] rounded-xl focus:border-primary/30 transition-all"
                        />
                    </div>

                    {(type === 'premium' || type === 'limited') && (
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Fiyat (ULC)</Label>
                                <Input 
                                    type="number"
                                    value={values.price}
                                    onChange={(e) => onEdit({ price: parseInt(e.target.value) || 0 })}
                                    className="bg-white/5 border-white/5 text-xs h-9 rounded-xl focus:border-primary/30"
                                />
                            </div>
                            {type === 'limited' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[9px] font-black uppercase tracking-widest opacity-50">Adet / Supply</Label>
                                    <Input 
                                        type="number"
                                        value={values.supply}
                                        onChange={(e) => onEdit({ supply: parseInt(e.target.value) || 0 })}
                                        className="bg-white/5 border-white/5 text-xs h-9 rounded-xl focus:border-primary/30"
                                    />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
