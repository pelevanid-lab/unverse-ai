
"use client"

import { useWallet } from '@/hooks/use-wallet';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Clock, Lock, CheckCircle2, Check, AlertCircle, ChevronLeft, Brain, Zap, Target, User, ArrowRight, Loader2, Monitor, Calendar } from 'lucide-react';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { doc, updateDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserProfile, CreatorMedia } from '@/lib/types';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { processAiCreatorActivation, getSystemConfig } from '@/lib/ledger';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getDailyStrategySuggestions } from '@/lib/CopilotEngine';
import { Copilot } from '@/lib/copilot';
import { motion, AnimatePresence } from 'framer-motion';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { SupportChatAi } from '@/components/creator/SupportChatAi';
import { StrategicPlannerModal } from '@/components/creator/StrategicPlannerModal';

interface AIpersonaConfig {
    personaName: string;
    niche: string;
    tone: string;
    targetAudience: string;
    vibe: string;
}

const defaultConfig: AIpersonaConfig = {
    personaName: '',
    niche: '',
    tone: '',
    targetAudience: '',
    vibe: ''
};

export default function CopilotPage() {
    const t = useTranslations('AIStudio');
    const locale = useLocale();
    const { user, isConnected } = useWallet();
    const { toast } = useToast();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastDrop, setLastDrop] = useState<CreatorMedia | null>(null);
    const [config, setConfig] = useState({
        personaName: '',
        niche: '',
        tone: '',
        targetAudience: '',
        vibe: ''
    });

    const [suggestions, setSuggestions] = useState<{ title: string, content: string }[]>([]);
    const [isSaved, setIsSaved] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [containerCount, setContainerCount] = useState(0);
    const [isScheduling, setIsScheduling] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [isPlannerOpen, setIsPlannerOpen] = useState(false);
    const [scheduledItems, setScheduledItems] = useState<CreatorMedia[]>([]);
    const [mediaPool, setMediaPool] = useState<CreatorMedia[]>([]);
    const [showSupport, setShowSupport] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);

    const calendarStartDate = useMemo(() => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }, []);

    useEffect(() => {
        if (user?.aiCreatorModeConfig) {
            setConfig(user.aiCreatorModeConfig);
            setSuggestions(getDailyStrategySuggestions(user.aiCreatorModeConfig.personaName, user.aiCreatorModeConfig.niche));
        } else {
            setSuggestions(getDailyStrategySuggestions("your persona", "your niche"));
        }
    }, [user?.aiCreatorModeConfig]);

    const fetchScheduledItems = useCallback(async () => {
        if (!user?.uid) return;
        const q = query(
            collection(db, 'creator_media'),
            where('creatorId', '==', user.uid),
            where('status', 'in', ['scheduled', 'planned'])
        );
        const snap = await getDocs(q);
        setScheduledItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CreatorMedia)));
    }, [user?.uid]);

    const fetchContainerMedia = useCallback(async () => {
        if (!user?.uid) return;
        const q = query(
            collection(db, 'creator_media'),
            where('creatorId', '==', user.uid),
            where('status', '==', 'draft'),
            orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        setContainerCount(snap.size);
        setMediaPool(snap.docs.map(d => ({ id: d.id, ...d.data() } as CreatorMedia)));
    }, [user?.uid]);

    useEffect(() => {
        if (!user?.uid) return;

        const fetchData = async () => {
            // 1. Fetch Last AI Drop
            const qLast = query(
                collection(db, 'creator_media'),
                where('creatorId', '==', user.uid),
                where('source', '==', 'ai_auto'),
                orderBy('createdAt', 'desc'),
                limit(1)
            );
            const snapLast = await getDocs(qLast);
            if (!snapLast.empty) {
                setLastDrop({ id: snapLast.docs[0].id, ...snapLast.docs[0].data() } as CreatorMedia);
            }

            // 2. Initial Fetches
            fetchContainerMedia();
            fetchScheduledItems();

            // 3. Admin Check
            if (user?.walletAddress) {
                const sysConfig = await getSystemConfig();
                if (sysConfig?.admin_wallet_address?.toLowerCase() === user.walletAddress.toLowerCase()) {
                    setIsAdmin(true);
                }
            }
        };

        fetchData();
    }, [user?.uid, user?.walletAddress, fetchContainerMedia, fetchScheduledItems]);

    // 🤖 Auto-Pilot Logic: Trigger initial/daily draft if active (Fixed 8 AM Drop)
    useEffect(() => {
        if (!user || !isConnected) return;
        
        const isActive = user.aiCreatorModeExpiresAt && user.aiCreatorModeExpiresAt > Date.now();
        if (!isActive) return;

        // 🎯 SYNC TRIGGER: 8:00 AM Reset Milestone
        const now = new Date();
        const today8AM = new Date();
        today8AM.setHours(8, 0, 0, 0);

        const lastRun = user.aiCreatorModeLastRunAt || 0;
        const lastRunDate = new Date(lastRun);
        
        // Trigger if:
        // 1. We are past 8 AM today
        // 2. The last run was BEFORE today's 8 AM milestone
        if (now.getTime() >= today8AM.getTime() && lastRunDate.getTime() < today8AM.getTime()) {
            handleTriggerDraft();
        }
    }, [user?.aiCreatorModeExpiresAt, user?.aiCreatorModeLastRunAt, isConnected]);

    const handleTriggerDraft = async () => {
        if (!user || isGenerating) return;
        setIsGenerating(true);
        const copilot = new Copilot(user.uid);
        try {
            await copilot.init();
            const mediaId = await copilot.generateDailyDraft();
            // Update last run time
            await updateDoc(doc(db, 'users', user.uid), {
                aiCreatorModeLastRunAt: Date.now()
            });
            toast({ title: "Copilot Premium Mission Executed", description: "A new draft has been prepared for your persona." });
            
            // Re-fetch last drop
            const q = query(
                collection(db, 'creator_media'),
                where('creatorId', '==', user.uid),
                where('source', '==', 'ai_auto'),
                orderBy('createdAt', 'desc'),
                limit(1)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
                setLastDrop({ id: snap.docs[0].id, ...snap.docs[0].data() } as CreatorMedia);
            }
        } catch (err: any) {
            console.error("Auto-draft failed:", err);
            // toast({ variant: "destructive", title: "Copilot Warning", description: err.message });
        } finally {
            setIsGenerating(false);
        }
    };

    if (!isConnected || !user) {
        return (
            <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                     <Lock className="text-primary" />
                </div>
                <p className="text-muted-foreground font-headline text-lg uppercase tracking-widest">Awaiting Identity Verification</p>
                <p className="text-xs text-muted-foreground opacity-50">Please connect your wallet to access the command center.</p>
            </div>
        );
    }

    const isActive = user.aiCreatorModeExpiresAt && user.aiCreatorModeExpiresAt > Date.now();
    // 🎯 USER-FRIENDLY COUNTER: Floor gives immediate feedback after a few hours pass
    const daysLeft = isActive ? Math.floor((user.aiCreatorModeExpiresAt! - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
    const isFirstTime = !user.aiCreatorModeActivatedAt;

    const handleActivate = async () => {
        setLoading(true);
        try {
            await processAiCreatorActivation(user.uid);
            toast({ title: "Copilot Premium Online!", description: "Your 30-day autonomous mission has successfully launched." });
        } catch (err: any) {
            toast({ variant: "destructive", title: "Launch Aborted", description: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                aiCreatorModeConfig: config
            });
            setIsSaved(true);
            toast({ title: "Intelligence Updated", description: "Persona parameters have been hardcoded into the engine." });
            // re-trigger suggestions
            setSuggestions(getDailyStrategySuggestions(config.personaName, config.niche));
            setTimeout(() => setIsSaved(false), 3000);
        } catch (err) {
            toast({ variant: "destructive", title: "Update Failed", description: "Communication with the nucleus was lost." });
        } finally {
            setLoading(false);
        }
    };

    const handleResetIntelligence = async () => {
        if (!confirm("Are you sure you want to reset your AI persona? This will clear all learned parameters.")) return;
        setResetLoading(true);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                aiCreatorModeConfig: null,
                aiCreatorModeActivatedAt: Date.now() // Restart learning timeline
            });
            setConfig({ personaName: '', niche: '', tone: '', targetAudience: '', vibe: '' });
            toast({ title: "Neural Reset Complete", description: "The core has been wiped. Awaiting new instructions." });
        } catch (err) {
            toast({ variant: "destructive", title: "Reset Failed", description: "Neural dampeners are active." });
        } finally {
            setResetLoading(false);
        }
    };

    const handleAutoSchedule = async () => {
        if (mediaPool.length === 0) return;
        setIsScheduling(true);
        try {
            const copilot = new Copilot(user.uid);
            await copilot.init();

            // 0. Clear existing 'planned' items (The current draft plan)
            const qExisting = query(
                collection(db, 'creator_media'),
                where('creatorId', '==', user.uid),
                where('status', '==', 'planned')
            );
            const snapExisting = await getDocs(qExisting);
            const clearPromises = snapExisting.docs.map(d => 
                updateDoc(doc(db, 'creator_media', d.id), {
                    status: 'draft',
                    scheduledFor: null,
                    contentType: 'public' // Reset to default
                })
            );
            await Promise.all(clearPromises);

            // 1. Cluster Media by "Session" (Enhanced Logic)
            const sessions: typeof mediaPool[] = [];
            let remainingPool = [...mediaPool].sort((a, b) => {
                const timeA = typeof a.createdAt === 'object' && a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
                const timeB = typeof b.createdAt === 'object' && b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
                return timeB - timeA; // Newest first
            });

            while (remainingPool.length > 0) {
                const seed = remainingPool.shift()!;
                const session = [seed];
                const seedPrompt = (seed.aiEnhancedPrompt || seed.prompt || "").toLowerCase();
                const seedTime = typeof seed.createdAt === 'object' && seed.createdAt?.toMillis ? seed.createdAt.toMillis() : (seed.createdAt || 0);

                // Find others in this "session"
                for (let i = 0; i < remainingPool.length; i++) {
                    const m = remainingPool[i];
                    const mPrompt = (m.aiEnhancedPrompt || m.prompt || "").toLowerCase();
                    const mTime = typeof m.createdAt === 'object' && m.createdAt?.toMillis ? m.createdAt.toMillis() : (m.createdAt || 0);

                    const timeDiff = Math.abs(seedTime - mTime);
                    const keywords = seedPrompt.split(/\s+/).filter(w => w.length > 4);
                    const overlap = keywords.filter(w => mPrompt.includes(w)).length;
                    
                    // FLEXIBLE grouping: Within 15 mins (same set) OR within 4 hours with some overlap
                    if (timeDiff < 15 * 60 * 1000 || (timeDiff < 4 * 60 * 60 * 1000 && overlap >= 2)) {
                        session.push(m);
                        remainingPool.splice(i, 1);
                        i--;
                    }
                }
                sessions.push(session);
            }

            // Flatten unassigned items for gap filling
            let generalPool = sessions.flatMap(s => s); // We'll re-extract from here to fill trios
            
            const now = new Date();
            now.setHours(8, 0, 0, 0);
            const dayInMs = 24 * 60 * 60 * 1000;
            const batchPromises = [];
            
            // 2. Schedule for every other day
            for (let i = 0; i < 14; i += 2) {
                if (generalPool.length < 3) break; // Need at least 3 for a full strategy day

                // Try to find a cohesive session first
                let dailyTrio: typeof mediaPool = [];
                const firstSession = sessions.find(s => s.length > 0);
                
                if (firstSession) {
                    // Take up to 3 from the same session
                    dailyTrio = firstSession.splice(0, 3);
                    // Remove from general pool
                    dailyTrio.forEach(item => {
                        const idx = generalPool.findIndex(g => g.id === item.id);
                        if (idx !== -1) generalPool.splice(idx, 1);
                    });

                    // If we need more to reach 3, take from general pool (closest in time)
                    while (dailyTrio.length < 3 && generalPool.length > 0) {
                        dailyTrio.push(generalPool.shift()!);
                    }
                    
                    // Cleanup empty sessions
                    if (firstSession.length === 0) {
                        const sIdx = sessions.indexOf(firstSession);
                        if (sIdx !== -1) sessions.splice(sIdx, 1);
                    }
                } else {
                    // Just take 3 from general pool
                    dailyTrio = generalPool.splice(0, 3);
                }

                if (dailyTrio.length < 3) break;

                const baseTime = now.getTime() + (i * dayInMs);
                const slotTimes = {
                    public: baseTime + (10 * 60 * 60 * 1000), // 10 AM
                    premium: baseTime + (16 * 60 * 60 * 1000), // 4 PM
                    limited: baseTime + (20 * 60 * 60 * 1000) // 8 PM
                };

                // Rank the trio items for the slots
                const rankedItems = dailyTrio.map(m => {
                    const p = (m.aiEnhancedPrompt || m.prompt || "").toLowerCase();
                    let shotWeight = 0;
                    if (p.includes("close") || p.includes("portrait") || p.includes("face")) shotWeight = 3;
                    else if (p.includes("medium") || p.includes("upper")) shotWeight = 1.5;
                    else if (p.includes("wide") || p.includes("full body") || p.includes("lifestyle")) shotWeight = -1;
                    
                    return { media: m, weight: shotWeight + (copilot.evaluateContentScore({ prompt: p }) / 30) };
                }).sort((a, b) => b.weight - a.weight);

                // Assign slots: 0 -> Limited, 1 -> Premium, 2 -> Public
                // Limited (Highest weight)
                batchPromises.push(updateDoc(doc(db, 'creator_media', rankedItems[0].media.id), {
                    status: 'planned',
                    scheduledFor: slotTimes.limited,
                    contentType: 'limited',
                    priceULC: 50,
                    limited: { totalSupply: 5, price: 50 }
                }));
                // Premium (Second)
                batchPromises.push(updateDoc(doc(db, 'creator_media', rankedItems[1].media.id), {
                    status: 'planned',
                    scheduledFor: slotTimes.premium,
                    contentType: 'premium',
                    priceULC: 25
                }));
                // Public (Last - The teaser)
                batchPromises.push(updateDoc(doc(db, 'creator_media', rankedItems[2].media.id), {
                    status: 'planned',
                    scheduledFor: slotTimes.public,
                    contentType: 'public',
                    priceULC: 0
                }));
            }

            if (batchPromises.length > 0) {
                await Promise.all(batchPromises);
                toast({ 
                    title: "Strategic Drafts Generated", 
                    description: "Vibe-matched plan is ready! Please click on each day to review and 'Confirm Day' to activate the schedule.",
                    className: "bg-primary text-black font-bold border-none"
                });
                fetchScheduledItems();
                fetchContainerMedia();
            }
        } catch (err) {
            console.error("Auto-schedule failed:", err);
            toast({ variant: "destructive", title: "Scheduling Error", description: "Failed to build the strategic timeline." });
        } finally {
            setIsScheduling(false);
        }
    };

    const handleResetSchedule = async () => {
        if (!confirm("Tüm planlanmış içerikleri temizlemek ve takvimi kurguya hazır hale getirmek istediğine emin misin?")) return;
        setIsScheduling(true);
        try {
            const q = query(
                collection(db, 'creator_media'),
                where('creatorId', '==', user.uid),
                where('status', 'in', ['planned', 'scheduled'])
            );
            const snap = await getDocs(q);
            const batchPromises = snap.docs.map(d => 
                updateDoc(doc(db, 'creator_media', d.id), {
                    status: 'draft',
                    scheduledFor: null,
                    contentType: 'public'
                })
            );
            await Promise.all(batchPromises);
            toast({ title: "Takvim Temizlendi", description: "Bütün planlanmış içerikler taslak havuzuna geri gönderildi." });
            fetchScheduledItems();
            fetchContainerMedia();
        } catch (err) {
            console.error("Reset failed:", err);
            toast({ variant: "destructive", title: "İşlem Başarısız", description: "Takvim temizlenirken bir hata oluştu." });
        } finally {
            setIsScheduling(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-20 px-4 mt-6 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-8">
                <div className="flex items-center gap-6">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/creator/studio')} className="rounded-full bg-white/5 h-12 w-12 hover:bg-primary/20 transition-all">
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div className="flex items-center gap-5">
                        <div className="relative">
                            <AnimatePresence mode="wait">
                                {user?.savedCharacter?.referenceImageUrl ? (
                                    <motion.div 
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-primary/30 shadow-[0_0_20px_rgba(var(--primary),0.2)] bg-black"
                                    >
                                        <img src={user.savedCharacter.referenceImageUrl} className="w-full h-full object-cover" alt="AI Avatar" />
                                        <div className="absolute inset-0 bg-gradient-to-t from-primary/20 to-transparent pointer-events-none" />
                                    </motion.div>
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                                        <User className="text-muted-foreground w-8 h-8" />
                                    </div>
                                )}
                            </AnimatePresence>
                            {isActive && (
                                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-4 border-background flex items-center justify-center animate-pulse shadow-lg shadow-green-500/50">
                                    <div className="w-2 h-2 bg-white rounded-full" />
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-4xl font-headline font-black tracking-tighter uppercase italic">
                                    {user?.savedCharacter?.name || "Copilot Premium"} <span className="text-primary">Command</span>
                                </h1>
                                <Badge className="bg-primary/20 text-primary border-primary/20 font-black text-[10px] px-2">V2.0 ALPHA</Badge>
                            </div>
                            <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-[0.3em] flex items-center gap-2">
                                <Monitor size={12} className="text-primary" /> Autonomous Neural Network & Strategy Engine
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                     <div className="hidden md:block text-right">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-50">Local Protocol Time</p>
                        <p className="text-xs font-mono font-bold">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                     </div>
                     <div className="h-10 w-px bg-white/10 hidden md:block" />
                     <Button 
                        variant="outline" 
                        onClick={() => {
                            if (isAdmin) {
                                setShowSupport(true);
                            } else {
                                toast({ title: "Coming Soon", description: "Support Center will be available soon for all creators." });
                            }
                        }} 
                        className={cn(
                            "rounded-full border-white/10 px-6 gap-2 bg-white/5 transition-all",
                            !isAdmin ? "opacity-50 grayscale cursor-not-allowed" : "hover:bg-white/10"
                        )}
                     >
                        <Sparkles size={14} className={cn("text-primary", !isAdmin && "text-muted-foreground")} />
                        <span>{isAdmin ? "Support Center" : "Coming Soon"}</span>
                     </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Status & Intelligence */}
                <div className="lg:col-span-8 flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Status Card */}
                        <motion.div 
                            whileHover={{ y: -4 }}
                            className={cn(
                                "rounded-[2.5rem] p-8 border transition-all relative overflow-hidden flex flex-col justify-between min-h-[280px]",
                                isActive ? "bg-primary/5 border-primary/20 shadow-[0_20px_40px_rgba(var(--primary),0.1)]" : "bg-white/[0.02] border-white/5"
                            )}
                        >
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t('systemStatus')}</h3>
                                    {isActive ? (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 rounded-full border border-green-500/20">
                                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                                            <span className="text-[10px] font-black text-green-500 uppercase tracking-widest leading-none">{t('online')}</span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 rounded-full border border-red-500/20">
                                            <div className="w-2 h-2 bg-red-500 rounded-full" />
                                            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">{t('locked')}</span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="py-2">
                                    {isActive ? (
                                        <div className="space-y-3">
                                            <div className="flex items-end gap-2">
                                                <p className="text-6xl font-headline font-black tracking-tighter italic text-primary leading-none">{daysLeft}</p>
                                                <p className="text-xs font-bold uppercase tracking-widest text-primary/60 mb-1">{t('missionDays')}</p>
                                            </div>
                                            <CountdownTimer className="border-none p-0 bg-transparent shadow-none" onTimeUp={handleTriggerDraft} />
                                        </div>
                                    ) : (
                                        <div className="space-y-4 py-2">
                                            <p className="text-sm text-muted-foreground leading-relaxed">
                                                {t('activateDesc')}
                                            </p>
                                            <div className="flex items-center gap-2 text-primary font-bold text-[11px] uppercase tracking-widest">
                                                {isFirstTime ? t('offerFree') : t('costULC')}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {!isActive ? (
                                <Button onClick={handleActivate} disabled={loading} className="w-full h-14 rounded-2xl font-black uppercase text-sm tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] transition-transform">
                                    {loading ? <Loader2 className="animate-spin" /> : isFirstTime ? t('initializePilot') : t('initiateProtocol')}
                                </Button>
                            ) : (
                                <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground/60 border-t border-white/5 pt-4 uppercase tracking-tighter">
                                    <span>{t('neuralStable')}</span>
                                </div>
                            )}

                            {/* Learning Progress */}
                            {isActive && (
                                <div className="mt-6 space-y-3 pt-6 border-t border-white/5">
                                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                        <span>Neural Learning Process</span>
                                        <span className="text-primary">{Math.min(100, Math.floor((Date.now() - (user.aiCreatorModeActivatedAt || Date.now())) / (1000 * 60 * 60 * 24 * 30) * 100))}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                        <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, Math.floor((Date.now() - (user.aiCreatorModeActivatedAt || Date.now())) / (1000 * 60 * 60 * 24 * 30) * 100))}%` }}
                                            className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
                                        />
                                    </div>
                                    <div className="flex justify-between items-center">
                                       <p className="text-[9px] text-muted-foreground opacity-50 uppercase font-medium">Evolution sequence in progress...</p>
                                       <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={handleResetIntelligence}
                                            disabled={resetLoading}
                                            className="h-6 text-[8px] font-black text-red-500/60 hover:text-red-500 hover:bg-red-500/10 rounded-full"
                                        >
                                           {resetLoading ? <Loader2 size={8} className="animate-spin" /> : "RESET INTELLIGENCE"}
                                       </Button>
                                    </div>
                                </div>
                            )}
                        </motion.div>

                        {/* Last Drop Preview */}
                        <motion.div 
                            whileHover={{ y: -4 }}
                            className="rounded-[2.5rem] p-8 bg-white/[0.02] border border-white/5 flex flex-col gap-4 relative overflow-hidden min-h-[280px]"
                        >
                            <div className="flex items-center justify-between z-10">
                                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">{t('lastAiDrop')}</h3>
                                {isGenerating && (
                                    <span className="flex items-center gap-1 text-[8px] font-black text-primary uppercase animate-pulse">
                                        <Loader2 size={10} className="animate-spin" /> {t('generating')}
                                    </span>
                                )}
                            </div>

                            <div className="flex-1 flex items-center justify-center relative">
                                {lastDrop ? (
                                    <div className="relative group w-full h-full rounded-2xl overflow-hidden border border-white/10">
                                        <img src={lastDrop.mediaUrl} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Last Drop" />
                                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-[10px] text-white/60 font-bold uppercase truncate">{lastDrop.caption || "Autonomous Draft"}</p>
                                        </div>
                                        <Link href="/creator?tab=workshop" className="absolute inset-0 flex items-center justify-center bg-primary/20 opacity-0 group-hover:opacity-100 backdrop-blur-[2px] transition-all">
                                            <Button size="sm" className="rounded-full gap-2 px-4 shadow-2xl">
                                                {t('reviewDrop')} <ArrowRight size={14} />
                                            </Button>
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                                        <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center">
                                            <ImageIcon className="text-white w-6 h-6" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest leading-loose">
                                            {isActive ? t('standby') : t('lockedView')}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {lastDrop && (
                                <div className="text-center z-10">
                                    <p className="text-[10px] font-bold text-muted-foreground leading-snug">
                                        {t('goContainerDesc')}
                                    </p>
                                </div>
                            )}
                        </motion.div>
                    </div>

                    {/* Intelligence Section */}
                    <Card className="glass-card border-white/5 rounded-[3rem] p-4 bg-white/[0.01]">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <CardTitle className="text-2xl font-headline font-black italic uppercase italic tracking-tighter flex items-center gap-3">
                                        <Brain className="text-primary w-6 h-6" /> {t('strategicIntel')}
                                    </CardTitle>
                                    <CardDescription className="text-xs uppercase font-bold tracking-widest opacity-50">{t('intelDesc')}</CardDescription>
                                </div>
                                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                    <Zap className="text-primary w-5 h-5" />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!isActive ? (
                                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-xs gap-3 opacity-40 bg-black/20 rounded-[2rem] border border-dashed border-white/5">
                                    <Lock size={24} className="mb-2" />
                                    <p className="font-bold tracking-[0.2em] uppercase">Secure Channel Locked</p>
                                    <p className="text-[10px]">Access to neural intelligence requires an active mission status.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {suggestions.map((item, i) => (
                                        <motion.div 
                                            key={i} 
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="bg-white/5 p-6 rounded-[2rem] border border-white/5 hover:border-primary/40 hover:bg-white/[0.04] transition-all group flex flex-col h-full"
                                        >
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    {i === 0 ? <Target className="w-4 h-4 text-orange-400" /> : i === 1 ? <Sparkles className="w-4 h-4 text-primary" /> : <CheckCircle2 className="w-4 h-4 text-green-400" />}
                                                </div>
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em]">{item.title}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground leading-relaxed flex-1">{item.content}</p>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Configuration */}
                <div className="lg:col-span-4 flex flex-col gap-6">
                    <Card className="glass-card border-white/5 rounded-[2.5rem] bg-white/[0.02] shadow-2xl overflow-hidden flex flex-col h-full">
                         <div className="p-8 bg-gradient-to-br from-primary/10 via-transparent to-transparent border-b border-white/5">
                            <h2 className="text-2xl font-headline font-black italic uppercase tracking-tighter mb-1">{t('neuralCore')}</h2>
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">{t('zeroDayConfig')}</p>
                         </div>
                         <CardContent className="p-8 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('digitalIdentity')}</Label>
                                    <Input 
                                        value={config.personaName} 
                                        onChange={e => setConfig(p => ({ ...p, personaName: e.target.value }))}
                                        placeholder="e.g. Cyber Girl X"
                                        className="bg-black/40 border-white/5 rounded-2xl h-14 focus:border-primary/50 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('strategicNiche')}</Label>
                                    <Input 
                                        value={config.niche} 
                                        onChange={e => setConfig(p => ({ ...p, niche: e.target.value }))}
                                        placeholder="e.g. Luxury, Tech, Fitness"
                                        className="bg-black/40 border-white/5 rounded-2xl h-14 focus:border-primary/50 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('vocalSignature')}</Label>
                                    <Input 
                                        value={config.tone} 
                                        onChange={e => setConfig(p => ({ ...p, tone: e.target.value }))}
                                        placeholder="e.g. Bold, Mysterious, VIP"
                                        className="bg-black/40 border-white/5 rounded-2xl h-14 focus:border-primary/50 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('targetNetwork')}</Label>
                                    <Input 
                                        value={config.targetAudience} 
                                        onChange={e => setConfig(p => ({ ...p, targetAudience: e.target.value }))}
                                        placeholder="e.g. Gen-Z Techies"
                                        className="bg-black/40 border-white/5 rounded-2xl h-14 focus:border-primary/50 transition-all font-bold"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{t('coreObjective')}</Label>
                                    <Textarea 
                                        value={config.vibe} 
                                        onChange={e => setConfig(p => ({ ...p, vibe: e.target.value }))}
                                        placeholder="Hardcode the ultimate mission vibe..."
                                        className="bg-black/40 border-white/5 rounded-[2rem] min-h-[140px] focus:border-primary/50 transition-all resize-none leading-relaxed font-medium"
                                    />
                                </div>
                            </div>
                         </CardContent>
                         <div className="p-8 border-t border-white/5 bg-black/20">
                            <Button 
                                onClick={handleSaveConfig} 
                                disabled={loading || isSaved} 
                                className={cn(
                                    "w-full h-14 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl",
                                    isSaved ? "bg-green-500 text-white shadow-green-500/20" : "bg-white text-black hover:bg-white/90 active:scale-95 shadow-white/5"
                                )}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : (isSaved ? <span className="flex items-center gap-2"><Check size={20} /> SAVED</span> : t('writeToMemory'))}
                            </Button>
                         </div>
                    </Card>
                </div>
            </div>

            {/* 2-Week Calendar Grid */}
            <section className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-headline font-black italic uppercase tracking-tighter italic">2-Week <span className="text-primary">Premium Calendar</span></h2>
                        <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground">Strategic Content Deployment Grid</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button 
                            onClick={handleResetSchedule}
                            variant="ghost" 
                            size="icon"
                            className="rounded-full bg-white/5 h-10 w-10 hover:bg-red-500/20 hover:text-red-400 transition-all"
                            title="Planı Temizle"
                        >
                            <Zap size={16} />
                        </Button>
                        {containerCount >= 7 ? (
                            <Button 
                                onClick={handleAutoSchedule} 
                                disabled={isScheduling}
                                className="rounded-full bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 px-6 gap-2"
                            >
                                {isScheduling ? <Loader2 className="animate-spin" size={14} /> : <Calendar size={14} />}
                                Auto-Schedule 2 Weeks
                            </Button>
                        ) : (
                            <Badge variant="outline" className="opacity-40 border-dashed border-white/20 px-4 py-2">
                                Need {7 - containerCount} more items for Auto-Schedule
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-7 gap-4">
                    {Array.from({ length: 14 }).map((_, i) => {
                        const targetStart = calendarStartDate + (i * 24 * 60 * 60 * 1000);
                        const targetEnd = targetStart + (24 * 60 * 60 * 1000);
                        
                        const dayMedia = scheduledItems.filter(item => 
                            item.scheduledFor && item.scheduledFor >= targetStart && item.scheduledFor < targetEnd
                        );
                        const isDayScheduled = dayMedia.some(m => m.status === 'scheduled');
                        const isDayPlanned = dayMedia.some(m => m.status === 'planned');
                        const hasContent = dayMedia.length > 0;

                        return (
                            <motion.div 
                                key={i} 
                                whileHover={{ scale: 1.02, y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    setSelectedDay(i);
                                    setIsPlannerOpen(true);
                                }}
                                className={cn(
                                    "aspect-square rounded-[2rem] p-5 border flex flex-col items-center justify-center gap-3 transition-all relative group cursor-pointer",
                                    isDayScheduled ? "bg-primary/10 border-primary/40 shadow-xl shadow-primary/5" : 
                                    isDayPlanned ? "bg-white/[0.04] border-dashed border-white/20 shadow-lg" :
                                    "bg-white/[0.02] border-white/5 hover:border-white/20"
                                )}
                            >
                                <div className="flex flex-col items-center gap-0.5">
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-[0.2em] transition-opacity",
                                        isDayScheduled ? "text-primary" : isDayPlanned ? "text-primary/60" : "text-muted-foreground opacity-30"
                                    )}>DAY {i + 1}</span>
                                    <span className="text-[7px] font-bold text-muted-foreground/40 uppercase tracking-widest leading-none">
                                        {new Intl.DateTimeFormat('tr-TR', { 
                                            day: 'numeric', 
                                            month: 'short' 
                                        }).format(new Date(calendarStartDate + (i * 24 * 60 * 60 * 1000)))}
                                    </span>
                                </div>
                                                         {hasContent ? (
                                    <div className="relative group/thumb w-full h-full flex flex-col items-center justify-center gap-2">
                                         <div className={cn(
                                             "w-10 h-10 rounded-2xl overflow-hidden border bg-primary/20",
                                             isDayScheduled ? "border-primary/40" : "border-white/10 opacity-70"
                                         )}>
                                            {dayMedia[0].mediaUrl ? (
                                                <img src={dayMedia[0].mediaUrl} className="w-full h-full object-cover" alt="Planned" />
                                            ) : (
                                                <CheckCircle2 size={16} className="text-primary m-auto mt-3" />
                                            )}
                                         </div>
                                         {isDayPlanned && !isDayScheduled && (
                                             <span className="text-[7px] font-bold text-primary/60 uppercase tracking-tighter">DRAFT PLAN</span>
                                         )}
                                         {dayMedia.length > 1 && (
                                             <Badge variant="secondary" className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center p-0 rounded-full text-[8px] bg-primary text-white border-primary shadow-lg">+{dayMedia.length - 1}</Badge>
                                         )}
                                    </div>
                                ) : (
                                    <div className="w-10 h-10 rounded-2xl border border-dashed border-white/10 flex items-center justify-center opacity-20 group-hover:opacity-100 group-hover:border-primary/50 transition-all">
                                        <Clock size={16} className="text-muted-foreground group-hover:text-primary" />
                                    </div>
                                )}

                                <div className={cn(
                                    "absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] pointer-events-none"
                                )} />
                            </motion.div>
                        );
                    })}
                </div>
                
                {containerCount < 7 && (
                    <p className="text-center text-[10px] font-bold text-muted-foreground border border-dashed border-white/10 rounded-2xl py-8 uppercase tracking-widest">
                        Sana içerik takvimi oluşturmam için konteynere en az 7 içerik bırak
                    </p>
                )}
            </section>

            {/* Bottom Alert */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-primary/5 border border-primary/20 rounded-[2.5rem] p-8 flex items-start gap-6 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                     <AlertCircle size={100} className="text-primary" />
                </div>
                <div className="w-14 h-14 rounded-[1.5rem] bg-primary/20 flex items-center justify-center shrink-0">
                    <AlertCircle className="text-primary w-7 h-7" />
                </div>
                <div className="space-y-2 relative z-10">
                    <p className="text-lg font-headline font-black italic uppercase tracking-tighter text-primary">{t('securityFeeProtocol')}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                        {t('protocolDesc')}
                    </p>
                </div>
            </motion.div>


            <StrategicPlannerModal 
                dayIndex={selectedDay ?? 0}
                initialDate={calendarStartDate}
                userId={user?.uid || ''}
                isOpen={isPlannerOpen}
                onClose={() => setIsPlannerOpen(false)}
                onPlanned={() => {
                    fetchScheduledItems();
                    fetchContainerMedia();
                }}
            />

            <AnimatePresence>
                {showSupport && (
                    <SupportChatAi onClose={() => setShowSupport(false)} />
                )}
            </AnimatePresence>
        </div>
    );
}

// Helper icons specifically for this page design
function ImageIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
            <circle cx="9" cy="9" r="2" />
            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
        </svg>
    );
}
