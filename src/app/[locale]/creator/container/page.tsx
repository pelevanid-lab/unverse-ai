"use client"

import { useWallet } from '@/hooks/use-wallet';
import { ContainerTab } from '@/components/creator/ContainerTab';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Globe, Settings, MessageSquare, Megaphone, Sparkles } from 'lucide-react';
import { Link, useRouter } from '@/i18n/routing';
import { useTranslations } from 'next-intl';
import { CreatorMilestoneCard } from '@/components/creator/CreatorMilestoneCard';

export default function ContainerPage() {
    const t = useTranslations('Creator');
    const tContainer = useTranslations('Container');
    const { user, isConnected } = useWallet();
    const router = useRouter();

    if (!isConnected || !user) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4">
                <h1 className="text-3xl font-headline font-bold uppercase tracking-widest opacity-50">Identity Verification Required</h1>
                <p className="text-muted-foreground">Please connect your wallet to access the Creator Panel.</p>
                <Link href="/"><Button className="rounded-xl">{t('backToHome')}</Button></Link>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 pb-12 px-4 mt-6 animate-in fade-in duration-700">
            <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 border-b pb-10 border-white/10">
                <div className="flex items-start gap-4">
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => router.push('/mypage')} 
                        className="h-10 w-10 rounded-full bg-white/5 shrink-0 hover:bg-white/10"
                    >
                        <ChevronLeft className="w-6 h-6" />
                    </Button>
                    <div>
                        <h1 className="text-5xl font-headline font-bold gradient-text tracking-tighter italic uppercase">{t('panelTitle')}</h1>
                        <div className='mt-2'>
                            <p className="text-sm font-medium text-muted-foreground opacity-70">{t('manageEmpire')}</p>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
                    <Link href="/wallet" className='w-full'>
                        <Card className="glass-card border-white/10 bg-white/5 flex items-center justify-center text-center px-8 py-4 rounded-[2rem] h-full hover:bg-primary/10 transition-colors cursor-pointer group min-w-[220px]">
                            <div>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">{t('totalBalance')}</p>
                                <p className="text-3xl font-bold font-headline group-hover:text-primary transition-colors">
                                    {user?.ulcBalance?.available.toFixed(2) || "0.00"} <span className="text-sm font-normal text-muted-foreground">ULC</span>
                                </p>
                            </div>
                        </Card>
                    </Link>
                    <div className="flex flex-col gap-2">
                        <Link href={`/profile/${user?.uid}`} className="w-full">
                            <Button variant="outline" className="h-12 w-full rounded-2xl gap-2 px-6 border-white/10 hover:bg-white/5 font-bold">
                                <Globe className="w-4 h-4" /> {t('viewProfile')}
                            </Button>
                        </Link>
                        <Link href="/creator/settings" className="w-full">
                            <Button variant="secondary" className="h-12 w-full rounded-2xl gap-2 px-6 font-bold">
                                <Settings className="w-4 h-4" /> {t('settings')}
                            </Button>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Top Cards Section */}
            <div className="space-y-6">
                {/* 1. Milestone Card */}
                <div className="max-w-4xl mx-auto">
                    <CreatorMilestoneCard user={user} />
                </div>

                {/* 2. Uniq Premium & Promo Card Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link href="/creator/uniq">
                        <Card className="glass-card bg-[#2D1B4D]/30 border-primary/20 p-6 flex items-center gap-6 group hover:bg-[#2D1B4D]/50 transition-all cursor-pointer relative overflow-hidden h-full">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Sparkles size={120} className="text-primary rotate-12" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center shrink-0">
                                <MessageSquare className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-0.5">{tContainer('uniqPremium')}</h3>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">{tContainer('uniqPremiumDesc')}</p>
                            </div>
                        </Card>
                    </Link>

                    <Link href="/creator/promo-card">
                        <Card className="glass-card bg-[#3D2B1D]/30 border-yellow-500/20 p-6 flex items-center gap-6 group hover:bg-[#3D2B1D]/50 transition-all cursor-pointer relative overflow-hidden h-full">
                             <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                <Megaphone size={120} className="text-yellow-500 -rotate-12" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-yellow-500/20 flex items-center justify-center shrink-0">
                                <Megaphone className="w-6 h-6 text-yellow-500" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-0.5">{tContainer('promoCard')}</h3>
                                <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">{tContainer('promoCardDesc')}</p>
                            </div>
                        </Card>
                    </Link>
                </div>
            </div>

            <ContainerTab />
        </div>
    );
}

