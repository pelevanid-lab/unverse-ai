"use client"

import { useWallet } from '@/hooks/use-wallet';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { processUniqTwinUnlock } from '@/lib/ledger';
import { doc, onSnapshot, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
    Sparkles, Camera, Wand2, Brain, Calendar, Target,
    Lock, Loader2, CheckCircle2, ArrowRight, Zap,
    Star, Shield, ChevronRight, Image as ImageIcon, Play, RefreshCcw, Info, Check
} from 'lucide-react';
import { updateDoc } from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────────────────
// Types

interface UniqData {
    unlocked?: boolean;
    unlocked_at?: number;
    twin_path?: 'photos' | 'imaginary' | null;
    twin_status?: 'none' | 'learning' | 'training' | 'ready';
    neural_progress?: number;
    neural_selected_photos?: string[];
    lora_url?: string;
    character_reset_count?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature cards data
const FEATURES = [
    {
        icon: Brain,
        color: 'text-violet-400',
        bg: 'bg-violet-500/10',
        border: 'border-violet-500/20',
        titleKey: 'feat1Title',
        descKey: 'feat1Desc',
        free: true,
    },
    {
        icon: Calendar,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        titleKey: 'feat2Title',
        descKey: 'feat2Desc',
        free: true,
    },
    {
        icon: Camera,
        color: 'text-primary',
        bg: 'bg-primary/10',
        border: 'border-primary/20',
        titleKey: 'feat3Title',
        descKey: 'feat3Desc',
        free: false,
        cost: '500 ULC',
    },
    {
        icon: Wand2,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        titleKey: 'feat4Title',
        descKey: 'feat4Desc',
        free: false,
        cost: 'Included',
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock showcase items (gradient placeholders)
const SHOWCASE = [
    { gradient: 'from-rose-900 via-pink-900 to-purple-900', label: 'Portrait', tag: 'Studio Light', image: 'https://storage.googleapis.com/studio-1417373480-b2959.firebasestorage.app/creator-media/0x3b5037baca1bae82b7f522c816176d46b98e53a3/stateful_1774632540111.png?GoogleAccessId=firebase-adminsdk-fbsvc%40studio-1417373480-b2959.iam.gserviceaccount.com&Expires=1775237342&Signature=24RBDWg70G0HSVnkAVa2sEswEBwvIkLqQ9DqeTWVbLvi7sA%2BeHM%2F6dGeLTyqNP9%2B%2BGoJs4vqjcqRL%2FiMtAU%2FDJbnKQRRVhhn9PBdT%2Fl%2FucgtvKFkdRBylX9ylN%2BaRavA%2B9K%2Ba%2FVgR%2BiEv6H7qtHzNxw56cdcbl8sBiYgmmJB1tU6KwL7hIhCSvYYJYe54fdY0IH6GxMRJtaBml4yinlPG7%2BwyM6PI15ilTQJuEcvlUfcz9v6ZEkwau1C8EU%2B0t1FVcXENMoV5wOJR94K%2FMAC0JRdP3GL5TSIn36stzxV%2BbTscQm02zZVE60ZhK%2FhFrN%2Br7yW0QfIowYTX11NPP0H6w%3D%3D' },
    { gradient: 'from-blue-900 via-indigo-900 to-violet-900', label: 'Cinematic', tag: 'Wide Shot', image: 'https://storage.googleapis.com/studio-1417373480-b2959.firebasestorage.app/creator-media/0x3b5037baca1bae82b7f522c816176d46b98e53a3/ai_twin_1774522079495_rix21.png?GoogleAccessId=firebase-adminsdk-fbsvc%40studio-1417373480-b2959.iam.gserviceaccount.com&Expires=1775126879&Signature=cTdxo5QABaFU%2BQ6ZeDisBBZ4PFeXsGh%2ByLQONvO8hcZV%2FCs3q%2FvaUv9t0byQInQ%2F%2BjXI6Cks6vn%2FeEB41hQRPzi9yEfbS60rsijmQ1Dac6Reff7luzuvzV06eIVIPcjT3ji20ULTx%2FMnfWamBW2jFdVQjV%2F4J2FxGn6SYJIjs%2F%2BGXLEX3L01bk8%2FUy63nFV%2BTlMvShtjjNhNYnL82103qRFAmVV26yUm3PFeXpqXJYhXlVsitqHToN%2F55JtWU8p261Pb%2Fg3oc4E9hlIy8DDJFZz54gPpJL6Kegc7OlhJNHo3tELitARAicXdffWpSpXO8sfz8OM4JVTSN53b3xLoyg%3D%3D' },
    { gradient: 'from-amber-900 via-orange-900 to-rose-900', label: 'Golden Hour', tag: 'Outdoor', image: 'https://storage.googleapis.com/studio-1417373480-b2959.firebasestorage.app/creator-media/0x3b5037baca1bae82b7f522c816176d46b98e53a3/ai_twin_1774550376470_3b8b5g.png?GoogleAccessId=firebase-adminsdk-fbsvc%40studio-1417373480-b2959.iam.gserviceaccount.com&Expires=1775155178&Signature=gP0DRsb7vEgXqmqucAxUFMcyz6x5ugKLq%2BaRNnR8mPwzkTQQdB3gShDGOuydmr4mOtz8EROvmqq%2FikB1gYSs3F4rAfq%2FNLhxxzo%2F4GQetn9Ywt4eA8oItaLdcZb9R9ZYXzSyCMnyMDqCZVGKnZezI3s9Mqqzs%2FTahmrx0qTP0cGHTpTEuuzXpUsSulAXZULEHPO2E2z6n8cfD8Cbv8SyhHK5xWGGPAKcFRhu8TZFhM7M0Hw%2FG8rZPrYJs8rLTlQGOQyfNUtCTJJ0IXLhrYDbFhAH%2BuvjOteGVg2Ebv3be6%2FvLwVGfOAPjStIpMmw2jt3OaLawCrh%2FvR6AhpuU2pDkQ%3D%3D' },
    { gradient: 'from-emerald-900 via-teal-900 to-cyan-900', label: 'Editorial', tag: 'Lifestyle', image: 'https://storage.googleapis.com/studio-1417373480-b2959.firebasestorage.app/creator-media/0xccc33b97afdc28a230976942ee4060972f95018d/ai_twin_1774526192985_fvmkyr.png?GoogleAccessId=firebase-adminsdk-fbsvc%40studio-1417373480-b2959.iam.gserviceaccount.com&Expires=1775130995&Signature=NK8Say8pLmcdmKQJzT0nYmTqDbkj8cJJAiIV0OMooeeWSF6vZjrGL2n1xd8uuGqxUN%2BiNni%2BUaFIGRd74LNx6n2GfwafaqvFUeSY%2Fv4svDz6ghdMyqoHc0ruMUdc9lIaH8PyuWWmLGTAxKPWQWqPJ1y1QR%2FqXYl3deMraWwgB2qlWhlyUfHpQe09%2B27gLcF7%2FfOi5X5SK1mFhove5Q4J%2FC0CaTjvcL6P37Z8S%2BWJHFR4uDsp723rqTM6Uf0Nv3d%2By4JcQ0tetJCpDjZOgvSttbBCniIG8HtkZG0RkeNybeCO0YGBd6CFGJq339iZOMtPVrTPD0%2FrV2xlRemz7wW6Ig%3D%3D' },
    { gradient: 'from-slate-900 via-gray-900 to-zinc-900', label: 'Fashion', tag: 'Minimal', image: 'https://storage.googleapis.com/studio-1417373480-b2959.firebasestorage.app/creator-media/0xccc33b97afdc28a230976942ee4060972f95018d/ai_twin_1774526136131_tidabl.png?GoogleAccessId=firebase-adminsdk-fbsvc%40studio-1417373480-b2959.iam.gserviceaccount.com&Expires=1775130938&Signature=3Q9JDOgFnnMyvh792Tm8waXB0toC5YPRsXUzihKj1VC0RBsOsy1%2FZyF1aTgQO83CQjLPU8PVMUU8WAg4tYct6Snm%2BqU8S4DNQ8Dz2I2XSSauqDXTMfOFOyIQidc7lJt5%2FHdr%2FXlYnNVFwJINGZFBDDk9B52QBc5OcfudwNZj6q5xG176Uo3ffZJShLUBJ0DIs%2BUyGp9zkzofuYQrxRmsQHAlP4%2FHJ16wf1Oy0O1sVpr8qIsHC9muYn3uUnp5Si7snZZM8871LdTUVs6N5tNHjCqMfaxvexHjrVBUXPGnsQX44GPKt3I3JrQv44LUwhsyVlnVk3205%2Fj6XQSCg5YXfg%3D%3D' },
    { gradient: 'from-purple-900 via-violet-900 to-indigo-900', label: 'Mystique', tag: 'Close-Up', image: 'https://firebasestorage.googleapis.com/v0/b/studio-1417373480-b2959.firebasestorage.app/o/creator-media%2F0xccc33b97afdc28a230976942ee4060972f95018d%2Fai_twin_1774464870462_u7w2zb.png?alt=media&token=d76c7b54-0866-4fd1-b0ef-46aac881113b' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main Page Component

export default function UniqPage() {
    const t = useTranslations('Uniq');
    const { user, loading: walletLoading } = useWallet();
    const { toast } = useToast();
    const router = useRouter();
    const locale = useLocale();

    const [uniqData, setUniqData] = useState<UniqData | null>(null);
    const [unlocking, setUnlocking] = useState<'photos' | 'imaginary' | null>(null);
    const [dataLoading, setDataLoading] = useState(true);

    // ── Subscribe to live uniq status from Firestore ──
    useEffect(() => {
        if (!user?.uid) {
            setDataLoading(false);
            return;
        }
        const userRef = doc(db, 'users', user.uid);
        const unsub = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setUniqData(data.uniq || null);
            }
            setDataLoading(false);
        });
        return () => unsub();
    }, [user?.uid]);

    useEffect(() => {
        if (uniqData?.twin_status === 'ready' && uniqData?.unlocked) {
            router.push(`/${locale}/creator/muse`);
        }
    }, [uniqData, locale, router]);

    // ── Unlock handler ──
    const handleUnlock = async (path: 'photos' | 'imaginary') => {
        if (!user) {
            toast({ variant: 'destructive', title: t('connectWallet'), description: t('connectWalletToast') });
            return;
        }

        const cost = path === 'photos' ? 500 : 700;
        const balance = user.ulcBalance?.available ?? 0;

        if (balance < cost) {
            toast({
                variant: 'destructive',
                title: t('insufficientULCToast', { cost }),
                description: t('balance', { amount: balance.toFixed(0) })
            });
            return;
        }

        setUnlocking(path);
        try {
            await processUniqTwinUnlock(user.uid, path);
            toast({
                title: t('unlockSuccessToast'),
                description: t('twinReady')
            });
            
            // Short delay before redirect to show success toast
            setTimeout(() => {
                router.push(`/${locale}/creator/muse`);
            }, 1000);
        } catch (e: any) {
            toast({ variant: 'destructive', title: t('unlockFailedToast'), description: e.message });
        } finally {
            setUnlocking(null);
        }
    };

    if (dataLoading || walletLoading) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (uniqData?.unlocked) {
        return (
            <UniqDashboard 
                user={user} 
                uniqData={uniqData} 
                locale={locale} 
                router={router} 
                onReset={async () => {
                    if (!confirm(t('resetConfirm'))) return;
                    try {
                        const userRef = doc(db, 'users', user!.uid);
                        await updateDoc(userRef, { 
                            savedCharacter: null,
                            uniq: {
                                ...uniqData,
                                unlocked: false, // User must pay again for new path
                                twin_status: 'none',
                                twin_path: null,
                                neural_progress: 0,
                                lora_url: null,
                                character_reset_count: (uniqData.character_reset_count || 0) + 1
                            }
                        });
                        toast({ title: t('resetCharacter'), description: t('onboardingSubtitle') });
                    } catch (e) {
                        toast({ variant: 'destructive', title: t('errorTitle'), description: e instanceof Error ? e.message : 'Reset failed' });
                    }
                }} 
            />
        );
    }

    return (
        <div className="min-h-screen bg-background selection:bg-primary selection:text-black">
            {/* Hero Section */}
            <section className="relative pt-32 pb-20 px-4 overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full pointer-events-none">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3" />
                    <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-violet-500/5 rounded-full blur-[120px] -translate-y-1/3 -translate-x-1/3" />
                </div>

                <div className="relative z-10 max-w-5xl mx-auto text-center space-y-8">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-center"
                    >
                        <Badge variant="outline" className="px-4 py-1.5 rounded-full border-primary/20 bg-primary/5 text-primary text-[10px] uppercase font-black tracking-widest">
                            {t('badge1')}
                        </Badge>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-8xl font-headline font-black italic uppercase tracking-tighter leading-[0.8] mb-4"
                    >
                        {t('title1')}
                        <br />
                        <span className="text-primary">{t('titleHighlight')}</span>{' '}
                        <span className="text-muted-foreground/40">{t('titleSuffix')}</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
                    >
                        {t('desc1')}
                    </motion.p>

                    {/* CTA Buttons */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="flex flex-col sm:flex-row gap-4 justify-center"
                    >
                        <Button
                            size="lg"
                            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-sm gap-3 shadow-2xl shadow-primary/20 hover:scale-[1.02] transition-transform"
                            onClick={() => {
                                const el = document.getElementById('unlock-section');
                                el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            <Camera size={18} />
                            {t('btnCreate')}
                        </Button>
                        <Button
                            variant="outline"
                            size="lg"
                            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-sm gap-3 border-white/10 hover:bg-white/5"
                            onClick={() => {
                                const el = document.getElementById('features-section');
                                el?.scrollIntoView({ behavior: 'smooth' });
                            }}
                        >
                            <Play size={16} />
                            {t('btnSeeHow')}
                        </Button>
                    </motion.div>
                </div>

                {/* Showcase grid */}
                <motion.div
                    initial={{ opacity: 0, y: 60 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="relative z-10 mt-20 w-full max-w-5xl mx-auto"
                >
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                        {SHOWCASE.map((item, i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.5 + i * 0.07 }}
                                whileHover={{ scale: 1.05, y: -4 }}
                                className={cn(
                                    "aspect-[3/4] rounded-[1.5rem] bg-gradient-to-br overflow-hidden relative border border-white/5",
                                    !item.image && item.gradient
                                )}
                                style={item.image ? { 
                                    backgroundImage: `url(${item.image})`, 
                                    backgroundSize: 'cover', 
                                    backgroundPosition: 'center' 
                                } : {}}
                            >
                                {/* Shimmer effect */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/80">{item.label}</p>
                                    <p className="text-[8px] text-white/40 uppercase">{item.tag}</p>
                                </div>
                                {/* Lock overlay */}
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="w-8 h-8 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
                                        <Lock size={12} className="text-white/40" />
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                    <p className="text-center text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-4">
                        {t('poweredBy')}
                    </p>
                </motion.div>
            </section>

            {/* ── Features Section ── */}
            <section id="features-section" className="px-4 py-24 max-w-5xl mx-auto">
                <div className="text-center mb-16 space-y-4">
                    <Badge className="bg-white/5 border-white/10 text-muted-foreground uppercase tracking-widest text-xs">
                        {t('whatsIncluded')}
                    </Badge>
                    <h2 className="text-3xl md:text-5xl font-headline font-black italic uppercase tracking-tighter">
                        {t('everythingYouNeed')} <span className="text-primary">{t('need')}</span>
                    </h2>
                    <p className="text-muted-foreground max-w-xl mx-auto">
                        {t('featuresDesc')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {FEATURES.map((f, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className={cn(
                                "rounded-[2.5rem] p-8 border flex flex-col gap-4 transition-all hover:scale-[1.01]",
                                f.free
                                    ? "bg-white/[0.02] border-white/5 hover:border-white/10"
                                    : `${f.bg} ${f.border} shadow-lg`
                            )}
                        >
                            <div className="flex items-start justify-between">
                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", f.bg)}>
                                    <f.icon className={cn("w-6 h-6", f.color)} />
                                </div>
                                {f.free ? (
                                    <Badge className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase">
                                        Free
                                    </Badge>
                                ) : (
                                    <Badge className={cn("font-black text-[10px] uppercase", f.bg, `border ${f.border}`, f.color)}>
                                        {f.cost}
                                    </Badge>
                                )}
                            </div>
                            <div>
                                <h3 className="text-lg font-headline font-black uppercase tracking-tight mb-1">{t(f.titleKey)}</h3>
                                <p className="text-sm text-muted-foreground leading-relaxed">{t(f.descKey)}</p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── How It Works ── */}
            <section className="px-4 py-24 max-w-5xl mx-auto">
                <div className="text-center mb-16 space-y-4">
                    <Badge className="bg-white/5 border-white/10 text-muted-foreground uppercase tracking-widest text-xs">
                        {t('theProcess')}
                    </Badge>
                    <h2 className="text-3xl md:text-5xl font-headline font-black italic uppercase tracking-tighter">
                        {t('howUniqWorks')} <span className="text-primary">{t('works')}</span>
                    </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
                    {[
                        { step: '01', icon: Shield, titleKey: 'step1Title',
            descKey: 'step1Desc', color: 'text-primary bg-primary/10 border-primary/20' },
                        { step: '02', icon: Camera, titleKey: 'step2Title',
            descKey: 'step2Desc', color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
                        { step: '03', icon: Zap, titleKey: 'step3Title',
            descKey: 'step3Desc', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
                        { step: '04', icon: Star, titleKey: 'step4Title',
            descKey: 'step4Desc', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    ].map((s, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: i * 0.1 }}
                            className="relative flex flex-col items-center text-center gap-4"
                        >
                            <div className={cn("w-16 h-16 rounded-3xl border flex items-center justify-center shadow-lg", s.color)}>
                                <s.icon className="w-7 h-7" />
                            </div>
                            <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-black border border-white/10 flex items-center justify-center">
                                <span className="text-[8px] font-black text-muted-foreground">{s.step}</span>
                            </div>
                            <h3 className="font-headline font-black uppercase tracking-tight text-lg">{t(s.titleKey)}</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">{t(s.descKey)}</p>

                            {i < 3 && (
                                <ChevronRight className="hidden md:block absolute -right-3 top-8 w-6 h-6 text-muted-foreground/20" />
                            )}
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ── Unlock Section ── */}
            <section id="unlock-section" className="px-4 py-24 max-w-5xl mx-auto">
                <div className="text-center mb-16 space-y-4">
                    <Badge className="bg-primary/10 border-primary/30 text-primary uppercase tracking-widest text-xs font-black">
                        {t('oneTimeUnlock')}
                    </Badge>
                    <h2 className="text-3xl md:text-5xl font-headline font-black italic uppercase tracking-tighter">
                        {t('chooseYourPath')} <span className="text-primary">{t('pathTitle')}</span>
                    </h2>
                    <p className="text-muted-foreground max-w-xl mx-auto">
                        {t('pathDesc')}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Photos Path */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="rounded-[2.5rem] border border-primary/20 bg-primary/5 p-8 flex flex-col gap-6 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                        <div className="relative z-10 space-y-2">
                            <div className="w-14 h-14 rounded-3xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                                <Camera className="w-7 h-7 text-primary" />
                            </div>
                            <Badge className="bg-primary/10 border-primary/20 text-primary text-[10px] font-black uppercase mt-2">
                                Real Identity
                            </Badge>
                        </div>

                        <div className="relative z-10 space-y-3 flex-1">
                            <h3 className="text-2xl font-headline font-black uppercase italic tracking-tighter">
                                My Real Photos
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {t('photosPathDesc')}
                            </p>

                            <ul className="space-y-2 pt-2">
                                {[t('photosBullet1'), t('photosBullet2'), t('photosBullet3'), t('photosBullet4')].map((item, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CheckCircle2 size={14} className="text-primary shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="relative z-10 pt-4 border-t border-primary/10">
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-4xl font-headline font-black text-primary">500</span>
                                <span className="text-lg font-bold text-muted-foreground mb-1">ULC</span>
                                <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wide mb-1">{t('oneTime')}</span>
                            </div>

                            {!user ? (
                                <Button className="w-full h-14 rounded-2xl font-black uppercase tracking-widest gap-2" disabled>
                                    <Lock size={16} />
                                    Connect Wallet to Unlock
                                </Button>
                            ) : (
                                <Button
                                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest gap-2 shadow-xl shadow-primary/20"
                                    onClick={() => handleUnlock('photos')}
                                    disabled={!!unlocking}
                                >
                                    {unlocking === 'photos' ? (
                                        <><Loader2 size={16} className="animate-spin" /> {t('processing')}</>
                                    ) : (
                                        <><Camera size={16} /> {t('unlockWithPhotos')}</>
                                    )}
                                </Button>
                            )}
                            <p className="text-center text-[10px] text-muted-foreground/40 mt-2 font-bold uppercase tracking-wider">
                                {t('balance', { amount: (user?.ulcBalance?.available ?? 0).toFixed(0) })}
                            </p>
                        </div>
                    </motion.div>

                    {/* Imaginary Path */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        className="rounded-[2.5rem] border border-amber-500/20 bg-amber-500/5 p-8 flex flex-col gap-6 relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />

                        <div className="relative z-10 space-y-2">
                            <div className="w-14 h-14 rounded-3xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                                <Wand2 className="w-7 h-7 text-amber-400" />
                            </div>
                            <Badge className="bg-amber-500/10 border-amber-500/20 text-amber-400 text-[10px] font-black uppercase mt-2">
                                Imaginary Character
                            </Badge>
                        </div>

                        <div className="relative z-10 space-y-3 flex-1">
                            <h3 className="text-2xl font-headline font-black uppercase italic tracking-tighter">
                                My Dream Character
                            </h3>
                            <p className="text-muted-foreground text-sm leading-relaxed">
                                {t('imaginaryPathDesc')}
                            </p>

                            <ul className="space-y-2 pt-2">
                                {[t('imaginaryBullet1'), t('imaginaryBullet2'), t('imaginaryBullet3'), t('imaginaryBullet4')].map((item, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <CheckCircle2 size={14} className="text-amber-400 shrink-0" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="relative z-10 pt-4 border-t border-amber-500/10">
                            <div className="flex items-end gap-2 mb-4">
                                <span className="text-4xl font-headline font-black text-amber-400">700</span>
                                <span className="text-lg font-bold text-muted-foreground mb-1">ULC</span>
                                <span className="text-xs font-bold text-muted-foreground/40 uppercase tracking-wide mb-1">{t('oneTime')}</span>
                            </div>

                            {!user ? (
                                <Button variant="outline" className="w-full h-14 rounded-2xl font-black uppercase tracking-widest gap-2 border-amber-500/20 text-amber-400" disabled>
                                    <Lock size={16} />
                                    Connect Wallet to Unlock
                                </Button>
                            ) : (
                                <Button
                                    variant="outline"
                                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest gap-2 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                                    onClick={() => handleUnlock('imaginary')}
                                    disabled={!!unlocking}
                                >
                                    {unlocking === 'imaginary' ? (
                                        <><Loader2 size={16} className="animate-spin" /> {t('processing')}</>
                                    ) : (
                                        <><Wand2 size={16} /> {t('unlockDream')}</>
                                    )}
                                </Button>
                            )}
                            <p className="text-center text-[10px] text-muted-foreground/40 mt-2 font-bold uppercase tracking-wider">
                                {t('balance', { amount: (user?.ulcBalance?.available ?? 0).toFixed(0) })}
                            </p>
                        </div>
                    </motion.div>
                </div>

                {/* Fine print */}
                <p className="text-center text-xs text-muted-foreground/40 mt-8 max-w-lg mx-auto leading-relaxed">
                    {t('finePrint')}
                </p>
            </section>

        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard: shown when user IS unlocked

function UniqDashboard({
    user,
    uniqData,
    locale,
    router,
    onReset
}: {
    user: any;
    uniqData: UniqData;
    locale: string;
    router: any;
    onReset: () => Promise<void>;
}) {
    const t = useTranslations('Uniq');
    const { toast } = useToast();
    const [galleryLoading, setGalleryLoading] = useState(true);
    const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
    const [audit, setAudit] = useState({
        total: 0,
        closeups: 0,
        body: 0,
        variety: 0,
        ready: false,
        tip: ''
    });

    const twinStatus = uniqData.twin_status ?? 'learning';
    const progress = uniqData.neural_progress ?? 0;
    const isReady = twinStatus === 'ready';

    useEffect(() => {
        if (!user?.uid || isReady || twinStatus === 'training' || uniqData.twin_path !== 'photos') {
            setGalleryLoading(false);
            return;
        }

        const fetchGallery = async () => {
            setGalleryLoading(true);
            try {
                const mediaRef = collection(db, 'creator_media');
                const q = query(
                    mediaRef,
                    where('creatorId', '==', user.uid),
                    where('mediaType', '==', 'image'),
                    orderBy('createdAt', 'desc'),
                    limit(50)
                );
                const snap = await getDocs(q);
                const photos = snap.docs.map(d => d.data());
                setGalleryPhotos(photos);

                // 🧠 INTELLIGENT AUDIT (Phase 2)
                // Real uploaded photos have no prompt/aiPrompt — treat them as valid portraits
                const isRealPhoto = (p: any) => !p.prompt && !p.aiPrompt;
                const hasKeyword = (p: any, ...words: string[]) =>
                    words.some(w =>
                        p.prompt?.toLowerCase().includes(w) ||
                        p.aiPrompt?.toLowerCase().includes(w) ||
                        p.caption?.toLowerCase().includes(w)
                    );

                // Close-ups: real photos implicitly count, AI photos need face/portrait keywords
                const closeups = photos.filter(p =>
                    isRealPhoto(p) || hasKeyword(p, 'face', 'portrait', 'close up', 'closeup', 'headshot', 'selfie')
                ).length;

                // Full body: real photos count, AI photos need body/standing keywords
                const body = photos.filter(p =>
                    isRealPhoto(p) || hasKeyword(p, 'body', 'standing', 'walking', 'full body', 'full-body', 'outfit')
                ).length;

                // Variety: unique upload days for real photos + unique prompts for AI photos
                const realPhotoDays = new Set(
                    photos.filter(isRealPhoto).map(p =>
                        p.createdAt ? new Date(p.createdAt).toDateString() : 'unknown'
                    )
                ).size;
                const uniquePrompts = new Set(photos.filter(p => !isRealPhoto(p)).map(p => p.prompt?.substring(0, 20))).size;
                const variety = Math.min(10, realPhotoDays + uniquePrompts);

                const isTotalReady = photos.length >= 15;
                const isCloseupsReady = closeups >= 5;
                const isBodyReady = body >= 3;
                const isVarietyReady = variety >= 3;

                const ready = isTotalReady && isCloseupsReady && isBodyReady;

                let tip = '';
                if (photos.length === 0) tip = t('auditTipEmpty');
                else if (photos.length < 15) tip = t('auditPhotosNeeded');
                else if (!isCloseupsReady) tip = t('auditTipCloseups');
                else if (!isBodyReady) tip = t('auditTipFullBody');
                else if (!isVarietyReady) tip = t('auditTipVariety');
                else tip = t('auditStatusReady');

                setAudit({ total: photos.length, closeups, body, variety, ready, tip });
            } catch (e) {
                console.error("Gallery scan failed:", e);
            } finally {
                setGalleryLoading(false);
            }
        };

        fetchGallery();
    }, [user?.uid, isReady, twinStatus, uniqData.twin_path]);

    // 🚀 AUTO-TRIGGER: If ready and not yet training, start automatically
    useEffect(() => {
        if (audit.ready && twinStatus === 'learning' && !galleryLoading && galleryPhotos.length >= 15) {
            handleStartTraining();
        }
    }, [audit.ready, twinStatus, galleryLoading]);

    const handleStartTraining = async () => {
        if (!user?.uid || galleryPhotos.length < 15) return;
        
        try {
            const res = await fetch('/api/ai/neural-training', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: user.uid, 
                    type: 'photos', 
                    imageUrls: galleryPhotos.slice(0, 20).map(p => p.mediaUrl) // Top 20 for quality
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to start training');
            }

            toast({ title: t('auditStatusReady'), description: t('onboardingSubtitle') });
            // Status will update via Firestore listener in parent
        } catch (e: any) {
            toast({ variant: 'destructive', title: t('errorTitle'), description: e.message });
        }
    };

    return (
        <div className="min-h-screen bg-background px-4 py-12 max-w-5xl mx-auto space-y-10">

            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-headline font-black italic uppercase tracking-tighter">
                            Uniq <span className="text-primary">Dashboard</span>
                        </h1>
                        <p className="text-xs font-bold text-muted-foreground/50 uppercase tracking-widest">
                            {t('digitalTwinEngine', { type: uniqData.twin_path === 'photos' ? t('realIdentity') : t('imaginaryCharacter') })}
                        </p>
                    </div>
                </div>

                <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl font-bold border-white/10 text-muted-foreground/40 hover:bg-white/5 hover:text-white"
                    onClick={onReset}
                >
                    <RefreshCcw className="w-4 h-4 mr-2" /> {t('resetCharacter')}
                </Button>
            </motion.div>

            {/* Status Card */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className={cn(
                    "rounded-[2.5rem] p-8 border relative overflow-hidden",
                    isReady
                        ? "bg-emerald-500/5 border-emerald-500/20"
                        : "bg-primary/5 border-primary/20"
                )}
            >
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                    <div className="space-y-4 flex-1">
                        <div className="flex items-center gap-3">
                            {isReady ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                            ) : (
                                <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            )}
                            <span className={cn(
                                "text-sm font-black uppercase tracking-widest",
                                isReady ? "text-emerald-400" : "text-primary"
                            )}>
                                {isReady ? t('twinReady') : twinStatus === 'training' ? t('loraTraining') : t('neuralLearningActive')}
                            </span>
                        </div>

                        {!isReady && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    <span>{t('neuralLearningProgress')}</span>
                                    <span className="text-primary">{progress}%</span>
                                </div>
                                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: `${Math.max(5, progress)}%` }}
                                        transition={{ duration: 1, ease: 'easeOut' }}
                                        className="h-full bg-gradient-to-r from-primary to-primary/60 shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                                    />
                                </div>
                                <p className="text-[10px] text-muted-foreground/40 uppercase font-bold tracking-widest">
                                    {twinStatus === 'learning'
                                        ? (uniqData.twin_path === 'photos' ? t('trainingWaitPhotos') : t('trainingWaitImaginary'))
                                        : t('loraModelTraining')}
                                </p>
                            </div>
                        )}
                    </div>

                    {isReady ? (
                        <Button
                            size="lg"
                            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest gap-2 bg-emerald-500 hover:bg-emerald-600 text-black shadow-xl shadow-emerald-500/20"
                            onClick={() => router.push(`/${locale}/creator/muse`)}
                        >
                            <Sparkles size={16} />
                            {t('openUniqMuse')}
                            <ArrowRight size={16} />
                        </Button>
                    ) : galleryLoading ? (
                        <Button disabled size="lg" className="h-14 px-8 rounded-2xl gap-2">
                            <Loader2 className="animate-spin" /> {t('auditStatusScanning')}
                        </Button>
                    ) : uniqData.twin_path === 'photos' && twinStatus === 'learning' ? (
                        <Button
                            size="lg"
                            className={cn(
                                "h-14 px-8 rounded-2xl font-black uppercase tracking-widest gap-2 bg-primary hover:bg-primary/90 text-black shadow-xl shadow-primary/20",
                                !audit.ready && "opacity-50 grayscale cursor-not-allowed"
                            )}
                            disabled={!audit.ready}
                            onClick={handleStartTraining}
                        >
                            {audit.ready ? (
                                <><Zap size={16} /> {t('startTrainingWithGallery')}</>
                            ) : (
                                <><Camera size={16} /> {t('goToGalleryToUpload')}</>
                            )}
                            <ArrowRight size={16} />
                        </Button>
                    ) : (
                        <Button
                            size="lg"
                            className="h-14 px-8 rounded-2xl font-black uppercase tracking-widest gap-2"
                            onClick={() => router.push(`/${locale}/creator/muse`)}
                        >
                            {uniqData.twin_path === 'photos' ? (
                                <><Camera size={16} /> {t('uploadAndTrain')}</>
                            ) : (
                                <><Wand2 size={16} /> {t('describeCharacter')}</>
                            )}
                            <ArrowRight size={16} />
                        </Button>
                    )}
                </div>
            </motion.div>

            {/* Gallery Audit Section (Phase 2) */}
            {!isReady && twinStatus === 'learning' && uniqData.twin_path === 'photos' && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="grid grid-cols-1 lg:grid-cols-2 gap-4"
                >
                    <div className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-8 space-y-6">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-headline font-black italic uppercase tracking-tighter flex items-center gap-2">
                                <Target className="w-5 h-5 text-primary" />
                                {t('auditTitle')}
                            </h3>
                            <Badge className={cn(
                                "text-[10px] font-black uppercase px-3 py-1",
                                audit.ready ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/20" : "bg-primary/10 text-primary border-primary/20"
                            )}>
                                {audit.ready ? t('auditStatusReady') : t('auditStatusUnready')}
                            </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <AuditItem label={t('auditTotalPhotos', { count: audit.total })} done={audit.total >= 15} tip={t('auditPhotosNeeded')} />
                            <AuditItem label={t('auditCloseups')} done={audit.closeups >= 5} tip={t('auditMinCloseups')} />
                            <AuditItem label={t('auditFullBody')} done={audit.body >= 3} tip={t('auditMinFullBody')} />
                            <AuditItem label={t('auditVariety')} done={audit.variety >= 5} tip={t('auditVariety')} />
                        </div>
                    </div>

                    <div className="rounded-[2.5rem] bg-primary/5 border border-primary/20 p-8 flex flex-col justify-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                                <Info className="text-primary w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-primary italic uppercase tracking-widest text-sm">{t('auditStatusUnready')}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {audit.tip}
                        </p>
                        {!audit.ready && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-fit rounded-xl font-bold border-primary/20 text-primary"
                                onClick={() => router.push(`/${locale}/creator`)}
                            >
                                {t('goToGalleryToUpload')}
                            </Button>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Info cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                    {
                        icon: Target,
                        label: t('pathLabel'),
                        value: uniqData.twin_path === 'photos' ? t('realPhotos') : t('imaginaryCharacter'),
                        color: 'text-primary'
                    },
                    {
                        icon: CheckCircle2,
                        label: t('statusLabel'),
                        value: isReady ? t('statusActive') : twinStatus === 'training' ? t('statusTraining') : t('statusLearning'),
                        color: isReady ? 'text-emerald-400' : 'text-amber-400'
                    },
                    {
                        icon: ImageIcon,
                        label: t('resetsLabel'),
                        value: t('resetsUsed', { count: uniqData.character_reset_count ?? 0 }),
                        color: 'text-muted-foreground'
                    }
                ].map((card, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + i * 0.05 }}
                        className="rounded-3xl bg-white/[0.02] border border-white/5 p-6 flex flex-col gap-2"
                    >
                        <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest">
                            <card.icon size={12} />
                            {card.label}
                        </div>
                        <p className={cn("text-xl font-headline font-black italic uppercase tracking-tight", card.color)}>
                            {card.value}
                        </p>
                    </motion.div>
                ))}
            </div>

            {/* Next steps */}
            {!isReady && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="rounded-[2.5rem] bg-white/[0.02] border border-white/5 p-8 space-y-4"
                >
                    <h2 className="text-lg font-headline font-black italic uppercase tracking-tighter flex items-center gap-2">
                        <Zap className="w-5 h-5 text-primary" />
                        {t('nextSteps')}
                    </h2>
                    <div className="space-y-3">
                        {uniqData.twin_path === 'photos' ? (
                            <>
                                <Step n={1} done={false} text={t("nStepP1")} />
                                <Step n={2} done={false} text={t("nStepP2")} />
                                <Step n={3} done={false} text={t("nStepP3")} />
                                <Step n={4} done={false} text={t("nStepP4")} />
                            </>
                        ) : (
                            <>
                                <Step n={1} done={false} text={t("nStepI1")} />
                                <Step n={2} done={false} text={t("nStepI2")} />
                                <Step n={3} done={false} text={t("nStepI3")} />
                                <Step n={4} done={false} text={t("nStepI4")} />
                            </>
                        )}
                    </div>
                </motion.div>
            )}

        </div>
    );
}

function AuditItem({ label, done, tip }: { label: string; done: boolean; tip: string }) {
    return (
        <div className="space-y-1">
            <div className="flex items-center gap-2">
                <div className={cn(
                    "w-4 h-4 rounded-full flex items-center justify-center shrink-0",
                    done ? "bg-emerald-500" : "bg-white/5 border border-white/10"
                )}>
                    {done && <Check size={10} className="text-black" />}
                </div>
                <span className={cn("text-xs font-bold uppercase tracking-tight", done ? "text-white" : "text-muted-foreground")}>
                    {label}
                </span>
            </div>
            <p className="pl-6 text-[8px] text-muted-foreground/40 font-bold uppercase tracking-widest">{tip}</p>
        </div>
    );
}

function Step({ n, done, text }: { n: number; done: boolean; text: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-black mt-0.5",
                done ? "bg-emerald-500 text-black" : "bg-white/5 border border-white/10 text-muted-foreground"
            )}>
                {done ? <CheckCircle2 size={12} /> : n}
            </div>
            <p className={cn("text-sm", done ? "text-muted-foreground line-through" : "text-muted-foreground")}>{text}</p>
        </div>
    );
}
