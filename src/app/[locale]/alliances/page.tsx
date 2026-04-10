"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Users, Shield, Zap, Search, Plus, 
    ChevronRight, Trophy, Flag, Globe, Lock,
    CheckCircle2, AlertCircle, Info
} from 'lucide-react';
import { useWallet } from '@/hooks/use-wallet';
import { getAlliances, getPlayerAlliance, createAllianceClient } from '@/lib/alliance-engine';
import { getHunterStats } from '@/lib/game-engine';
import { Alliance } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Link, useRouter } from '@/i18n/routing';
import { Input } from '@/components/ui/input';

export default function AllianceHubPage() {
    const t = useTranslations('Game');
    const { user, isConnected, connectWallet } = useWallet();
    const router = useRouter();

    const [alliances, setAlliances] = useState<Alliance[]>([]);
    const [myAlliance, setMyAlliance] = useState<Alliance | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ chestsFound: 0 });
    
    // Create form
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newSymbol, setNewSymbol] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            try {
                const [all, mine] = await Promise.all([
                    getAlliances(),
                    isConnected && user ? getPlayerAlliance(user.walletAddress || user.uid) : Promise.resolve(null)
                ]);
                setAlliances(all);
                setMyAlliance(mine);

                if (isConnected && user) {
                    const s = await getHunterStats(user.walletAddress || user.uid);
                    setStats(s);
                }
            } catch (e) {
                console.error('Failed to load alliances:', e);
            }
            setLoading(false);
        };
        load();
    }, [isConnected, user]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        
        setIsSubmitting(true);
        setError('');
        
        try {
            const res = await createAllianceClient({
                name: newName,
                symbol: newSymbol,
                isPublic: true,
                entryFeeULC: 0,
                founderAddress: user.walletAddress || user.uid
            });

            if (res.success && res.allianceId) {
                router.push(`/alliances/${res.allianceId}`);
            } else {
                setError(res.error || 'Founding failed');
            }
        } catch (e: any) {
            setError(e.message);
        }
        setIsSubmitting(false);
    };

    const hasClearance = stats.chestsFound >= 1;

    return (
        <div className="min-h-screen bg-background pb-32">
            {/* ── HEADER ── */}
            <div className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
                    <div>
                        <motion.div 
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="flex items-center gap-3 mb-4"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                                <Users className="w-6 h-6 text-yellow-500" />
                            </div>
                            <h1 className="text-4xl font-black font-headline tracking-tighter uppercase">{t('allianceHubTitle')}</h1>
                        </motion.div>
                        <p className="text-muted-foreground max-w-lg leading-relaxed">
                            {t('allianceHubSub')}
                        </p>
                    </div>

                    {isConnected && !myAlliance && (
                        <Button 
                            onClick={() => setShowCreate(!showCreate)}
                            className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-8 py-6 rounded-2xl shadow-xl shadow-yellow-500/20 gap-2"
                        >
                            <Plus className="w-5 h-5" /> {t('allianceHubFound')}
                        </Button>
                    )}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6">
                <AnimatePresence>
                    {showCreate && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden mb-12"
                        >
                            <div className="p-8 rounded-3xl border border-yellow-500/30 bg-yellow-500/5 relative">
                                <h2 className="text-xl font-black mb-6 uppercase flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-yellow-500" /> {t('allianceHubApplication')}
                                </h2>
                                
                                {!hasClearance ? (
                                    <div className="flex flex-col items-center justify-center text-center p-6 border border-dashed border-yellow-500/20 rounded-2xl bg-black/20">
                                        <Lock className="w-8 h-8 text-yellow-500/40 mb-3" />
                                        <p className="text-sm font-bold text-yellow-500/60 uppercase tracking-widest leading-loose">
                                            {t('allianceHubClearanceDenied')}
                                        </p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('allianceHubTeamName')}</label>
                                            <Input 
                                                value={newName}
                                                onChange={e => setNewName(e.target.value)}
                                                placeholder="e.g., Alexandria Archivists" 
                                                className="bg-black/40 border-white/10 rounded-xl h-12"
                                                maxLength={30}
                                                required
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{t('allianceHubSymbol')}</label>
                                            <Input 
                                                value={newSymbol}
                                                onChange={e => setNewSymbol(e.target.value.toUpperCase())}
                                                placeholder="ARCH" 
                                                className="bg-black/40 border-white/10 rounded-xl h-12 font-mono"
                                                maxLength={4}
                                                required
                                            />
                                        </div>
                                        <div className="md:col-span-2 flex items-center justify-between gap-4 mt-2">
                                            <p className="text-[10px] text-muted-foreground w-2/3">
                                                {t('allianceHubCoord')}
                                            </p>
                                            <Button 
                                                type="submit" 
                                                disabled={isSubmitting || !newName || !newSymbol}
                                                className="bg-yellow-500 hover:bg-yellow-400 text-black font-black px-10 rounded-xl h-12"
                                            >
                                                {isSubmitting ? t('allianceFounding') : t('allianceEstablish')}
                                            </Button>
                                        </div>
                                        {error && (
                                            <div className="md:col-span-2 flex items-center gap-2 text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                                <AlertCircle className="w-4 h-4" /> {error}
                                            </div>
                                        )}
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── MY ALLIANCE ── */}
                {myAlliance && (
                    <div className="mb-12">
                        <h2 className="text-xs font-black tracking-[0.3em] text-muted-foreground uppercase mb-6 flex items-center gap-3">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" /> {t('allianceHubMy')}
                        </h2>
                        <Link href={`/alliances/${myAlliance.id}`}>
                            <div className="group p-8 rounded-3xl border border-yellow-500/40 bg-card/40 hover:bg-card shadow-2xl shadow-yellow-500/5 transition-all flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-transparent border border-yellow-500/20 flex items-center justify-center text-3xl font-black text-yellow-400">
                                        {myAlliance.symbol}
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-black font-headline uppercase">{myAlliance.name}</h3>
                                        <div className="flex items-center gap-4 mt-2">
                                            <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                                                <Users className="w-4 h-4" /> {t('countHunters', { count: myAlliance.memberCount })}
                                            </span>
                                            <span className="flex items-center gap-1 text-xs font-bold text-yellow-500/80">
                                                <Trophy className="w-4 h-4" /> {myAlliance.totalRewardULC.toLocaleString()} ULC
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <ChevronRight className="w-8 h-8 text-yellow-500 group-hover:translate-x-2 transition-transform" />
                            </div>
                        </Link>
                    </div>
                )}

                {/* ── ALLIANCE LIST ── */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xs font-black tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                            <Globe className="w-4 h-4" /> {t('allianceHubPublic')}
                        </h2>
                        <div className="relative w-64 hidden md:block">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input placeholder={t('allianceHubSearch')} className="pl-10 h-9 bg-white/5 border-white/5 text-xs rounded-lg" />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {loading ? (
                            [...Array(6)].map((_, i) => (
                                <div key={i} className="h-40 rounded-2xl border border-white/5 bg-white/5 animate-pulse" />
                            ))
                        ) : alliances.filter(a => a.id !== myAlliance?.id).length === 0 ? (
                            <div className="col-span-full py-20 text-center border border-dashed border-white/10 rounded-3xl">
                                <Info className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                                <p className="text-muted-foreground italic">{t('allianceHubNoDetected')}</p>
                            </div>
                        ) : (
                            alliances.filter(a => a.id !== myAlliance?.id).map((alliance, i) => (
                                <motion.div
                                    key={alliance.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <Link href={`/alliances/${alliance.id}`}>
                                        <div className="group p-5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-yellow-500/20 transition-all h-full">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-muted-foreground uppercase italic group-hover:text-yellow-400">
                                                    {alliance.symbol}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-bold truncate text-foreground uppercase tracking-tight">{alliance.name}</h4>
                                                    <div className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">
                                                        {t('allianceSlots', { count: alliance.memberCount })}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-1 text-[10px] font-black text-yellow-500/80">
                                                    <CheckCircle2 className="w-3 h-3" /> {t('activeOpen')}
                                                </div>
                                                <div className="flex items-center gap-1 text-xs font-black text-foreground">
                                                    {alliance.totalRewardULC.toLocaleString()} <span className="text-[9px] opacity-40">ULC</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
