"use client"

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Users, User, Zap, ChevronRight, Crown, Medal } from 'lucide-react';
import { getLeaderboard } from '@/lib/game-engine';

export default function LeaderboardPage() {
    const t = useTranslations('Game');
    const [type, setType] = useState<'solo' | 'alliances'>('solo');
    const [entries, setEntries] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getLeaderboard(type, 50)
            .then(data => setEntries(data))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [type]);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Crown className="w-5 h-5 text-yellow-400" />;
        if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
        if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
        return <span className="text-xs font-black text-muted-foreground">{rank}</span>;
    };

    const getRankStyle = (rank: number) => {
        if (rank === 1) return 'bg-yellow-500/10 border-yellow-500/30';
        if (rank === 2) return 'bg-white/5 border-white/10';
        if (rank === 3) return 'bg-amber-900/10 border-amber-900/30';
        return 'bg-card/30 border-white/5';
    };

    return (
        <div className="min-h-screen bg-background pb-20">
            {/* ── HEADER ── */}
            <div className="max-w-4xl mx-auto px-4 py-12 text-center">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 mb-4"
                >
                    <Trophy className="w-8 h-8 text-yellow-500" />
                </motion.div>
                <h1 className="text-3xl md:text-5xl font-black font-headline tracking-tighter mb-2">
                    {t('navLeaderboard')}
                </h1 >
                <p className="text-muted-foreground text-sm uppercase tracking-[0.2em] font-bold">
                    {t('leaderGlobal')}
                </p>

                {/* Switcher */}
                <div className="flex items-center justify-center mt-8 gap-2">
                    <button
                        onClick={() => setType('solo')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                            type === 'solo'
                                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                        }`}
                    >
                        <User className="w-4 h-4" />
                        {t('leaderSolo')}
                    </button>
                    <button
                        onClick={() => setType('alliances')}
                        className={`flex items-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${
                            type === 'alliances'
                                ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/20'
                                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                        }`}
                    >
                        <Users className="w-4 h-4" />
                        {t('leaderAlliances')}
                    </button>
                </div>
            </div>

            {/* ── LIST ── */}
            <div className="max-w-4xl mx-auto px-4">
                <div className="rounded-2xl border border-white/5 bg-card/20 overflow-hidden">
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/5 text-[10px] font-black tracking-widest text-muted-foreground uppercase">
                        <div className="col-span-1">{t('leaderRank')}</div>
                        <div className="col-span-6">{t('leaderIdentity')}</div>
                        <div className="col-span-2 text-center">{t('leaderChests')}</div>
                        <div className="col-span-3 text-right">{t('leaderTotal')}</div>
                    </div>

                    <div className="divide-y divide-white/5">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="px-6 py-5 animate-pulse flex gap-4">
                                    <div className="w-8 h-8 rounded-full bg-white/5" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-1/3 bg-white/5 rounded" />
                                        <div className="h-3 w-1/4 bg-white/5 rounded" />
                                    </div>
                                </div>
                            ))
                        ) : entries.length === 0 ? (
                            <div className="px-6 py-20 text-center text-muted-foreground">
                                {t('leaderNoActivity')}
                            </div>
                        ) : (
                            entries.map((entry, i) => (
                                <motion.div
                                    key={entry.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className={`grid grid-cols-12 gap-4 px-6 py-5 items-center transition-colors hover:bg-white/5 ${getRankStyle(entry.rank)}`}
                                >
                                    {/* Rank Icon */}
                                    <div className="col-span-1 flex items-center">
                                        {getRankIcon(entry.rank)}
                                    </div>

                                    {/* Identity */}
                                    <div className="col-span-6 flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-transparent border border-white/5 flex items-center justify-center flex-shrink-0">
                                            {type === 'solo' ? <User className="w-5 h-5 text-muted-foreground" /> : <Users className="w-5 h-5 text-muted-foreground" />}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-bold text-foreground truncate">
                                                {type === 'solo'
                                                    ? (entry.username || `${entry.walletAddress?.slice(0, 6)}...${entry.walletAddress?.slice(-4)}`)
                                                    : entry.name}
                                            </div>
                                            {type === 'alliances' && (
                                                <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase">
                                                    [{entry.symbol}] {t('leaderMembers', { count: entry.memberCount })}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div className="col-span-2 text-center">
                                        <div className="text-lg font-black text-foreground">{entry.chestsFound || 0}</div>
                                    </div>

                                    {/* Reward */}
                                    <div className="col-span-3 text-right">
                                        <div className="text-lg font-black text-yellow-400">
                                            {(entry.totalRewardULC || 0).toLocaleString()}
                                        </div>
                                        <div className="text-[10px] font-bold text-muted-foreground/60 uppercase">ULC</div>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </div>
                </div>

                <div className="mt-6 text-center text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest">
                    {t('leaderUpdateInfo')}
                </div>
            </div>
        </div>
    );
}
